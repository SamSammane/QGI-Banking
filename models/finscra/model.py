"""FinSCRA orchestrator: runs the seven reasoning chains and fuses them."""

from __future__ import annotations

from dataclasses import dataclass

from .chains import ALL_CHAINS, ChainResult
from .fusion import FusionOutput, fuse
from .llm import LLMClient


@dataclass
class FinSCRAResult:
    entity: str
    verdict: str
    fusion: FusionOutput
    chains: list[ChainResult]


def run(
    entity: str,
    context: str,
    neighbors: list[str],
    client: LLMClient | None = None,
    weights: dict[str, float] | None = None,
    chains: list[str] | None = None,
) -> FinSCRAResult:
    """Run FinSCRA on a single entity.

    Parameters
    ----------
    entity     : entity name / id (used in prompts)
    context    : concatenated textual context for the entity (titles + leading
                 paragraphs of up to 5 most-recent news items; <= 512 tokens,
                 matching §III.C of the paper)
    neighbors  : up to 5 most-co-mentioned neighboring entities
    client     : LLMClient; defaults to environment-configured client
    weights    : optional per-chain confidence weights {C1..C7 -> float}
    chains     : optional subset of chain IDs to run (default: all seven)
    """
    client = client or LLMClient()
    wanted = set(chains) if chains else None

    results: list[ChainResult] = []
    for chain_id, fn in ALL_CHAINS:
        if wanted and chain_id not in wanted:
            continue
        results.append(fn(client, entity, context, neighbors))

    fusion = fuse(results, weights=weights)
    return FinSCRAResult(entity=entity, verdict=fusion.verdict, fusion=fusion, chains=results)
