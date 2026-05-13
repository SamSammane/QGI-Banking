"""
Dataset utilities for the CNN-LSTM reference implementation.

The original paper trains on the Elliptic Bitcoin Dataset
(~203,769 transactions, 166 features per node, 49 time steps, ~2% illicit).
That dataset is publicly available but distributed under terms that require
the user to obtain it directly. We do not redistribute it here.

This module ships:
  - `load_elliptic(path)`: loader if the user has placed the Elliptic CSVs
    in the expected directory layout.
  - `make_synthetic(...)`: a generator that produces tensors with the same
    shape and the same severe class imbalance, used by `demo.py`.

Both functions return numpy arrays ready for the SMOTE preprocessing step.
"""

from __future__ import annotations

from pathlib import Path
from typing import Tuple

import numpy as np


# Convention for synthetic + Elliptic data
DEFAULT_TIME_STEPS = 49
DEFAULT_NUM_FEATURES = 166


def make_synthetic(
    n_nodes: int = 4096,
    time_steps: int = DEFAULT_TIME_STEPS,
    num_features: int = DEFAULT_NUM_FEATURES,
    illicit_rate: float = 0.02,
    seed: int = 0,
) -> Tuple[np.ndarray, np.ndarray]:
    """Generate a synthetic Elliptic-shaped dataset.

    Illicit samples have a small mean-shift in a few feature dimensions so a
    classifier can demonstrably learn the boundary, but the signal is weak
    enough to leave headroom for the architecture to matter.
    """
    rng = np.random.default_rng(seed)

    X = rng.standard_normal(size=(n_nodes, time_steps, num_features)).astype(np.float32)
    y = (rng.random(size=n_nodes) < illicit_rate).astype(np.int64)

    # Inject a weak, structured signal into illicit samples on a few features.
    illicit_mask = y == 1
    n_illicit = int(illicit_mask.sum())
    if n_illicit > 0:
        signal_features = rng.choice(num_features, size=8, replace=False)
        shifts = rng.uniform(0.5, 1.2, size=8).astype(np.float32)
        for f, s in zip(signal_features, shifts):
            X[illicit_mask, :, f] += s

    return X, y


def load_elliptic(root: str | Path):
    """Best-effort loader for the Elliptic Bitcoin Dataset.

    Expected files in `root`:
        - elliptic_txs_features.csv
        - elliptic_txs_classes.csv
        - elliptic_txs_edgelist.csv  (not used by this baseline)

    Returns (X, y) where X has shape (n_nodes, time_steps, num_features).
    Labels: 1 = illicit, 0 = licit, -1 = unknown (returned as a mask).
    """
    root = Path(root)
    feats_csv = root / "elliptic_txs_features.csv"
    cls_csv = root / "elliptic_txs_classes.csv"
    if not feats_csv.exists() or not cls_csv.exists():
        raise FileNotFoundError(
            f"Elliptic Bitcoin Dataset not found in {root}. "
            "Place elliptic_txs_features.csv and elliptic_txs_classes.csv there. "
            "The dataset must be obtained from its original distributors."
        )

    import pandas as pd  # local import keeps demo.py lightweight

    feats = pd.read_csv(feats_csv, header=None)
    cls = pd.read_csv(cls_csv)

    # By the Elliptic format convention: column 0 = tx id, column 1 = time step,
    # columns 2..167 = 166 features.
    tx_ids = feats.iloc[:, 0].to_numpy()
    time_steps_col = feats.iloc[:, 1].to_numpy()
    features = feats.iloc[:, 2:].to_numpy(dtype=np.float32)

    cls = cls.set_index(cls.columns[0])
    raw_labels = cls.loc[tx_ids].iloc[:, 0].to_numpy()
    y = np.where(raw_labels == "1", 1, np.where(raw_labels == "2", 0, -1)).astype(np.int64)

    # Reshape per-node features into (n_nodes, time_steps, num_features) by
    # broadcasting the per-node static feature vector across the time axis.
    # The Elliptic Bitcoin Dataset's "166 features per node, observed at one of
    # 49 time steps" is not natively per-(node, step), so this is a common
    # pragmatic shaping used by sequence-model baselines.
    n_nodes = features.shape[0]
    num_features = features.shape[1]
    time_steps = int(time_steps_col.max())
    X = np.broadcast_to(
        features[:, None, :], (n_nodes, time_steps, num_features)
    ).copy()
    return X, y
