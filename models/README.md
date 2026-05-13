# Mine AI — Reference Model Implementations

Faithful, paper-grounded reference implementations of the three architectures referenced in the project README. Each directory is self-contained, has its own `requirements.txt`, and ships a runnable synthetic demo so you can verify forward-pass correctness on CPU without obtaining the original training datasets.

These implementations are **architectural reproductions**, not the original trained models. Where the papers describe training infrastructure that is impractical for a hobbyist machine (4×V100 / multi-day fine-tuning runs), the demos make defensible substitutions that are documented in the per-model README.

| Directory | Paper | Status |
|---|---|---|
| [`cnn_lstm/`](./cnn_lstm/) | Yuan, Lin, Wu, Chang — *Detection of Blockchain Online Payment Fraud Via CNN-LSTM*, BDICN 2026 (ACM, [DOI 10.1145/3801228.3801323](https://doi.org/10.1145/3801228.3801323)) | Model + SMOTE pipeline + economic-threshold optimizer + synthetic demo |
| [`cssa/`](./cssa/) | Zhao, Yuan, Wang, Shen, Huang — *CSSA: A Cross-modal Semantic-Structural Alignment Framework via LLMs and Graph Contrastive Learning for Fraud Detection of Online Payment*, Preprints.org 2026 | Dual-branch model (GCN + OpenAI-compatible semantic encoder) + contrastive alignment loss + synthetic demo |
| [`finscra/`](./finscra/) | Pan, Chen, He, Yuan, Wang, Zhang — *FinSCRA: An LLM-Powered Multi-Chain Reasoning Framework for Interpretable Node Classification on Text-Attributed Graphs*, ICCECE 2026 (IEEE) | 7 reasoning chains + 3 hint extractors + fuzzy aggregation + centroid defuzzification + synthetic supply-chain demo |

## How the implementations relate to the papers

Each per-model `README.md` includes a **"Faithfulness notes"** section that calls out, line by line, where the implementation matches the paper's tables and where it makes a practical substitution. The substitutions are concentrated in three areas:

1. **LLM-as-encoder substitution.** Both CSSA and FinSCRA originally fine-tune ChatGLM3-6B with LoRA (`r=16, α=32`). The reference implementations skip the fine-tune and use an OpenAI-compatible embedding / chat endpoint instead. The hooks for LoRA fine-tuning are documented but not bundled.
2. **Dataset substitution.** The original datasets (Elliptic Bitcoin Dataset, 2.84M e-commerce transactions, SCRD/FinNews-Risk) are either subject to license / access constraints or large. The demos generate small synthetic data with the same shape so that forward passes are reproducible end-to-end on a laptop.
3. **Training-scale substitution.** Where papers describe 150-epoch / 4×V100 / multi-GPU regimes, the demos do a handful of epochs on CPU to verify the loss decreases and gradients flow. Real benchmarking is part of Roadmap Phase I.

## Quickstart

```bash
# Each model directory is independent. Pick one:
cd models/cnn_lstm   && pip install -r requirements.txt && python demo.py
cd models/cssa       && pip install -r requirements.txt && python demo.py
cd models/finscra    && pip install -r requirements.txt && python demo.py  # needs OPENAI_API_KEY
```

`cnn_lstm` and `cssa` demos run fully offline on CPU. `finscra` demo makes a real LLM call (configurable to OpenAI, Together, OpenRouter, a local vLLM/Ollama, or any OpenAI-compatible endpoint).

## What these implementations are NOT

- Not the trained-weights checkpoints from the papers — those were trained on infrastructure that is not part of this open-source release.
- Not production fraud detectors. They are pedagogical and benchmark-seed implementations.
- Not financial, legal, or compliance advice.
- Not a replacement for primary-source review of the papers themselves.
