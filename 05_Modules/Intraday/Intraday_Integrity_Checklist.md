# Intraday — Integrity Checklist

## Data Invariants

- [x] **`computeAllocation()` handles zero holdings and zero open trades without crashing or producing NaN.** Confirmed by direct execution — all outputs cleanly zero.
- [x] **`computeChecklist()`'s return object always has exactly the same 3 boolean/numeric keys.** Confirmed by direct execution and key-set comparison — no conditional shape.
- [x] **Deployed capital only ever counts trades with `status === "Open"`.** Confirmed by direct execution with a mixed Open/Closed-Win/Closed-Loss dataset.
- [x] **Portfolio Value (IN-06) stays identical to Portfolio's own frozen total, since it now calls the same shared function rather than a second copy.** Confirmed by direct execution both before and after the fix.

## Validation Checks Not Yet Implemented

- No guard against `entryPrice === stopLoss` (zero-risk denominator) — produces `Infinity`, which currently passes the risk-reward checklist threshold. Not crashing, but a real, undecided business-rule question (see Recommendations).
- No position-size-vs-ceiling check at trade-entry time — a trade can be logged that immediately breaches the satellite ceiling, surfaced only afterward on the dashboard view, not blocked or flagged at entry.
- No realized P&L calculation exists anywhere, despite the frozen scope-decision document describing it as part of the design — a genuine specification-vs-implementation gap, not a calculation defect.

## Reconciliation Checks

- **`usedPct` and `overCeiling` are internally consistent** — confirmed by direct execution: `usedPct > 100` should always coincide with `overCeiling === true` when `ceilingAmount > 0` (both derive from the same `deployed` and `ceilingAmount` values, no intermediate divergence possible given the current single-pass calculation structure).
- **`deployed` used in IN-07 (Total Capital Base), IN-09 (Used %), and IN-10 (Over-Ceiling) is the exact same variable, computed once** — confirmed by reading `computeAllocation()`: no re-computation or re-fetch between these three uses, so they cannot silently drift from each other even as separate registry entries.
