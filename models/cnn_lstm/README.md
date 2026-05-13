# CNN-LSTM Reference Implementation

A PyTorch reproduction of the CNN-LSTM hybrid for blockchain payment-fraud detection introduced in:

> Yuan, Lin, Wu, Chang. *Detection of Blockchain Online Payment Fraud Via CNN-LSTM.* BDICN 2026 (5th International Conference on Big Data, Information and Computer Network), ACM Digital Library. DOI [10.1145/3801228.3801323](https://doi.org/10.1145/3801228.3801323).

## What this is

A faithful, paper-grounded reference implementation that:

- Implements the CNN block (Conv1D ×3, MaxPool1D ×2) per **Table 1**.
- Implements the LSTM head (BiLSTM ×2, Dense, Sigmoid) per **Table 2**.
- Implements the MinMax-scale → SMOTE → weighted BCE training pipeline described in **§3**.
- Implements the economic-threshold post-processor `L(τ) = C_fn · FN(τ) + C_fp · FP(τ)` from **§4**.
- Ships a CPU-only synthetic demo that finishes in seconds and verifies the pipeline end-to-end.

This is **architectural reference code**, not the trained checkpoint from the paper. The paper's headline metrics (55% TPR @ 1% FPR / 45–47% expected-loss reduction / F1=0.871) were established on the Elliptic Bitcoin Dataset with the paper's training regime; reproducing them is the job of Roadmap Phase II, not of this demo.

## Quickstart

```bash
pip install -r requirements.txt
python demo.py
```

Expected output: a few epochs of decreasing train/val loss, a confusion matrix on a small held-out set, and a printed economic-optimum threshold `τ*`. Runs in well under a minute on a modern laptop CPU.

## Running on the real Elliptic Bitcoin Dataset

The Elliptic Bitcoin Dataset must be obtained from its original distributors. Once you have it, place the three CSVs in a directory and use the loader:

```python
from cnn_lstm.data import load_elliptic
from cnn_lstm.train import TrainConfig, train

X, y = load_elliptic("/path/to/elliptic/")
# Filter out unlabeled rows (y == -1), then build train/val/test splits
# along the dataset's 49 time steps as the paper does.
```

## Faithfulness notes

| Paper element | Implementation | Notes |
|---|---|---|
| CNN: Conv1D(32, k=3, ReLU, same) + MaxPool(2) + Conv1D(64, k=5, ReLU, same) + MaxPool(2) + Conv1D(64, k=3, ReLU, same) | `CNNBlock` in `model.py` | Matches Table 1 exactly. |
| Table 1's terminal `GlobalAveragePooling1D` | Off by default (`use_global_pool=False`) | Table 1 shows GlobalAvgPool collapsing the time axis, but the paper's prose ("All these feature vectors are then reconstructed into chronological order while maintaining the 49-step time-dynamic profile") makes clear the LSTM consumes a sequence. We follow the prose. The literal Table-1 layout is available via the flag. |
| BiLSTM(128) → Dropout(0.3) → BiLSTM(64) → Dense(32, ReLU) → Sigmoid | `CNNLSTM` in `model.py` | Matches Table 2. |
| Recurrent dropout = 0.2 | Documented in `recurrent_dropout_target` attribute | PyTorch `nn.LSTM` does not expose Keras-style per-step recurrent dropout. We do not silently substitute a different mechanism; the attribute records the paper's target. |
| Orthogonal initialization of recurrent kernels | `_orthogonal_init_lstm` in `model.py` | Applied to `weight_hh` of both BiLSTMs. |
| MinMax scaling → SMOTE on training set only | `minmax_scale_3d` + `apply_smote_3d` in `train.py` | Matches §2.2 ("SMOTE was applied only on the training set to avoid leaking data. Once the feature space was created, feature vectors were normalized through the MinMax scaling, before the application of SMOTE"). |
| Weighted cross-entropy loss | `BCEWithLogitsLoss(pos_weight=...)` in `train.py` | `pos_weight = #neg / #pos` on the rebalanced training set. |
| Adam optimizer + gradient clipping + early stopping | `train.py` | All three present. |
| Economic loss `L(τ) = C_fn·FN(τ) + C_fp·FP(τ)`, `C_fn = 2.5 × median amount`, `C_fp = 0.1 × amount`, grid-search τ on val | `economic_threshold` in `train.py` | Matches §4 directly. |

## What this implementation does NOT do

- Does not ship trained weights.
- Does not reproduce the paper's adversarial-network ("GAN-FAKE") variant mentioned in the introduction. The paper's reported results are for the CNN-LSTM hybrid; the GAN-FAKE reference appears to belong to a different / earlier framing and is not the architecture detailed in §3.
- Does not include cross-baseline comparisons (GAT-ResNet, CoSemiGNN). Adding those is part of Roadmap Phase II.

## Citation

```
@inproceedings{yuan2026cnnlstm,
  title     = {Detection of Blockchain Online Payment Fraud Via CNN-LSTM},
  author    = {Yuan, Keyu and Lin, Yuqing and Wu, Wenjun and Chang, Chia Hong},
  booktitle = {Proceedings of the 2026 5th International Conference on Big Data, Information and Computer Network (BDICN 2026)},
  year      = {2026},
  publisher = {Association for Computing Machinery},
  doi       = {10.1145/3801228.3801323}
}
```
