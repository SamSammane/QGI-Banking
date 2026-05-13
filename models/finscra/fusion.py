"""
Multi-chain decision fusion via fuzzy aggregation + centroid defuzzification.

Per §III.D of the paper:

  1. Each chain C_i emits a raw answer (a_i, e_i).
  2. A mapping function f converts (a_i, e_i) into a fuzzy membership vector
     u_i ∈ [0, 1]^K, where K is the number of risk categories.
  3. Aggregate across N chains by weighted average:
        U_k = Σ_i w_i · u_{i,k} / Σ_i w_i
  4. Centroid defuzzification:
        A = argmax_k U_k

Faithfulness notes
------------------
- The paper trains `f` as a small feedforward network on human-annotated
  fuzzy membership labels. Without that annotated corpus, this reference
  implementation derives membership degrees from the textual answer +
  explanation using a small, interpretable rule set described in
  `_membership_from_answer`. This is the substitution; everything downstream
  (weighted aggregation, centroid defuzz) is faithful to Eqs. 1–3.
- Weights w_i default to uniform (the paper allows this when "no prior
  preference exists").
"""

from __future__ import annotations

from dataclasses import dataclass

from .chains import ChainResult, RISK_LEVELS


# Confidence cues we look for in the explanation text. These are deliberately
# coarse: the goal is a defensible default until annotated fuzzy-membership
# data exists to train f(·) the way the paper specifies.
HIGH_CUES = ("explicit", "clear", "strong", "directly", "confirmed")
LOW_CUES = ("possibly", "may", "might", "weak", "unclear", "if")


def _membership_from_answer(verdict: str, explanation: str) -> dict[str, float]:
    """Map a chain's (verdict, explanation) into u ∈ [0, 1]^K."""
    u = {k: 0.05 for k in RISK_LEVELS}  # diffuse prior
    if verdict in RISK_LEVELS:
        u[verdict] = 0.7
    else:
        # Unknown verdict: uniform with mild Medium bias
        u["Medium"] += 0.2

    text = explanation.lower()
    high_score = sum(1 for c in HIGH_CUES if c in text)
    low_score = sum(1 for c in LOW_CUES if c in text)
    if verdict in RISK_LEVELS:
        # Bump self-confidence per high cue, drain per low cue, then redistribute.
        adj = 0.05 * (high_score - low_score)
        u[verdict] = max(0.05, min(0.95, u[verdict] + adj))

    # Add a small probability mass to neighbors of the chosen verdict
    if verdict == "High":
        u["Medium"] = max(u["Medium"], 0.20)
    elif verdict == "Low":
        u["Medium"] = max(u["Medium"], 0.20)
    elif verdict == "Medium":
        u["High"] = max(u["High"], 0.15)
        u["Low"] = max(u["Low"], 0.15)

    # Normalize
    total = sum(u.values()) or 1.0
    return {k: v / total for k, v in u.items()}


@dataclass
class FusionOutput:
    verdict: str
    aggregated: dict[str, float]
    per_chain: list[dict]


def fuse(
    results: list[ChainResult],
    weights: dict[str, float] | None = None,
) -> FusionOutput:
    if not results:
        return FusionOutput("Unknown", {k: 0.0 for k in RISK_LEVELS}, [])

    weights = weights or {}
    agg = {k: 0.0 for k in RISK_LEVELS}
    weight_sum = 0.0
    per_chain: list[dict] = []

    for r in results:
        w = float(weights.get(r.chain_id, 1.0))
        u = _membership_from_answer(r.verdict, r.explanation)
        per_chain.append({
            "chain": r.chain_id,
            "verdict": r.verdict,
            "weight": w,
            "membership": u,
            "explanation": r.explanation,
            "hints": {
                "sentiment": r.hints.sentiment,
                "correlation": r.hints.correlation,
                "keywords": r.hints.keywords,
            },
        })
        for k in RISK_LEVELS:
            agg[k] += w * u[k]
        weight_sum += w

    if weight_sum > 0:
        agg = {k: v / weight_sum for k, v in agg.items()}

    verdict = max(RISK_LEVELS, key=lambda k: agg[k])
    return FusionOutput(verdict=verdict, aggregated=agg, per_chain=per_chain)
