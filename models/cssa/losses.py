"""
Cross-modal contrastive alignment loss for CSSA.

The paper specifies a contrastive objective that aligns each node's semantic
representation with its structural representation while pushing apart different
nodes. We implement this as a symmetric InfoNCE / NT-Xent loss with temperature
τ, computed on a minibatch of N nodes:

    L_align = -1/N Σ_i [ log σ_i^{sem→str} + log σ_i^{str→sem} ] / 2

where
    σ_i^{sem→str} = exp(sim(z_i_sem, z_i_str) / τ)
                  / Σ_j exp(sim(z_i_sem, z_j_str) / τ)

and sim is cosine similarity. This is the standard cross-modal NT-Xent used
across CLIP, ALIGN, and downstream graph-LLM alignment work.
"""

from __future__ import annotations

import torch
import torch.nn.functional as F


def info_nce(z_a: torch.Tensor, z_b: torch.Tensor, tau: float = 0.1) -> torch.Tensor:
    """Symmetric InfoNCE between two aligned modalities.

    z_a, z_b: (batch, dim). Positives are on the diagonal.
    """
    z_a = F.normalize(z_a, dim=-1)
    z_b = F.normalize(z_b, dim=-1)
    logits = z_a @ z_b.t() / tau
    labels = torch.arange(z_a.size(0), device=z_a.device)
    loss_ab = F.cross_entropy(logits, labels)
    loss_ba = F.cross_entropy(logits.t(), labels)
    return (loss_ab + loss_ba) / 2.0


def joint_loss(
    logits: torch.Tensor,
    labels: torch.Tensor,
    z_sem: torch.Tensor,
    z_str: torch.Tensor,
    alignment_weight: float = 0.5,
    tau: float = 0.1,
    class_weight: torch.Tensor | None = None,
) -> tuple[torch.Tensor, dict]:
    """Cross-entropy classification loss + contrastive alignment loss."""
    ce = F.cross_entropy(logits, labels, weight=class_weight)
    align = info_nce(z_sem, z_str, tau=tau)
    total = (1.0 - alignment_weight) * ce + alignment_weight * align
    return total, {"ce": float(ce.item()), "align": float(align.item()), "total": float(total.item())}
