# Contributing to Mine AI

Mine AI is a research-and-reference-implementation project for AI-enabled payment security, fraud detection, and AML/CFT compliance. Contributions are welcome — particularly:

- **Benchmark contributions.** Labeled samples, evaluation harnesses, or replication notes that strengthen the Phase I public benchmark dataset.
- **Reference-implementation reproductions.** Faithful reproductions of the CNN-LSTM, CSSA, or FinSCRA architectures referenced in the README.
- **Production-pattern write-ups.** Engineering notes on reconciliation, health-factor monitoring, oracle-manipulation defense, or related risk-control patterns — grounded in publicly observable systems.
- **Citation and corpus contributions to Module 3.** Additions to the open U.S. payment-security and AML/CFT source set.

## Ground rules

- **Public sources only.** Do not contribute proprietary code, internal documents, or non-public data.
- **No real customer data or real sanctioned-entity addresses in samples.** Synthetic or clearly redacted examples only.
- **Cite primary sources.** Federal statutes, agency guidance, and peer-reviewed publications are preferred over secondary commentary.
- **No legal, financial, tax, or compliance advice in code or docs.** Maintain the research-aid framing.

## Workflow

1. Open an issue describing the contribution before sending a large PR.
2. Keep PRs focused — one pattern doc, one model card, or one benchmark slice per PR.
3. Run `node bin/mineai.js --help` locally and confirm the CLI still parses.

## Code of conduct

Be respectful. Disagree on technical substance, not on people.
