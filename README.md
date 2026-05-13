# Mine AI

**Open-Source Reference Implementations for AI-Enabled Payment Security, Fraud Detection, and AML/CFT Compliance**

```
 __  __ _            _    ___
|  \/  (_)_ __   ___| |  |_ _|
| |\/| | | '_ \ / _ \ |   | |
| |  | | | | | |  __/ |   | |
|_|  |_|_|_| |_|\___|_|  |___|
```

---

## What this is

Mine AI is an open-source toolkit and command-line workspace for advancing AI-enabled payment-security, fraud-detection, AML/CFT compliance, and risk-control infrastructure for U.S.-accessible digital-asset and blockchain-based payment systems — through graph-temporal deep-learning models, production-grade transaction reconciliation and risk controls, and LLM-powered interpretable compliance reasoning.

It is structured as three independently usable modules that together cover the detection layer, the operational risk-control layer, and the interpretability/compliance-reasoning layer of a modern payment-security stack.

This is **research and reference-implementation infrastructure**, not a production fraud-detection product and not financial, legal, or compliance advice.

---

## Why this exists

Payment fraud and digital-asset-enabled financial crime are documented U.S. national-scale risk channels.

- **FBI IC3 2025 Annual Report** reports approximately **$11.367 billion** in cryptocurrency-related losses and approximately **$8.649 billion** in investment-fraud losses in 2025.
- **FinCEN National AML/CFT Priorities** identify cybercrime (with virtual-currency considerations) and fraud as significant AML/CFT threats.
- **OFAC** has designated cryptocurrency mixing and cross-chain laundering infrastructure as sanctions targets, including Tornado Cash and Blender.
- **Executive Order 14178** (January 23, 2025) directs the development of a federal digital-asset regulatory framework covering market structure, oversight, consumer protection, and risk management.
- **Anti-Money Laundering Act of 2020** (Public Law 116-283, Title LXIV) modernized BSA-driven AML enforcement.
- **OCC / Federal Reserve / FDIC 2026 revised interagency model-risk-management guidance** emphasizes model development, validation, monitoring, governance, controls, and third-party model review — explicitly acknowledging further work on banks' use of generative and agentic AI.
- **2024 Critical and Emerging Technologies List** identifies artificial intelligence, large language models, distributed ledger technologies, digital assets, and digital payment technologies as priority areas.

Industry detection systems still rely heavily on rule-based heuristics — address blacklists, transaction-velocity thresholds, simple graph-search, and manual investigation workflows. These approaches struggle with the severe class imbalance characteristic of fraud datasets, the graph-structured and temporal nature of payment networks, and the interpretability requirements of regulated compliance review. Mine AI exists to make better methods reproducible and inspectable in the open.

---

## Architecture

Mine AI is organized as three modules that map to the detection, operations, and compliance-reasoning layers of a payment-security stack:

```
+-----------------------------------------------------------------+
|  Module 3 — LLM-Powered Interpretable Compliance Reasoning      |
|    RAG over BSA / FinCEN / OFAC / EO 14178 corpus               |
|    Interpretable chain-of-thought traces for review workflows   |
+-----------------------------------------------------------------+
                              ^
                              |
+-----------------------------------------------------------------+
|  Module 1 — Graph-Temporal Fraud Detection Models               |
|    CNN-LSTM hybrid (BDICN 2026)                                 |
|    CSSA cross-modal alignment (LLM + graph contrastive)         |
|    FinSCRA multi-chain interpretable reasoning                  |
+-----------------------------------------------------------------+
                              ^
                              |
+-----------------------------------------------------------------+
|  Module 2 — Production Risk-Control & Reconciliation Patterns   |
|    On-chain / off-chain reconciliation reference                |
|    Health-factor monitoring + automated rebalancing patterns    |
|    Adversarial-execution and oracle-manipulation defense notes  |
+-----------------------------------------------------------------+
```

If detection models cannot trust the underlying ledger state (Module 2), their outputs are unreliable; if their outputs cannot be explained (Module 3), they are difficult to operate in regulated workflows. The three modules are designed to be used together but can be adopted independently.

---

## Module 1 — Graph-Temporal Fraud Detection Models

Reference implementations of three published or peer-citable architectures for payment-fraud and AML/CFT detection on blockchain payment data. The PyTorch / Python source for each architecture lives in [`models/`](./models/) — see [`models/README.md`](./models/README.md) for the directory map and per-model faithfulness notes.

