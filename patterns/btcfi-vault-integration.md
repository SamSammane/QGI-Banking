# BTCFi Vault Smart-Contract Integration

> **Module 2 — Production Risk-Control & Reconciliation Patterns.** Documentation only. Grounded in publicly observable BTCFi-vault and Sui-based DeFi engineering practice. No proprietary code is reproduced; no protocol-specific addresses, parameters, or strategy weights are included.

## Why this pattern exists

A BTCFi vault is a yield-generating wrapper around Bitcoin (or a Bitcoin-pegged asset such as LBTC) that exposes deposit, withdraw, rebalance, and accounting operations through smart contracts on a separate execution chain. The vault must reconcile a user's deposit-side view with the strategy-side view and with the on-chain custody state — all without leaking the strategy parameters that make the vault economically distinct from a passive wrapper.

Two classes of failure are common in poorly integrated vault systems:

1. **Accounting drift between user shares and underlying assets.** The user holds vault shares that imply a fractional claim on underlying assets; if rebalance accounting and fee handling are not airtight, the implied claim diverges from the actual underlying.
2. **Operational coupling between custody and strategy.** A bug in the strategy contract leaks into custody state, or a bug in the custody contract corrupts strategy accounting. Without a clear boundary, an audit cannot scope either side independently.

This pattern describes how to integrate the vault's three operational concerns — *deposits and withdrawals*, *strategy execution and rebalancing*, *risk monitoring* — without coupling them into a single failure domain.

## Three layers, three boundaries

```
+------------------------------------------------------------+
| Layer 3: Risk monitoring                                   |
|   - Health-factor signal (see health-factor-monitoring.md) |
|   - Reconciliation status (see onchain-offchain-recon.md)  |
|   - Pause / circuit-breaker authority                      |
+----------------------------+-------------------------------+
                             |
+----------------------------+-------------------------------+
| Layer 2: Strategy execution                                |
|   - Rebalances between lending markets                     |
|   - Yield accrual and fee capture                          |
|   - Bounded by parameters set in Layer 1                   |
+----------------------------+-------------------------------+
                             |
+----------------------------+-------------------------------+
| Layer 1: Custody and shares                                |
|   - User deposits and withdrawals                          |
|   - Share issuance, redemption, transfer                   |
|   - Authoritative source of "how much underlying"          |
+------------------------------------------------------------+
```

## Design choices that matter

1. **The custody layer is the authoritative ledger of user claims.** Strategy contracts never compute user-share entitlements directly; they call into the custody layer and receive read-only views. This is the boundary that lets an external audit scope user-fund safety without auditing the strategy logic in the same pass.
2. **Rebalances are bounded by named parameters.** Strategy actions declare, at construction time, what they are allowed to do — which lending markets, what minimum and maximum allocation per market, what maximum per-transaction notional, what minimum health-factor floor. These bounds are enforced at the custody-layer boundary, not inside the strategy.
3. **Withdrawals always have a non-strategy path.** If the strategy layer is paused, halted, or under incident review, withdrawals can still process from custody held in a safe state (typically a reserve buffer or the underlying asset itself). Users are never trapped behind a strategy incident.
4. **Health-factor and reconciliation signals can pause rebalances but not withdrawals.** The risk-monitoring layer's authority is asymmetric: it can stop new strategy actions, but it cannot freeze user redemption of already-reconciled claims.
5. **Every cross-layer call is logged at the integration boundary.** Layer-2 → Layer-1 calls and Layer-3 → Layer-2 calls emit structured events that the reconciliation pipeline consumes. Internal layer calls do not need this level of logging; cross-layer calls always do.

## Failure modes that this pattern guards against

- **Share dilution by strategy bug.** A rebalance burns shares it should not, or mints shares it should not; the custody-layer boundary catches the unauthorized state change.
- **Stuck withdrawals during strategy halts.** Users cannot exit because the strategy contract owns the underlying; the reserve-buffer path prevents this.
- **Audit-scope explosion.** Without clear boundaries, a security audit must treat the entire system as one contract; with boundaries, the high-stakes custody surface can be audited intensively and the strategy surface audited separately.
- **Silent parameter drift.** Strategy parameters are changed by privileged action without emitting a logged event consumed by reconciliation; observers cannot tell when the operating profile changed.

## Why it matters for the larger payment-security stack

A BTCFi vault is a payment-adjacent surface: BTC value flows in and out, and the auditability of those flows is a precondition for any downstream fraud or AML/CFT analysis. The integration pattern described here is what allows the vault's transaction history to be reconstructible, attributable, and explainable — which in turn is what allows it to be analyzed at all.

## Out of scope for this document

Specific lending markets, strategy weights, fee schedules, and protocol-internal accounting are out of scope. The pattern is described at the architectural level so it can be adapted to any BTC-pegged-asset vault environment.

## Status

Pattern write-up shipped in v0.1. A reference vault-integration scaffold (custody-boundary types, parameter-bounded strategy interface, reserve-buffer withdrawal path) is tracked under Roadmap Phase I.
