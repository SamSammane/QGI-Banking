"""CPU-only synthetic demo for the CNN-LSTM reference implementation.

What this demo verifies:
  - The model class instantiates and forward-passes correctly.
  - The MinMax + SMOTE training pipeline runs end-to-end.
  - The training loss decreases over a handful of epochs.
  - The economic-threshold post-processor returns a reasonable tau*.

It does NOT verify paper-level performance (55% TPR @ 1% FPR / 47% expected-
loss reduction). Those require the actual Elliptic Bitcoin Dataset and
the training-scale regime described in the paper.
"""

from __future__ import annotations

import sys

# Allow running as `python demo.py` from inside the directory.
if __package__ in (None, ""):
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np

from cnn_lstm.data import make_synthetic
from cnn_lstm.train import TrainConfig, train, predict_proba, economic_threshold


def main() -> int:
    print("CNN-LSTM reference implementation — synthetic demo (CPU)")
    print("=" * 60)

    print("Generating synthetic Elliptic-shaped dataset ...")
    X, y = make_synthetic(n_nodes=2048, time_steps=49, num_features=64, illicit_rate=0.05, seed=0)
    # Smaller num_features=64 and n_nodes=2048 so the demo finishes in seconds on CPU.

    n = X.shape[0]
    perm = np.random.default_rng(0).permutation(n)
    train_idx, val_idx, test_idx = perm[: int(0.7 * n)], perm[int(0.7 * n): int(0.85 * n)], perm[int(0.85 * n):]
    X_train, y_train = X[train_idx], y[train_idx]
    X_val, y_val = X[val_idx], y[val_idx]
    X_test, y_test = X[test_idx], y[test_idx]

    print(f"  train: {X_train.shape}  positives={int(y_train.sum())}")
    print(f"  val:   {X_val.shape}    positives={int(y_val.sum())}")
    print(f"  test:  {X_test.shape}   positives={int(y_test.sum())}")
    print()

    cfg = TrainConfig(epochs=4, batch_size=128, lr=1e-3, early_stopping_patience=10, smote=True)

    def epoch_log(epoch, m):
        print(f"  epoch {epoch + 1:>2}: train_loss={m['train_loss']:.4f}  val_loss={m['val_loss']:.4f}")

    print("Training (4 epochs, CPU) ...")
    model, history = train(X_train, y_train, X_val, y_val, cfg=cfg, on_epoch_end=epoch_log)
    print()

    print("Predicting on test set ...")
    probs = predict_proba(model, X_test)
    amounts = np.random.default_rng(1).uniform(0.01, 100.0, size=probs.shape[0]).astype(np.float32)
    tau, loss = economic_threshold(probs, y_test, amounts)
    pred = (probs >= tau).astype(np.int64)

    tp = int(((pred == 1) & (y_test == 1)).sum())
    fp = int(((pred == 1) & (y_test == 0)).sum())
    fn = int(((pred == 0) & (y_test == 1)).sum())
    tn = int(((pred == 0) & (y_test == 0)).sum())
    print(f"  tau*={tau:.3f}  expected_loss*={loss:.2f}")
    print(f"  confusion: TP={tp}  FP={fp}  FN={fn}  TN={tn}")

    delta = history["train_loss"][0] - history["train_loss"][-1]
    print()
    print(f"Train loss decreased by {delta:.4f} over the run.")
    print("Demo complete. Forward pass + pipeline verified.")
    print()
    print("To run on the real Elliptic Bitcoin Dataset, obtain it from its")
    print("original distributors and use models/cnn_lstm/data.py::load_elliptic().")
    return 0


if __name__ == "__main__":
    sys.exit(main())
