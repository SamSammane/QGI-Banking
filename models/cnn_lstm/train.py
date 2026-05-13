"""
Training pipeline for the CNN-LSTM reference implementation.

Includes:
  - MinMax scaling of features (per the paper, before SMOTE)
  - SMOTE oversampling of the training set only (also per the paper)
  - Weighted binary cross-entropy
  - Adam optimizer with gradient clipping
  - Early stopping on validation loss
  - Economic-threshold post-processor (Section 4 of the paper)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np
import torch
from torch.utils.data import DataLoader, TensorDataset

from .model import CNNLSTM


@dataclass
class TrainConfig:
    epochs: int = 10
    batch_size: int = 256
    lr: float = 1e-3
    grad_clip: float = 1.0
    weight_decay: float = 0.0
    early_stopping_patience: int = 5
    smote: bool = True
    smote_random_state: int = 0
    device: str = "cpu"


def minmax_scale_3d(X_train: np.ndarray, X_val: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """MinMax scale features across nodes+time per the paper's pre-processing."""
    flat = X_train.reshape(-1, X_train.shape[-1])
    feat_min = flat.min(axis=0)
    feat_max = flat.max(axis=0)
    rng = np.maximum(feat_max - feat_min, 1e-8)

    def apply(X: np.ndarray) -> np.ndarray:
        return (X - feat_min) / rng

    return apply(X_train).astype(np.float32), apply(X_val).astype(np.float32)


def apply_smote_3d(X: np.ndarray, y: np.ndarray, random_state: int = 0) -> tuple[np.ndarray, np.ndarray]:
    """Apply SMOTE to a 3-D dataset by flattening the (time, feature) axes,
    oversampling, then reshaping back. Mirrors the paper's "SMOTE applied only
    on the training set, after MinMax scaling" pipeline.
    """
    from imblearn.over_sampling import SMOTE  # local import

    n, t, f = X.shape
    flat = X.reshape(n, t * f)
    sm = SMOTE(random_state=random_state)
    flat_resampled, y_resampled = sm.fit_resample(flat, y)
    X_resampled = flat_resampled.reshape(-1, t, f).astype(np.float32)
    return X_resampled, y_resampled.astype(np.int64)


def train(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
    cfg: TrainConfig | None = None,
    on_epoch_end: Callable[[int, dict], None] | None = None,
) -> tuple[CNNLSTM, dict]:
    cfg = cfg or TrainConfig()
    device = torch.device(cfg.device)

    X_train, X_val = minmax_scale_3d(X_train, X_val)

    if cfg.smote:
        X_train, y_train = apply_smote_3d(X_train, y_train, cfg.smote_random_state)

    # Weighted BCE: pos_weight = (#neg / #pos) computed on the rebalanced training set
    n_pos = max(int((y_train == 1).sum()), 1)
    n_neg = max(int((y_train == 0).sum()), 1)
    pos_weight = torch.tensor([n_neg / n_pos], device=device, dtype=torch.float32)

    train_ds = TensorDataset(torch.from_numpy(X_train), torch.from_numpy(y_train).float())
    val_ds = TensorDataset(torch.from_numpy(X_val), torch.from_numpy(y_val).float())
    train_dl = DataLoader(train_ds, batch_size=cfg.batch_size, shuffle=True)
    val_dl = DataLoader(val_ds, batch_size=cfg.batch_size, shuffle=False)

    model = CNNLSTM(in_features=X_train.shape[-1]).to(device)
    optim = torch.optim.Adam(model.parameters(), lr=cfg.lr, weight_decay=cfg.weight_decay)
    loss_fn = torch.nn.BCEWithLogitsLoss(pos_weight=pos_weight)

    best_val = float("inf")
    patience = 0
    history: dict[str, list[float]] = {"train_loss": [], "val_loss": []}

    for epoch in range(cfg.epochs):
        model.train()
        tot = 0.0
        n_batches = 0
        for xb, yb in train_dl:
            xb, yb = xb.to(device), yb.to(device)
            optim.zero_grad()
            logits = model(xb)
            loss = loss_fn(logits, yb)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), cfg.grad_clip)
            optim.step()
            tot += float(loss.item())
            n_batches += 1
        train_loss = tot / max(n_batches, 1)

        model.eval()
        vtot = 0.0
        vbatches = 0
        with torch.no_grad():
            for xb, yb in val_dl:
                xb, yb = xb.to(device), yb.to(device)
                vtot += float(loss_fn(model(xb), yb).item())
                vbatches += 1
        val_loss = vtot / max(vbatches, 1)

        history["train_loss"].append(train_loss)
        history["val_loss"].append(val_loss)
        if on_epoch_end is not None:
            on_epoch_end(epoch, {"train_loss": train_loss, "val_loss": val_loss})

        if val_loss < best_val - 1e-5:
            best_val = val_loss
            patience = 0
        else:
            patience += 1
            if patience >= cfg.early_stopping_patience:
                break

    return model, history


@torch.no_grad()
def predict_proba(model: CNNLSTM, X: np.ndarray, batch_size: int = 256, device: str = "cpu") -> np.ndarray:
    device = torch.device(device)
    model.to(device).eval()
    out = []
    for start in range(0, X.shape[0], batch_size):
        xb = torch.from_numpy(X[start:start + batch_size]).to(device)
        logits = model(xb)
        out.append(torch.sigmoid(logits).cpu().numpy())
    return np.concatenate(out)


def economic_threshold(
    probs: np.ndarray,
    y_true: np.ndarray,
    amounts: np.ndarray,
    cfn_multiplier: float = 2.5,
    cfp_multiplier: float = 0.1,
    grid_size: int = 101,
) -> tuple[float, float]:
    """Implements the economic loss post-processor of Section 4:

        L(tau) = C_fn * FN(tau) + C_fp * FP(tau)

    Where C_fn is scaled by 2.5 x median transaction value (paper default)
    and C_fp by 0.1 x the per-transaction amount. Grid-searches tau and
    returns (tau*, expected_loss*).
    """
    median_amount = float(np.median(amounts))
    c_fn = cfn_multiplier * median_amount
    grid = np.linspace(0.0, 1.0, grid_size)
    best_tau = 0.5
    best_loss = float("inf")
    for tau in grid:
        pred = (probs >= tau).astype(np.int64)
        fn_mask = (pred == 0) & (y_true == 1)
        fp_mask = (pred == 1) & (y_true == 0)
        loss = c_fn * int(fn_mask.sum()) + cfp_multiplier * float(amounts[fp_mask].sum())
        if loss < best_loss:
            best_loss = loss
            best_tau = float(tau)
    return best_tau, best_loss
