# CSSA Reference Implementation

A PyTorch reproduction of the dual-branch architecture introduced in:

> Zhao, Yuan, Wang, Shen, Huang. *CSSA: A Cross-modal Semantic-Structural Alignment Framework via LLMs and Graph Contrastive Learning for Fraud Detection of Online Payment.* CNML 2026 (IEEE), DOI [10.1109/CNML68938.2026.11452378](https://doi.org/10.1109/CNML68938.2026.11452378).

## What this is

A faithful, paper-grounded reference implementation of the three equations in §III of the paper:

```
Z_i_sem  = MLP(LLM(P_i))                              # Eq. 1 — semantic branch
h_i^l+1  = σ(Σ_{j ∈ N(i)∪{i}} α_ij W^l h_j^l)         # Eq. 2 — structural branch (3-layer GCN, hidden 256)
y_i      = Softmax(MLP(Z_i_sem ⊕ Z_i_str))            # Eq. 3 — joint classifier
```

Plus the contrastive alignment objective described in §III (implemented as symmetric InfoNCE / NT-Xent between aligned semantic and structural representations).

Ships a CPU-only synthetic demo that finishes in seconds and verifies the full pipeline end-to-end.

## Quickstart

```bash
pip install -r requirements.txt
python demo.py                     # uses the offline DeterministicHashEncoder
OPENAI_API_KEY=sk-... python demo.py    # uses real embeddings (any OpenAI-compatible endpoint)
```

The demo builds a 200-node synthetic text-attributed graph with a planted fraud cluster, runs 30 epochs of joint training (contrastive alignment + cross-entropy), and reports test accuracy and fraud recall.

## Faithfulness notes

| Paper element | Implementation | Notes |
|---|---|---|
| Structural branch: 3-layer GCN, hidden=256, batch norm, dropout=0.3 | `StructuralBranch` in `model.py` | Matches §III.B exactly. Uses dense-adjacency symmetric normalization (`D^{-1/2} (A+I) D^{-1/2}`), which is the standard reduction of Eq. 2 when `α_ij = 1/√(deg(i)·deg(j))`. |
| Semantic branch: `MLP(LLM(P_i))` with LoRA-tuned ChatGLM3-6B (r=16, α=32) | `SemanticBranch` MLP head + pluggable `SemanticEncoder` interface | The MLP head matches Eq. 1. The LoRA-tuned ChatGLM3-6B is **not** bundled; instead `semantic.py` provides an OpenAI-compatible embeddings backend (the intended real backend) and a deterministic offline backend for the demo. See "What this implementation does NOT do" below. |
| Cross-modal contrastive alignment | `info_nce` and `joint_loss` in `losses.py` | Symmetric InfoNCE / NT-Xent with temperature τ. Aligns each node's semantic representation with its structural representation; pushes apart different nodes within the minibatch. |
| Joint classifier: `Softmax(MLP(Z_sem ⊕ Z_str))` | `CSSA.head` in `model.py` | Matches Eq. 3. |
| Joint loss: `L = α · L_align + (1 − α) · L_CE` | `joint_loss` in `losses.py` | The paper specifies the two components and CE; the relative weight α is a configurable hyperparameter (default 0.5; the demo uses 0.3 for the small graph). |
| 5:1 minority oversampling | `class_weight` on CE in `train.py` | The paper applies a 5:1 oversampling ratio to the latent-space contrastive step. We use the equivalent per-class weighting on the cross-entropy term, which is the standard PyTorch-idiomatic translation. |
| Adam optimizer, 150 epochs, 4×V100 | Adam (`train.py`), demo runs 30 epochs CPU | The 150-epoch / 4-GPU regime is not reproducible on a laptop; the demo verifies pipeline correctness rather than reproducing paper-scale training. |

## What this implementation does NOT do

- **Does not LoRA-fine-tune ChatGLM3-6B.** That requires substantial GPU memory and a curated financial-instruction-tuning corpus. The semantic branch falls back to a pluggable embedding encoder. The architecture and joint objective are unchanged; the upstream feature source is the substitution.
- **Does not reproduce the paper's headline numbers** (Precision 0.953 / Macro-F1 0.639 / PR-AUC 0.712 on the 2.84M-transaction dataset). Those require both the original dataset and the LoRA-tuned semantic branch.
- **Does not include the original e-commerce dataset.** The demo uses synthetic data with the same structural-semantic correlation pattern so the architecture's mechanism is observable.

## Citation

```
@inproceedings{zhao2026cssa,
  title     = {CSSA: A Cross-modal Semantic-Structural Alignment Framework via LLMs and Graph Contrastive Learning for Fraud Detection of Online Payment},
  author    = {Zhao, Zirui and Yuan, Keyu and Wang, Ziyue and Shen, Jiaqing and Huang, Yirui},
  booktitle = {Proceedings of the 2026 International Conference on Communication Networks and Machine Learning (CNML)},
  year      = {2026},
  publisher = {IEEE},
  doi       = {10.1109/CNML68938.2026.11452378}
}
```
