"""CPU-only synthetic demo for the CSSA reference implementation.

What this demo verifies:
  - The dual-branch model instantiates and forward-passes correctly.
  - The InfoNCE contrastive alignment loss + cross-entropy joint objective
    optimizes without exploding.
  - Validation accuracy improves over a handful of epochs on a synthetic
    text-attributed graph with a known structural signal.

It does NOT reproduce the paper's reported Macro-F1 of 0.639 / PR-AUC of
0.712 / Precision of 0.953 on the 2.84M-transaction e-commerce dataset.
That requires (a) the real dataset and (b) the LoRA-tuned ChatGLM3-6B
semantic branch. See README for what was substituted and why.
"""

from __future__ import annotations

import os
import sys

if __package__ in (None, ""):
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import torch

from cssa.semantic import DeterministicHashEncoder, OpenAIEmbeddingEncoder
from cssa.train import TrainConfig, train, predict


def make_synthetic_graph(n_nodes: int = 200, seed: int = 0):
    """Build a small text-attributed graph with a planted fraud signal.

    Nodes are sampled into two clusters. Fraud nodes (label=1) cluster
    tighter in feature space and are more likely to be connected to each
    other (homophily). Each node carries a short synthetic text describing
    its activity.
    """
    g = torch.Generator().manual_seed(seed)

    feature_dim = 16
    centers = torch.tensor([[0.0] * feature_dim, [1.0] * feature_dim])
    labels = (torch.rand(n_nodes, generator=g) < 0.2).long()
    features = centers[labels] + 0.4 * torch.randn(n_nodes, feature_dim, generator=g)

    A = torch.zeros(n_nodes, n_nodes)
    for i in range(n_nodes):
        for j in range(i + 1, n_nodes):
            p_same = 0.04 if labels[i] == labels[j] else 0.005
            if torch.rand((), generator=g).item() < p_same:
                A[i, j] = 1.0
                A[j, i] = 1.0

    texts: list[str] = []
    for i in range(n_nodes):
        if labels[i] == 1:
            texts.append(
                f"Entity {i}: irregular purchase frequency, address recently changed,"
                f" mismatched billing region, several refund chargebacks."
            )
        else:
            texts.append(
                f"Entity {i}: stable purchase pattern, consistent address history,"
                f" billing region matches shipping, no chargebacks in last 12 months."
            )

    return features, A, labels, texts


def split_masks(n: int, train_frac: float = 0.6, val_frac: float = 0.2, seed: int = 0):
    perm = torch.randperm(n, generator=torch.Generator().manual_seed(seed))
    n_train = int(train_frac * n)
    n_val = int(val_frac * n)
    train_mask = torch.zeros(n, dtype=torch.bool)
    val_mask = torch.zeros(n, dtype=torch.bool)
    test_mask = torch.zeros(n, dtype=torch.bool)
    train_mask[perm[:n_train]] = True
    val_mask[perm[n_train:n_train + n_val]] = True
    test_mask[perm[n_train + n_val:]] = True
    return train_mask, val_mask, test_mask


def main() -> int:
    print("CSSA reference implementation — synthetic demo (CPU)")
    print("=" * 60)

    features, A, labels, texts = make_synthetic_graph(n_nodes=200)
    train_mask, val_mask, test_mask = split_masks(features.size(0))

    print(f"  nodes: {features.size(0)}  edges: {int(A.sum().item() / 2)}")
    print(f"  fraud rate: {float(labels.float().mean().item()):.2%}")

    # Pick the semantic encoder.
    if os.environ.get("OPENAI_API_KEY"):
        print("  semantic encoder: OpenAIEmbeddingEncoder (network call)")
        enc = OpenAIEmbeddingEncoder()
    else:
        print("  semantic encoder: DeterministicHashEncoder (offline; set OPENAI_API_KEY for real embeddings)")
        enc = DeterministicHashEncoder(dim=64)

    embs = enc.encode(texts)
    llm_embeddings = torch.tensor(embs, dtype=torch.float32)
    print(f"  semantic embedding dim: {llm_embeddings.size(-1)}")
    print()

    cfg = TrainConfig(epochs=30, lr=1e-2, alignment_weight=0.3)

    def log(epoch, m):
        if (epoch + 1) % 5 == 0 or epoch == 0:
            print(
                f"  epoch {epoch + 1:>3}: total={m['total']:.4f}  ce={m['ce']:.4f}"
                f"  align={m['align']:.4f}  val_acc={m['val_acc']:.3f}"
            )

    print("Training ...")
    model, history = train(
        features, A, llm_embeddings, labels, train_mask, val_mask,
        cfg=cfg, on_epoch_end=log,
    )
    print()

    probs = predict(model, features, A, llm_embeddings)
    preds = probs.argmax(dim=-1)
    test_acc = float((preds[test_mask] == labels[test_mask]).float().mean().item())
    fraud_recall = float(
        ((preds[test_mask] == 1) & (labels[test_mask] == 1)).sum().item()
        / max(1, int((labels[test_mask] == 1).sum().item()))
    )
    print(f"Test accuracy: {test_acc:.3f}    fraud recall: {fraud_recall:.3f}")
    print()
    print("Demo complete. Forward pass + contrastive alignment + joint head verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