### CNN-LSTM hybrid for blockchain payment fraud
- **Paper:** *Detection of Blockchain Online Payment Fraud Via CNN-LSTM*, BDICN 2026 (5th International Conference on Big Data, Information and Computer Network), ACM Digital Library, **DOI [10.1145/3801228.3801323](https://doi.org/10.1145/3801228.3801323)**.
- The CNN component captures local structural patterns in graph-derived transaction features; the LSTM component captures temporal dependencies in transaction sequences. The hybrid is engineered to address the imbalanced-dataset problem through targeted sampling and loss-weighting strategies described in the paper.
- Methodologically distinct from standalone GNN classifiers (which lack temporal sensitivity) and standalone recurrent classifiers (which lack graph-structural inductive bias).

### CSSA — Cross-Modal Semantic-Structural Alignment
- **Preprint:** Zhao, Yuan, Wang, Shen, Huang. *CSSA: A Cross-Modal Semantic-Structural Alignment Framework via LLMs and Graph Contrastive Learning for Fraud Detection of Online Payment.* Preprints.org, 2026. DOI [10.20944/preprints202602.0543.v1](https://doi.org/10.20944/preprints202602.0543.v1).
- Integrates LLM semantic representations with graph-contrastive structural representations through a unified contrastive objective. Addresses the gap left by separate semantic (NLP-on-memos) and structural (GNN-on-graph) models that lack aligned cross-modal representation.

### FinSCRA — LLM-Powered Multi-Chain Reasoning
- **Paper:** Pan, Chen, He, Yuan, Wang, Zhang. *FinSCRA: An LLM-Powered Multi-Chain Reasoning Framework for Interpretable Node Classification on Text-Attributed Graphs.* ICCECE 2026 (IEEE), **DOI [10.1109/ICCECE69169.2026.11399797](https://doi.org/10.1109/ICCECE69169.2026.11399797)**.
- Introduces explicit chain-of-thought reasoning over heterogeneous on-chain entities. Interpretability-by-construction, designed to be operable in BSA / model-governance workflows where black-box graph classifiers struggle.

### Intended use
```bash
# Inspect the model card / paper / feature snapshot via the CLI
mineai detect --model cnn-lstm --input ./samples/btc-fraud-sample.json

# Or run the actual reference PyTorch implementation (CPU, seconds)
cd models/cnn_lstm && pip install -r requirements.txt && python demo.py
cd models/cssa     && pip install -r requirements.txt && python demo.py
cd models/finscra  && python demo.py   # needs OPENAI_API_KEY
```

---

## Module 2 — Production Risk-Control & Reconciliation Patterns

A documentation and reference-pattern library for the operational substrate that fraud-detection models depend on. Sourced from publicly observable DeFi-engineering patterns; **does not republish any proprietary protocol code**.

Covers:
- **On-chain / off-chain reconciliation** — connecting smart-contract state with backend accounting so that downstream detectors have reliable ground truth.
- **Health-factor monitoring and automated rebalancing** — patterns for collateralized lending and BTCFi vault environments.
- **Adversarial-execution defense** — engineering notes on MEV-aware execution paths.
- **Oracle-manipulation defense** — design patterns for price-feed validation and circuit-breakers.
- **Liquidation-cascade resilience** — operational notes informed by publicly reported cascade events.

```bash
# Generate a reconciliation-pattern scaffold
mineai pattern reconciliation --chain sui --output ./my-recon-app/

# Browse the pattern catalog
mineai pattern list
```

---

## Module 3 — LLM-Powered Interpretable Compliance Reasoning

A retrieval-augmented reasoning workbench over public U.S. payment-security and AML/CFT corpora. Designed to produce **traceable, citation-grounded reasoning** rather than opaque classifications.

Corpus (open sources only):
- Bank Secrecy Act (31 U.S.C. § 5311 *et seq.*)
- FinCEN National AML/CFT Priorities and ransomware-related BSA materials
- OFAC sanctions designations (including Tornado Cash, Blender)
- Treasury 2024 National Strategy for Combating Terrorist and Other Illicit Financing
- Anti-Money Laundering Act of 2020
- OCC / Federal Reserve / FDIC 2026 revised model-risk-management guidance
- Executive Order 14178
- 2024 Critical and Emerging Technologies List

```bash
# Ask an interpretable, citation-grounded compliance-research question
mineai reason "What BSA documentation expectations apply to a U.S. MSB
               offering on-chain swap aggregation across multiple chains?"

# Inspect the underlying reasoning trace
mineai reason --trace last
```

**This module produces research-grade reasoning aids. It does not file SARs, render legal opinions, or replace qualified compliance counsel.**

---

## Quick Start

### Prerequisites

[Node.js 20](https://nodejs.org/en/download) or higher.

### Install

```bash
npm install -g @mine-ai/mine-ai
mineai --version
```

### Bring your own model

Mine AI is model-agnostic and does not ship with a hosted inference service. Point it at any OpenAI-compatible endpoint you already have access to:

```bash
export OPENAI_API_KEY="..."
export OPENAI_BASE_URL="https://your-endpoint/v1"
export OPENAI_MODEL="your-model-id"
```

---

## Roadmap

The roadmap maps to the technical agenda this project exists to support.

### Phase I — Benchmarks & Pattern Documentation (0–6 months)
- Publish a public benchmark dataset of labeled digital-asset payment-fraud and AML/CFT cases, sourced from public on-chain data, OFAC sanctions designations, and open fraud reports.
- Release three production-pattern technical write-ups covering reconciliation, health-factor monitoring, and BTCFi-vault smart-contract integration.
- Publish a benchmark-methodology technical report; target dissemination venue includes the NeurIPS Datasets & Benchmarks Track.

### Phase II — Architecture Refinement & Adversarial Robustness (6–12 months)
- Extend the CNN-LSTM, CSSA, and FinSCRA architectures with adversarial-robustness evaluation, ablation studies, and replication on the Phase-I benchmark.
- Target peer-review venues: AAAI, IJCAI, IEEE Symposium on Security and Privacy, Financial Cryptography and Data Security, KDD, ACL Industry Track, EMNLP, NeurIPS, ICML.
- Add adversarial-execution defense, oracle-manipulation defense, and liquidation-cascade-resilience benchmarking to Module 2.

### Phase III — Dissemination (12+ months)
- Public workshops, open-source reference releases, and standards or public-comment contributions where appropriate.
- Outreach to compliance, RegTech, digital-asset risk, and model-governance practitioner communities.

---

## What this is NOT

- **Not a yield-farming, staking, or mining tool.** Mine AI uses digital-asset systems as a *payment-data environment for studying fraud and risk*, not as an investment opportunity.
- **Not a node-deployment helper.** Earlier iterations of this repository focused on validator and node operations; that scope has been retired.
- **Not financial, legal, tax, or compliance advice.**
- **Not a production SAR-filing or sanctions-screening system.** Outputs are research aids that require qualified human review before any regulated use.
- **Not a hosted service.** There is no paid SaaS tier, no required signup, and no proprietary API.

---

## References

### Methods
- Yuan, Lin, Wu, Chang. *Detection of Blockchain Online Payment Fraud Via CNN-LSTM.* BDICN 2026, ACM Digital Library. DOI [10.1145/3801228.3801323](https://doi.org/10.1145/3801228.3801323).
- Zhao, Yuan, Wang, Shen, Huang. *CSSA: A Cross-Modal Semantic-Structural Alignment Framework via LLMs and Graph Contrastive Learning for Fraud Detection of Online Payment.* Preprints.org, 2026. DOI [10.20944/preprints202602.0543.v1](https://doi.org/10.20944/preprints202602.0543.v1).
- Pan, Chen, He, Yuan, Wang, Zhang. *FinSCRA: An LLM-Powered Multi-Chain Reasoning Framework for Interpretable Node Classification on Text-Attributed Graphs.* ICCECE 2026 (IEEE). DOI [10.1109/ICCECE69169.2026.11399797](https://doi.org/10.1109/ICCECE69169.2026.11399797).

### U.S. policy and regulatory sources
- FBI IC3 Annual Reports (2024, 2025).
- FinCEN National AML/CFT Priorities.
- OFAC sanctions designations (Tornado Cash; Blender).
- Treasury, *2024 National Strategy for Combating Terrorist and Other Illicit Financing*.
- Anti-Money Laundering Act of 2020 (Public Law 116-283, Title LXIV).
- Executive Order 14178 (January 23, 2025), *Strengthening American Leadership in Digital Financial Technology*.
- OCC / Federal Reserve / FDIC, 2026 revised interagency model-risk-management guidance.
- White House / NSTC, *2024 Critical and Emerging Technologies List*.
- Bank Secrecy Act, 31 U.S.C. § 5311 *et seq.*

---

## Contributing

Contributions are welcome — particularly benchmark contributions, reference-implementation reproductions, and pattern write-ups grounded in publicly observable systems. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[LICENSE](./LICENSE)
