# Health-Factor Monitoring and Automated Rebalancing

> **Module 2 — Production Risk-Control & Reconciliation Patterns.** Documentation only. Grounded in publicly observable collateralized-lending and BTCFi-vault engineering practice. No proprietary code.

## Why this pattern exists

In a collateralized lending or vaulted-yield system, the *health factor* of a position summarizes its distance from liquidation. When the health factor crosses a configured threshold, the position is subject to forced unwinding — either by external liquidators paid in a discount (in most DeFi designs) or by an internal automated process.

Two failure modes occur when this layer is absent or weak:

1. **Liquidation cascades.** A volatility event pushes many positions below their thresholds at once, liquidations consume on-chain liquidity, slippage worsens, and more positions become eligible — a feedback loop that materially harms users.
2. **Stale-feed liquidations.** A position is liquidated on the basis of a price feed that did not reflect current market conditions; the position holder bears the loss of an event that, on a correct feed, would not have occurred.

A monitoring-and-rebalancing layer that is independent of the liquidation auction is what keeps a vault inside its stated risk profile through volatility.

## What "health factor" abstracts over

For a position with collateral value `C`, debt value `D`, and a liquidation-threshold ratio `L`:

```
health_factor = (C * L) / D
```

A health factor of `1.0` is the liquidation boundary. By construction, `health_factor < 1.0` means the position is liquidatable; `health_factor >= 1.0` means it is not. The vault's *target* operating range is strictly above `1.0`, with a margin chosen to absorb expected near-term volatility.

The values `C` and `D` are not directly observable — they are *derived* from a price feed and a debt accounting model. The monitoring pattern therefore must include both the health-factor signal and the provenance of every input that produced it.

## Components

```
+----------------------+      +---------------------+
| Position observer    | ---> | Health-factor       |
| (per chain / vault)  |      | computer            |
+----------------------+      +----------+----------+
                                         |
                +------------------------+------------------------+
                |                        |                        |
                v                        v                        v
        +---------------+        +---------------+        +---------------+
        | Headroom band |        | Warning band  |        | Action band   |
        | (no action)   |        | (alert + plan)|        | (rebalance)   |
        +---------------+        +---------------+        +-------+-------+
                                                                  |
                                                                  v
                                                        +-----------------+
                                                        | Rebalance plan  |
                                                        | (multi-step,    |
                                                        |  bounded slip)  |
                                                        +-----------------+
```

## Design choices that matter

1. **Three bands, not a single threshold.** The *headroom band* is the normal operating range. The *warning band* triggers alerting, plan generation, and reduced position growth. The *action band* triggers an automated rebalance well before the liquidation threshold. Single-threshold designs leave no operational margin.
2. **Rebalance to a target health factor, not "as much as needed".** Specify a target `HF*` for post-rebalance state. This bounds the rebalance size and prevents over-correction during noisy feeds.
3. **Bound per-step slippage and total slippage budget.** A multi-step rebalance plan should declare its maximum acceptable slippage per step and across the plan. If either is exceeded, the plan pauses for human review rather than continuing to bleed.
4. **Reject rebalances on suspect feeds.** If the price-feed validator (see `oracle-defense` notes elsewhere) flags an input as suspect, the rebalance does not execute; the alerting path is escalated instead. A bad rebalance is worse than no rebalance.
5. **Log every input.** Every health-factor evaluation logs (chain, block, feed version, feed timestamp, collateral basis, debt basis, threshold ratio, result). This is the audit substrate the model-governance layer needs.

## Failure modes that this pattern guards against

- **Cliff liquidations.** Positions sitting at `HF = 1.001` until a single tick crosses the threshold.
- **Feed-spike liquidations.** A momentary price-feed spike forces a rebalance or liquidation that would not have occurred under the correct price.
- **Cascade-amplifying rebalances.** A vault's own rebalance contributes to the volatility that triggered the rebalance.
- **Silent threshold drift.** Configuration updates to the liquidation threshold ratio are applied without logging or replay-against-history, leading to a different operating profile than the documented one.

## Why it matters for the larger payment-security stack

A vaulted-yield system is, from a user perspective, a payment surface: deposits go in, withdrawals come out, and balance changes between those events must be defensible. The health-factor-monitoring layer is what gives downstream fraud and AML/CFT detectors a stable foundation: balance changes can be attributed to known causes (yield, fees, rebalances on logged inputs) rather than to silent unsafe state.

## Out of scope for this document

Specific protocol parameters, vault token economics, and proprietary risk models are out of scope. The pattern is described at the architectural level so it can be adapted to any collateralized lending or vault environment.

## Status

Pattern write-up shipped in v0.1. A reference monitor + rebalance-planner scaffold is tracked under Roadmap Phase I.
