# On-Chain / Off-Chain Reconciliation

> **Module 2 — Production Risk-Control & Reconciliation Patterns.** Documentation only. No proprietary or protocol-specific code is included. The pattern is grounded in publicly observable DeFi engineering practice.

## Why this pattern exists

Fraud-detection, AML/CFT, and model-governance work all assume a trustworthy ledger. If the off-chain accounting system disagrees with on-chain state, downstream detectors operate on the wrong ground truth: false negatives become invisible, false positives become unreviewable, and audit responses lose evidentiary weight.

The reconciliation layer is what makes the rest of the stack defensible. In a regulated context (BSA, AMLA 2020, OCC/Fed/FDIC 2026 model-risk guidance), the reconciliation layer is typically a precondition to model validation and ongoing monitoring.

## What "reconciled" means

A single transaction is **reconciled** at time `t` if, for every observable attribute the system claims about it, an authoritative on-chain source agrees within an explicit tolerance:

- **Existence.** A backend record claiming a transaction `T` must correspond to a confirmed on-chain transaction with the same hash on the same chain.
- **Value.** Amount, asset, and direction (sender / recipient) must match.
- **Sequence.** Block height, timestamp, and (where relevant) intra-block order must match within a defined tolerance.
- **Effect.** Resulting balance and position changes must match a re-derivation from on-chain state.

A *batch* (a vault rebalance, a settlement window, a daily close) is reconciled if every constituent transaction is individually reconciled and the aggregate invariants hold (no value created or destroyed except by explicit fee / yield mechanisms).

## Components

```
+---------------------+        +-------------------+
|  On-chain indexer   | -----> |   Canonical event |
|  (per-chain)        |        |   stream          |
+---------------------+        +---------+---------+
                                         |
                                         v
+---------------------+        +-------------------+
|  Backend service    | -----> |   Backend event   |
|  (orderbook, vault, |        |   stream          |
|   ledger, etc.)     |        +---------+---------+
+---------------------+                  |
                                         v
                              +----------+----------+
                              |   Reconciler        |
                              |   (windowed match)  |
                              +----------+----------+
                                         |
                          +--------------+--------------+
                          |                             |
                          v                             v
                 +----------------+         +----------------------+
                 |   Reconciled   |         |   Drift / break      |
                 |   ledger view  |         |   queue (paged out)  |
                 +----------------+         +----------------------+
```

## Design choices that matter

1. **Pull the on-chain side from a deterministic re-derivation, not from a cache.** Re-derive balances and positions from indexed events, not from a snapshot of last-known state. Caches can lie; re-derivation cannot.
2. **Reconcile on event time, not wall-clock time.** Wall-clock alignment hides reorgs, finality gaps, and bridge-relay delays. Use the on-chain block timestamp (or finality height) as the anchor.
3. **Make tolerances explicit and reviewable.** Every numeric tolerance — value rounding, timestamp skew, fee absorption — should be a named, logged, and reviewable parameter, not a hard-coded magic constant.
4. **Keep the break queue first-class.** Unreconciled records are not garbage; they are the most operationally interesting records in the system. Page them, do not delete them.
5. **Distinguish "not yet reconciled" from "will not reconcile".** Pending finality is normal; structural divergence is an incident.

## Failure modes that this pattern guards against

- **Backend drift.** A backend service mutates internal state on user action but the corresponding on-chain transaction never confirms or reverts.
- **Reorg amnesia.** A backend treats a one-block confirmation as final and never re-checks after a reorg.
- **Cross-chain bridge ambiguity.** A bridge mints a wrapped asset on chain B but the lock on chain A is later disputed; without an explicit bridge-finality model, the off-chain ledger silently double-counts.
- **Fee accounting drift.** Small per-transaction fee rounding accumulates into material balance drift over millions of transactions; without invariant checks, this is invisible until an audit.

## Why it matters for AML/CFT detection

A graph-temporal detector trained on backend records will reproduce backend errors. If the reconciliation layer cannot prove that a flagged transaction actually settled on-chain with the claimed value and counterparty, the SAR-narrative chain breaks at the first regulator question. The reconciliation layer is what lets a detector say "this happened" rather than "this was recorded".

## Out of scope for this document

Specific protocol code, internal SLAs, and proprietary reconcilers are out of scope. The pattern is intentionally described at the architectural level so it can be adapted to any chain, ledger, or vault environment.

## Status

Pattern write-up shipped in v0.1. A reference reconciler scaffold and invariant-check harness are tracked under Roadmap Phase I.
