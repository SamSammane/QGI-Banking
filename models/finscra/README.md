# FinSCRA Reference Implementation

A Python reproduction of the multi-chain LLM-reasoning framework introduced in:

> Pan, Chen, He, Yuan, Wang, Zhang. *FinSCRA: An LLM-Powered Multi-Chain Reasoning Framework for Interpretable Node Classification on Text-Attributed Graphs.* ICCECE 2026 (IEEE).

## What this is

A faithful, paper-grounded reference implementation of the three building blocks in §III of the paper:

1. **Three hint extractors** (`hints.py`) — `h_sent`, `h_corr`, `h_key` per §III.C, using the paper's prompts.
2. **Seven hierarchical reasoning chains** (`chains.py`) — `C1`–`C3` single-hint, `C4` parallel, `C5` cascading, `C6`–`C7` hybrid, per §III.C and Figure 1.
3. **Multi-chain decision fusion** (`fusion.py`) — per §III.D, fuzzy membership vectors → weighted aggregation → centroid defuzzification.

The orchestrator (`model.py::run`) runs all seven chains for a given entity and returns the fused verdict (`High` / `Medium` / `Low`) plus the full reasoning trace.

## Quickstart

```bash
# No third-party Python deps required; the only thing it talks to is your LLM.
export OPENAI_API_KEY=sk-...
export OPENAI_BASE_URL=https://api.openai.com/v1   # optional, any OpenAI-compatible
export OPENAI_MODEL=gpt-4o-mini                     # optional

python demo.py
```

The demo runs FinSCRA on a synthetic supply-chain case study (modeled on §IV.D of the paper) and prints the verdict from each of the seven chains plus the final fused verdict.

## Faithfulness notes

| Paper element | Implementation | Notes |
|---|---|---|
| Base reasoner: ChatGLM3-6B fine-tuned with LoRA (r=16, α=32) on QKV + output projection of every self-attention layer, 10 epochs, AdamW @ 2e-4 | OpenAI-compatible chat-completions endpoint in `llm.py` | The LoRA fine-tune requires a 12,000-example SCR instruction-tuning corpus and GPU memory not assumed for a reference impl. We substitute a generic chat endpoint and rely on the prompt structure to elicit the same hint format. The architecture and chain logic are unchanged. |
| Three hints: `h_sent`, `h_corr`, `h_key` | `hints.py` | Prompts mirror the wording in §III.C (e.g., the sentiment prompt is the verbatim "Given the following financial news about [Entity]: {Text Snippet}. Assess the overall sentiment from a credit risk perspective. Choose one: Positive, Neutral, Negative."). |
| Neighbor selection: up to 5 direct neighbors with highest textual co-occurrence | Pass-through `neighbors: list[str]` parameter | Co-occurrence ranking is left to the caller, who knows the graph structure of their domain. The demo passes a small synthetic neighbor list directly. |
| Textual context formation: concatenate titles + leading paragraphs of up to 5 most recent news items, ≤ 512 tokens | Caller responsibility | The demo's `CONTEXT` constant is constructed in this shape. |
| Seven reasoning chains C1–C7 | `chains.py::chain_c{1..7}_*` | All seven implemented and exported. `ALL_CHAINS` is the ordered list. |
| Multi-chain fusion: (a) raw answer → fuzzy membership u ∈ [0,1]^K, (b) weighted aggregation U_k = Σ w_i u_i,k / Σ w_i, (c) centroid defuzz A = argmax_k U_k | `fusion.py::fuse` | Aggregation and defuzz are direct from Eqs. 1–3. The mapping function `f(a_i, e_i) → u_i` is described in the paper as a small feedforward network trained on human-annotated fuzzy memberships; without that annotated corpus we use the interpretable rule set in `_membership_from_answer` instead. |
| Per-chain confidence weights w_i, optimizable on validation data | `weights: dict[str, float]` parameter to `model.run()` | Defaults to uniform when no prior preference exists, matching the paper. |

## What this implementation does NOT do

- **Does not LoRA-fine-tune ChatGLM3-6B.** The 12,000-example SCR instruction-tuning corpus is not part of the reference release. The architecture and reasoning logic are intact; only the upstream LLM is a general-purpose substitute.
- **Does not train the fuzzy-membership mapping function f(·).** That requires human-annotated fuzzy-membership labels. We use an interpretable rule-based mapping as a stand-in; everything downstream is faithful to the paper.
- **Does not reproduce the paper's Accuracy 0.850 / Macro-F1 0.841 on SCRD.** Those results require the SCRD corpus (not bundled) and the fine-tuned reasoner.
- **Does not bundle the SCRD or FinNews-Risk datasets.**

## Citation

```
@inproceedings{pan2026finscra,
  title     = {FinSCRA: An LLM-Powered Multi-Chain Reasoning Framework for Interpretable Node Classification on Text-Attributed Graphs},
  author    = {Pan, Pengfei and Chen, Lizi and He, Qi and Yuan, Keyu and Wang, Han and Zhang, Wenchao},
  booktitle = {Proceedings of the 2026 6th International Conference on Consumer Electronics and Computer Engineering (ICCECE)},
  year      = {2026},
  publisher = {IEEE},
  doi       = {10.1109/ICCECE69169.2026.11399797}
}
```
