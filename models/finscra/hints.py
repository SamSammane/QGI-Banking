"""
Hint extractors for FinSCRA.

Per §III.C of the paper, FinSCRA mines three intermediate risk hints from
each entity's text context:

  h_sent  — overall sentiment from a credit-risk perspective
            (Positive / Neutral / Negative)
  h_corr  — strength of the financial-correlation signal connecting the
            target entity to its co-mentioned neighbors
            (Strong / Moderate / Weak / None)
  h_key   — set of risk-indicative keywords or phrases extracted from text
            (e.g., "production halt", "payment delay", "trade sanction")

These prompts intentionally match the wording in §III.C of the paper so a
LoRA-tuned ChatGLM3-6B (the paper's setup) and a general-purpose OpenAI-
compatible chat endpoint (this reference impl's substitution) produce
comparable structured outputs.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Iterable

from .llm import LLMClient


SYSTEM_PROMPT = (
    "You are FinSCRA, a financial credit-risk reasoning assistant. "
    "When asked, you return concise structured JSON. "
    "Never invent statutory text, agency findings, or specific financial figures "
    "that are not in the provided context. If the context does not support a "
    "judgment, say so explicitly."
)


@dataclass
class Hints:
    sentiment: str       # "Positive" | "Neutral" | "Negative" | "Unknown"
    correlation: str     # "Strong" | "Moderate" | "Weak" | "None" | "Unknown"
    keywords: list[str]


def _extract_json(text: str) -> dict:
    """Robust-ish JSON extraction: find the first {...} block."""
    m = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return {}


def extract_sentiment(client: LLMClient, entity: str, context: str) -> str:
    user = (
        f"Given the following financial news about {entity}:\n\n"
        f"{context}\n\n"
        "Assess the overall sentiment from a credit-risk perspective. "
        "Choose one of: Positive, Neutral, Negative. "
        'Respond ONLY with JSON of the form {"sentiment": "Positive|Neutral|Negative"}.'
    )
    raw = client.chat(SYSTEM_PROMPT, user)
    parsed = _extract_json(raw)
    val = str(parsed.get("sentiment", "Unknown")).strip().title()
    return val if val in {"Positive", "Neutral", "Negative"} else "Unknown"


def extract_correlation(
    client: LLMClient, entity: str, context: str, neighbors: Iterable[str]
) -> str:
    neighbor_list = ", ".join(neighbors) if neighbors else "(none)"
    user = (
        f"The news mentions the following companies related to {entity}: {neighbor_list}.\n\n"
        f"News content:\n{context}\n\n"
        f"Are any of these neighbors described as having financial difficulties that "
        f"might affect {entity}? Rate the overall correlation strength to {entity}'s "
        "credit risk as one of: Strong, Moderate, Weak, None. "
        'Respond ONLY with JSON of the form {"correlation": "Strong|Moderate|Weak|None"}.'
    )
    raw = client.chat(SYSTEM_PROMPT, user)
    parsed = _extract_json(raw)
    val = str(parsed.get("correlation", "Unknown")).strip().title()
    return val if val in {"Strong", "Moderate", "Weak", "None"} else "Unknown"


def extract_keywords(client: LLMClient, entity: str, context: str) -> list[str]:
    user = (
        f"Read the following financial news about {entity}:\n\n"
        f"{context}\n\n"
        "Extract up to 6 distinct short phrases (1–4 words each) that are risk-"
        "indicative for supply-chain or payment credit-risk analysis. Examples of "
        "the kind of phrase to extract: 'production halt', 'payment delay', "
        "'trade sanction', 'supplier concentration'. Return only phrases that "
        "are explicitly grounded in the text above. "
        'Respond ONLY with JSON of the form {"keywords": ["...", "..."]}.'
    )
    raw = client.chat(SYSTEM_PROMPT, user)
    parsed = _extract_json(raw)
    kws = parsed.get("keywords", [])
    if not isinstance(kws, list):
        return []
    return [str(k).strip() for k in kws if isinstance(k, str)][:6]


def extract_all_hints(
    client: LLMClient, entity: str, context: str, neighbors: Iterable[str]
) -> Hints:
    return Hints(
        sentiment=extract_sentiment(client, entity, context),
        correlation=extract_correlation(client, entity, context, neighbors),
        keywords=extract_keywords(client, entity, context),
    )
