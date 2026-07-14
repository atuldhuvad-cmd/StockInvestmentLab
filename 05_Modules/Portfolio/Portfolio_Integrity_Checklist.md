# Portfolio — Integrity Checklist

Standing invariants for this module. Re-run this checklist after any future change to Portfolio or the shared data model.

## Data Invariants

- [ ] **Every holding has a `ticker`, `quantity`, and `avgCost`.** Enforced at entry (`render()`'s add-handler rejects if any is missing), but **not enforced at the data-model layer** — `WealthData.addHolding()` itself performs no validation. A holding could be added programmatically (e.g., via a future Import feature) without these fields, and `computeRow()` would likely throw rather than fail gracefully. **Status: gap, not yet a defect** — no current code path creates this state, but nothing prevents a future one from doing so.
- [ ] **`quantity` and `avgCost` are non-negative.** **Not currently enforced anywhere.** See PORT-P01 in the Verification Report.
- [x] **Legacy `active` values remain backward compatible.** New holdings omit the optional field. Both Portfolio and Intraday use `h.active !== false`, so missing and `true` remain included while an imported legacy `active: false` holding remains excluded.
- [x] **Sum of per-sector values equals total portfolio value.** Verified numerically in the regression suite (TC-Summary-01) — not just assumed from the grouping logic.
- [x] **Sum of per-asset-class values equals total portfolio value.** Same verification as above.

## Validation Checks Not Yet Implemented (documented as gaps, not silently assumed absent)

- No check preventing duplicate ticker entries as separate holdings (Observation, see Verification Report).
- No check on `purchaseDate` being a real, non-future date.
- No check on `currentPrice` being a plausible value (e.g., not negative) — a negative `currentPrice` would silently produce a negative `currentValue` with no warning.
- No cross-check against `WealthData.securities` to confirm a ticker is a recognized/valid symbol — by design, per the Standalone Value Rule (this is correct behavior, not a gap).

## Reconciliation Checks

- **Portfolio total value = Σ(sector allocations) = Σ(asset class allocations).** Verified in this pass (TC-Summary-01). This should be re-checked any time the grouping logic in `computeSummary()` changes.
- **No holding contributes to a total it isn't included in** — confirmed by reading the single shared `rows` array used for all three totals (overall, sector, asset class); there's no code path where a holding could be counted in one grouping and excluded from another.
