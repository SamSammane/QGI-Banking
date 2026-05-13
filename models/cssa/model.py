"""
CSSA: Cross-modal Semantic-Structural Alignment for online-payment fraud detection.

Reference: Zhao, Yuan, Wang, Shen, Huang. "CSSA: A Cross-modal Semantic-Structural
Alignment Framework via LLMs and Graph Contrastive Learning for Fraud Detection
of Online Payment." Preprints.org, 2026.

Architecture per §III of the paper:
  Z_i_sem = MLP(LLM(P_i))                          # semantic branch (Eq. 1)
  h_i^{l+1} = σ(Σ_{j ∈ N(i)∪{i}} α_ij W^l h_j^l)   # structural branch (Eq. 2)
  y_i = Softmax(MLP(Z_i_sem ⊕ Z_i_str))            # joint head (Eq. 3)

Faithfulness notes
------------------
- Structural branch follows §III.B's 3-layer 256-hidden GCN with batch norm
  and dropout=0.3. Implemented in plain PyTorch on dense adjacency so the
  demo can run without torch_geometric. The attentive form of Eq. 2 reduces
  to standard GCN-style aggregation when α_ij = 1/sqrt(deg(i)*deg(j)), which
  is what we use here.
- Semantic branch in the paper uses ChatGLM3-6B with LoRA (r=16, α=32). We
  replace that fine-tuning loop with a pluggable `SemanticEncoder` interface.
  See `semantic.py` for two ready-made implementations: an OpenAI-compatible
  embeddings backend and a deterministic offline backend used by the demo.
- The contrastive alignment objective is implemented in `losses.py` as a
  symmetric InfoNCE / NT-Xent loss between aligned semantic and structural
  representations of the same node (positives) versus other nodes in the
  minibatch (negatives), with temperature τ.
- The joint classifier is a small MLP over the concatenation of the two
  branch embeddings, trained with cross-entropy.
"""

from __future__ import annotations

import math

import torch
import torch.nn as nn
import torch.nn.functional as F


class GCNLayer(nn.Module):
    """Dense-adjacency GCN layer with symmetric normalization.

    h' = σ(D^{-1/2} (A + I) D^{-1/2} h W)
    """

    def __init__(self, in_dim: int, out_dim: int) -> None:
        super().__init__()
        self.lin = nn.Linear(in_dim, out_dim, bias=False)
        self.bn = nn.BatchNorm1d(out_dim)

    def forward(self, h: torch.Tensor, A_norm: torch.Tensor) -> torch.Tensor:
        return self.bn(A_norm @ self.lin(h))


def normalize_adjacency(A: torch.Tensor) -> torch.Tensor:
    """Symmetric normalization with self-loops: D^{-1/2} (A + I) D^{-1/2}."""
    n = A.size(0)
    A_hat = A + torch.eye(n, device=A.device, dtype=A.dtype)
    deg = A_hat.sum(dim=1)
    d_inv_sqrt = torch.where(deg > 0, deg.pow(-0.5), torch.zeros_like(deg))
    D = torch.diag(d_inv_sqrt)
    return D @ A_hat @ D


class StructuralBranch(nn.Module):
    """Three-layer GCN, hidden 256, batch norm, dropout 0.3. Per §III.B."""

    def __init__(self, in_dim: int, hidden: int = 256, num_layers: int = 3, dropout: float = 0.3) -> None:
        super().__init__()
        layers = []
        prev = in_dim
        for _ in range(num_layers):
            layers.append(GCNLayer(prev, hidden))
            prev = hidden
        self.layers = nn.ModuleList(layers)
        self.dropout = nn.Dropout(dropout)
        self.out_dim = hidden

    def forward(self, h: torch.Tensor, A_norm: torch.Tensor) -> torch.Tensor:
        for i, layer in enumerate(self.layers):
            h = layer(h, A_norm)
            h = F.relu(h)
            if i < len(self.layers) - 1:
                h = self.dropout(h)
        return h


class SemanticBranch(nn.Module):
    """MLP head on top of pre-computed semantic embeddings from an LLM.

    Per Eq. 1: Z_i_sem = MLP(LLM(P_i)). The LLM call is performed externally
    (see semantic.py) so that this module is a pure-PyTorch graph of
    differentiable operations and can be exercised on CPU.
    """

    def __init__(self, embedding_dim: int, hidden: int = 256, out_dim: int = 256) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(embedding_dim, hidden),
            nn.ReLU(),
            nn.Linear(hidden, out_dim),
        )
        self.out_dim = out_dim

    def forward(self, llm_embeddings: torch.Tensor) -> torch.Tensor:
        return self.net(llm_embeddings)


class CSSA(nn.Module):
    """Joint CSSA model: semantic + structural + classifier head."""

    def __init__(
        self,
        struct_in_dim: int,
        semantic_emb_dim: int,
        hidden: int = 256,
        num_classes: int = 2,
        gcn_layers: int = 3,
        dropout: float = 0.3,
    ) -> None:
        super().__init__()
        self.structural = StructuralBranch(struct_in_dim, hidden=hidden, num_layers=gcn_layers, dropout=dropout)
        self.semantic = SemanticBranch(semantic_emb_dim, hidden=hidden, out_dim=hidden)
        self.head = nn.Sequential(
            nn.Linear(hidden * 2, hidden),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden, num_classes),
        )

    def encode(
        self, node_features: torch.Tensor, A_norm: torch.Tensor, llm_embeddings: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor]:
        z_str = self.structural(node_features, A_norm)
        z_sem = self.semantic(llm_embeddings)
        return z_sem, z_str

    def forward(
        self, node_features: torch.Tensor, A_norm: torch.Tensor, llm_embeddings: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        z_sem, z_str = self.encode(node_features, A_norm, llm_embeddings)
        joint = torch.cat([z_sem, z_str], dim=-1)
        logits = self.head(joint)
        return logits, z_sem, z_str
