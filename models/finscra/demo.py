"""Synthetic demo for the FinSCRA reference implementation.

This demo verifies:
  - The 7 reasoning chains all dispatch and return a verdict.
  - The fuzzy aggregation + centroid defuzzification produces a final
    risk verdict.
  - The pipeline degrades gracefully when no OPENAI_API_KEY is set
    (prints what would be called and exits with a clear message).

It does NOT reproduce the paper's Macro-F1 of 0.841 / Accuracy of 0.850
on the SCRD dataset. That requires (a) the SCRD corpus and (b) the
LoRA-tuned ChatGLM3-6B reasoner. See README for what was substituted.
"""

from __future__ import annotations

import json
import os
import sys

if __package__ in (None, ""):
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from finscra import LLMClient, run


# A synthetic supply-chain entity with a planted high-risk signal,
# inspired by the case study in §IV.D of the paper.
ENTITY = "Company B"
NEIGHBORS = ["Company A", "Company C", "Company D"]
CONTEXT = """\
Recent news (synthetic / illustrative):

[2026-03-04] Production-delay risk at Company A intensifies as upstream battery
supplier Company B reports a multi-day halt in lithium-cathode output. Company A
relies on Company B for product line P1, and replacement P1 inventory has a
limited time budget. Industry analysts note that Company B's raw-material P2 is
sourced from Company C, whose recent earnings release flagged investment
pressure from its parallel P3 division.

[2026-03-06] Company B confirmed payment delay to two minor suppliers and
acknowledged "supply shortage" affecting near-term deliveries. No restatement of
financial guidance has been issued yet.

[2026-03-07] Company C's quarterly filing indicates concentrated geographic
exposure and a binding allocation decision required within the next five days.
"""


def main() -> int:
    print("FinSCRA reference implementation — synthetic demo")
    print("=" * 60)
    print(f"Entity:    {ENTITY}")
    print(f"Neighbors: {NEIGHBORS}")
    print(f"Context length: {len(CONTEXT)} characters")
    print()

    if not os.environ.get("OPENAI_API_KEY"):
        print("OPENAI_API_KEY is not set. FinSCRA requires an LLM endpoint.")
        print("Set OPENAI_API_KEY (and optionally OPENAI_BASE_URL, OPENAI_MODEL)")
        print("before running this demo. Exiting cleanly.")
        return 0

    client = LLMClient()
    print(f"LLM endpoint: {client.base_url}")
    print(f"LLM model:    {client.model}")
    print()
    print("Running 7 reasoning chains ...")

    result = run(entity=ENTITY, context=CONTEXT, neighbors=NEIGHBORS, client=client)

    print()
    for r in result.chains:
        kw = r.hints.keywords[:5]
        print(f"  [{r.chain_id}] verdict={r.verdict:<7}  "
              f"sent={r.hints.sentiment or '-':<8}  "
              f"corr={r.hints.correlation or '-':<8}  "
              f"kw={kw}")

    print()
    print("Fused verdict:")
    print(f"  Final risk:    {result.verdict}")
    print(f"  Membership:    {json.dumps(result.fusion.aggregated, indent=2)}")
    print()
    print("Demo complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
