"""Training loop for the CSSA reference implementation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import torch
import torch.nn.functional as F

from .losses import joint_loss
from .model import CSSA, normalize_adjacency


@dataclass
class TrainConfig:
    epochs: int = 20
    lr: float = 1e-3
    weight_decay: float = 1e-5
    alignment_weight: float = 0.5
    tau: float = 0.1
    grad_clip: float = 1.0
    device: str = "cpu"


def train(
    node_features: torch.Tensor,
    adjacency: torch.Tensor,
    llm_embeddings: torch.Tensor,
    labels: torch.Tensor,
    train_mask: torch.Tensor,
    val_mask: torch.Tensor,
    num_classes: int = 2,
    cfg: TrainConfig | None = None,
    on_epoch_end: Callable[[int, dict], None] | None = None,
) -> tuple[CSSA, dict]:
    cfg = cfg or TrainConfig()
    device = torch.device(cfg.device)

    node_features = node_features.to(device)
    adjacency = adjacency.to(device)
    llm_embeddings = llm_embeddings.to(device)
    labels = labels.to(device)
    train_mask = train_mask.to(device)
    val_mask = val_mask.to(device)

    A_norm = normalize_adjacency(adjacency)

    # Class weight from training set (paper uses 5:1 minority oversampling; we
    # apply equivalent per-class weighting on the CE term).
    with torch.no_grad():
        counts = torch.bincount(labels[train_mask], minlength=num_classes).clamp_min(1)
        class_weight = (counts.float().mean() / counts.float()).to(device)

    model = CSSA(
        struct_in_dim=node_features.size(-1),
        semantic_emb_dim=llm_embeddings.size(-1),
        num_classes=num_classes,
    ).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=cfg.lr, weight_decay=cfg.weight_decay)

    history: dict[str, list[float]] = {"total": [], "ce": [], "align": [], "val_acc": []}

    for epoch in range(cfg.epochs):
        model.train()
        opt.zero_grad()
        logits, z_sem, z_str = model(node_features, A_norm, llm_embeddings)
        loss, parts = joint_loss(
            logits[train_mask],
            labels[train_mask],
            z_sem[train_mask],
            z_str[train_mask],
            alignment_weight=cfg.alignment_weight,
            tau=cfg.tau,
            class_weight=class_weight,
        )
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), cfg.grad_clip)
        opt.step()

        model.eval()
        with torch.no_grad():
            logits, _, _ = model(node_features, A_norm, llm_embeddings)
            preds = logits.argmax(dim=-1)
            val_acc = float((preds[val_mask] == labels[val_mask]).float().mean().item())

        history["total"].append(parts["total"])
        history["ce"].append(parts["ce"])
        history["align"].append(parts["align"])
        history["val_acc"].append(val_acc)
        if on_epoch_end is not None:
            on_epoch_end(epoch, {**parts, "val_acc": val_acc})

    return model, history


@torch.no_grad()
def predict(
    model: CSSA,
    node_features: torch.Tensor,
    adjacency: torch.Tensor,
    llm_embeddings: torch.Tensor,
) -> torch.Tensor:
    model.eval()
    A_norm = normalize_adjacency(adjacency)
    logits, _, _ = model(node_features, A_norm, llm_embeddings)
    return F.softmax(logits, dim=-1)
