"""
Seven hierarchical reasoning chains for FinSCRA, per §III.C of the paper.

Chains:
  C1  Single-hint(sentiment)            — h_sent only
  C2  Single-hint(correlation)          — h_corr only
  C3  Single-hint(keywords)             — h_key only
  C4  Parallel multi-hint               — h_sent, h_corr, h_key extracted
                                          independently, concatenated for
                                          final judgment
  C5  Cascading multi-hint              — h_sent first; use h_sent as context
                                          to extract h_corr; use both as
                                          context to extract h_key; final
                                          judgment uses all three
  C6  Hybrid: sentiment+correlation     — sentiment and correlation jointly
                                          guide keyword extraction
  C7  Hybrid: correlation+keywords      — correlation and keywords jointly
                                          guide sentiment-conditioned judgment

Each chain returns a `ChainResult` containing:
  - the final risk verdict (High / Medium / Low) as a string
  - a brief explanation
  - the underlying hints used
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Callable, Iterable

from .hints import (
    Hints,
    SYSTEM_PROMPT,
    extract_sentiment,
    extract_correlation,
    extract_keywords,
)
from .llm import LLMClient


RISK_LEVELS = ("High", "Medium", "Low")


@dataclass
class ChainResult:
    chain_id: str
    verdict: str                         # "High" | "Medium" | "Low" | "Unknown"
    explanation: str
    hints: Hints
    raw_answer: str = ""


def _extract_verdict(text: str) -> tuple[str, str]:
    """Pull a (verdict, explanation) pair out of a JSON-ish answer."""
    m = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if m:
        try:
            obj = json.loads(m.group(0))
            verdict = str(obj.get("risk", obj.get("verdict", "Unknown"))).strip().title()
            explanation = str(obj.get("explanation", "")).strip()
            if verdict in RISK_LEVELS:
                return verdict, explanation
        except json.JSONDecodeError:
            pass
    # Fallback: keyword match
    for level in RISK_LEVELS:
        if re.search(rf"\b{level}\b", text, flags=re.IGNORECASE):
            return level, text.strip()[:300]
    return "Unknown", text.strip()[:300]


def _verdict_from_hints(client: LLMClient, entity: str, context: str, *, used: dict) -> tuple[str, str, str]:
    """Ask the LLM for a credit-risk verdict given the assembled hints."""
    used_str = "\n".join(f"  {k}: {v}" for k, v in used.items() if v not in ("", [], None))
    user = (
        f"Entity under review: {entity}\n\n"
        f"Context (excerpt):\n{context}\n\n"
        f"Pre-extracted hints:\n{used_str or '  (none)'}\n\n"
        "Based on the hints and context above, assign a credit-risk category. "
        "Choose one of: High, Medium, Low. Also provide a one-sentence explanation "
        "that cites which hint(s) drove the verdict. "
        'Respond ONLY with JSON of the form '
        '{"risk": "High|Medium|Low", "explanation": "..."}.'
    )
    raw = client.chat(SYSTEM_PROMPT, user)
    verdict, explanation = _extract_verdict(raw)
    return verdict, explanation, raw


def chain_c1_sentiment_only(
    client: LLMClient, entity: str, context: str, neighbors: Iterable[str]
) -> ChainResult:
    sent = extract_sentiment(client, entity, context)
    hints = Hints(sentiment=sent, correlation="", keywords=[])
    verdict, expl, raw = _verdict_from_hints(client, entity, context, used={"sentiment": sent})
    return ChainResult("C1", verdict, expl, hints, raw)


def chain_c2_correlation_only(
    client: LLMClient, entity: str, context: str, neighbors: Iterable[str]
) -> ChainResult:
    corr = extract_correlation(client, entity, context, neighbors)
    hints = Hints(sentiment="", correlation=corr, keywords=[])
    verdict, expl, raw = _verdict_from_hints(client, entity, context, used={"correlation": corr})
    return ChainResult("C2", verdict, expl, hints, raw)


def chain_c3_keywords_only(
    client: LLMClient, entity: str, context: str, neighbors: Iterable[str]
) -> ChainResult:
    kws = extract_keywords(client, entity, context)
    hints = Hints(sentiment="", correlation="", keywords=kws)
    verdict, expl, raw = _verdict_from_hints(client, entity, context, used={"keywords": kws})
    return ChainResult("C3", verdict, expl, hints, raw)


def chain_c4_parallel(
    client: LLMClient, entity: str, context: str, neighbors: Iterable[str]
) -> ChainResult:
    sent = extract_sentiment(client, entity, context)
    corr = extract_correlation(client, entity, context, neighbors)
    kws = extract_keywords(client, entity, context)
    hints = Hints(sentiment=sent, correlation=corr, keywords=kws)
    verdict, expl, raw = _verdict_from_hints(
        client, entity, context,
        used={"sentiment": sent, "correlation": corr, "keywords": kws},
    )
    return ChainResult("C4", verdict, expl, hints, raw)


def chain_c5_cascading(
    client: LLMClient, entity: str, context: str, neighbors: Iterable[str]
) -> ChainResult:
    sent = extract_sentiment(client, entity, context)
    sent_aware_context = f"Sentiment-summary: {sent}.\n{context}"
    corr = extract_correlation(client, entity, sent_aware_context, neighbors)
    corr_aware_context = f"Sentiment={sent}, Correlation={corr}.\n{context}"
    kws = extract_keywords(client, entity, corr_aware_context)
    hints = Hints(sentiment=sent, correlation=corr, keywords=kws)
    verdict, expl, raw = _verdict_from_hints(
        client, entity, context,
        used={"sentiment": sent, "correlation": corr, "keywords": kws},
    )
    return ChainResult("C5", verdict, expl, hints, raw)


def chain_c6_hybrid_sent_corr(
    client: LLMClient, entity: str, context: str, neighbors: Iterable[str]
) -> ChainResult:
    sent = extract_sentiment(client, entity, context)
    corr = extract_correlation(client, entity, context, neighbors)
    guided_context = f"Sentiment={sent}, Correlation={corr}.\n{context}"
    kws = extract_keywords(client, entity, guided_context)
    hints = Hints(sentiment=sent, correlation=corr, keywords=kws)
    verdict, expl, raw = _verdict_from_hints(
        client, entity, context,
        used={"sentiment": sent, "correlation": corr, "keywords": kws},
    )
    return ChainResult("C6", verdict, expl, hints, raw)


def chain_c7_hybrid_corr_key(
    client: LLMClient, entity: str, context: str, neighbors: Iterable[str]
) -> ChainResult:
    corr = extract_correlation(client, entity, context, neighbors)
    kws = extract_keywords(client, entity, context)
    guided_context = f"Correlation={corr}, Keywords={kws}.\n{context}"
    sent = extract_sentiment(client, entity, guided_context)
    hints = Hints(sentiment=sent, correlation=corr, keywords=kws)
    verdict, expl, raw = _verdict_from_hints(
        client, entity, context,
        used={"sentiment": sent, "correlation": corr, "keywords": kws},
    )
    return ChainResult("C7", verdict, expl, hints, raw)


ALL_CHAINS: list[tuple[str, Callable]] = [
    ("C1", chain_c1_sentiment_only),
    ("C2", chain_c2_correlation_only),
    ("C3", chain_c3_keywords_only),
    ("C4", chain_c4_parallel),
    ("C5", chain_c5_cascading),
    ("C6", chain_c6_hybrid_sent_corr),
    ("C7", chain_c7_hybrid_corr_key),
]
