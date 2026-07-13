# Portfolio — Verification Report

## Phase 2: Code Mapping

| Calculation | File | Function | Line(s) |
|---|---|---|---|
| FIN-P00 Current price resolution | `js/modules/portfolio.js` | `computeRow()` | 18 |
| FIN-P01 Current value | `js/modules/portfolio.js` | `computeRow()` | 19 |
| FIN-P02 Invested value | `js/modules/portfolio.js` | `computeRow()` | 20 |
| FIN-P03 Absolute gain | `js/modules/portfolio.js` | `computeRow()` | 21 |
| FIN-P04 Gain percentage | `js/modules/portfolio.js` | `computeRow()` | 22 |
| FIN-P05–P08 Portfolio totals | `js/modules/portfolio.js` | `computeSummary()` | 29–32 |
| FIN-P09 Sector allocation | `js/modules/portfolio.js` | `computeSummary()` | 34–38 |
| FIN-P10 Asset class allocation | `js/modules/portfolio.js` | `computeSummary()` | 39–43 |

**Supporting functions:** `WealthData.getSecurity(ticker)`, `WealthData.getFundamentals(ticker)`, `WealthData.getHoldings()` (data-model.js) — all read-only lookups, no calculation logic embedded in the data layer itself. Confirmed by reading `data-model.js` directly: the data model stores and returns raw fields only; every formula lives in `portfolio.js`.

**Data flow:** `WealthData.getHoldings()` → filter `active !== false` → `.map(computeRow)` → `computeSummary(rows)` → rendered into `#pf-summary`, `#pf-table-body` (desktop), `#pf-card-list` (mobile). Both display paths (table and card) read from the *same* `rows` array — confirmed by reading `renderList()`; there is no separate calculation path for mobile vs. desktop, only separate presentation of identical numbers.

**Implementation matches specification:** Yes, for all 10 documented calculations. Every formula in the specification was transcribed directly from the actual code, not inferred from comments or assumed from naming — read line-by-line before the specification was written.

## Phase 3: Numerical Verification

All test cases executed in Node against the actual `computeRow()` and `computeSummary()` functions (not reimplemented or approximated), via `/tmp/portfolio_verification_tests.js`.

| Test ID | Inputs | Expected | Actual | Diff | Result | Confidence |
|---|---|---|---|---|---|---|
| TC-001 | qty=50, avgCost=3850, price=4120 | value=206000, invested=192500, gain=13500, gain%=7.012987012987013 | value=206000, invested=192500, gain=13500, gain%=7.012987012987012 | gain%: 1e-15 (float representation only) | **PASS** | High |
| TC-002 | qty=10, avgCost=100, price=100 | all zero gain | all zero gain | 0 | **PASS** | High |
| TC-003 | qty=20, avgCost=500, price=400 (loss) | gain=−2000, gain%=−20 | gain=−2000, gain%=−20 | 0 | **PASS** | High |
| TC-004 | price=null (fallback) | value=invested=3750, gain=0 | value=invested=3750, gain=0 | 0 | **PASS** | High |
| TC-005 | qty=0 | all zero, no NaN | all zero, no NaN | 0 | **PASS** | High |
| TC-006 | qty=−10 (undefined use case) | N/A — no spec | gain%=+20% despite price rising against a "short" | N/A | **See PORT-P01 below** | Medium |
| TC-007 | qty=1,000,000, avgCost=5000 | value=5.1B, invested=5B, gain=100M | identical, exact | 0 | **PASS** | High |
| TC-008 | avgCost=333.33, price=333.34, qty=3 (float sensitivity) | gain=0.03 exactly | gain=0.029999999999972715 | ~2.7×10⁻¹⁴ | **PASS with documented float error** | High |
| TC-Summary-01 | 2 holdings, mixed sector/asset class | value=2000, invested=2000, gain=0, correct per-sector and per-asset-class grouping | identical, exact | 0 | **PASS** | High |

**On TC-008:** the ~2.7×10⁻¹⁴ discrepancy is standard IEEE 754 double-precision floating-point representation error (0.1 + 0.2 ≠ 0.3 exactly, in any language using this number format), not a defect in the application's logic. At this magnitude (14 decimal places below the ₹ unit), it has zero practical effect on any displayed value, since the UI rounds to 1–2 decimal places. Documented per the framework's requirement to report floating-point sensitivity even when immaterial, rather than omit it because it's small.

## Phase 5: Integrity Verification

| Check | Result | Evidence |
|---|---|---|
| Duplicate IDs | **No defect found** | `addHolding()` generates `id` via `Date.now() + Math.random()` — collision probability is negligible, not zero, but not observed in any test run. |
| Duplicate tickers | **Observation, not a defect** | The app permits adding the same ticker as multiple separate holding records (no merge-on-add logic exists — confirmed by reading `addHolding()`, which always pushes a new entry). This is not necessarily wrong (legitimate for multiple purchase lots at different prices), but the UI presents them as fully separate rows rather than a consolidated position, which could read as an error to an unfamiliar user. See Recommendations. |
| Broken references | **No defect found** | `computeRow()` calls `WealthData.getSecurity(ticker)` and `WealthData.getFundamentals(ticker)`, both of which return `undefined` gracefully for an unknown ticker (confirmed in this session's earlier Standalone Value Rule test) — no broken reference can crash this module. |
| Orphan records | **Not applicable in current schema** | Holdings don't require a parent record to exist; this is by design (Standalone Value Rule), not an integrity gap. |
| Allocation totals | **Verified** | `bySector` and `byAssetClass` sums independently equal `totalValue` in the summary test (1100+900=2000, matching totalValue=2000 exactly) — confirmed numerically, not assumed from the code structure alone. |
| Cash consistency | **Not applicable** | This module has no cash/liquidity tracking at all — holdings are the only tracked entity. Not a defect; simply out of current scope. |
| Impossible states | **Potential Defect — PORT-P01** | See below. |
| Import consistency | **Not yet tested** | Requires a full Import/Export round-trip test, which belongs to the Persistence module per the recommended verification order — flagged here, not tested prematurely. |

### PORT-P01 — Potential Defect: Negative quantity produces semantically incorrect gain sign
- **File:** `js/modules/portfolio.js`
- **Function:** `computeRow()`
- **Description:** If a holding is ever created with a negative `quantity` (no current UI path does this, but the function itself has no guard), the gain percentage formula produces a result with backwards sign semantics for what would be a short position — see TC-006: price rose from ₹100 to ₹120, and the function reports **+20% gain**, when a short-seller would have experienced a loss under those same numbers.
- **Reproduction:** `computeRow({ ticker: "X", quantity: -10, avgCost: 100, currentPrice: 120 })` → `gainPct: 20`.
- **Expected behavior:** Undefined — there is no specification for negative quantity, because the application has no short-selling feature.
- **Observed behavior:** A mathematically self-consistent but application-incorrect result if ever reached.
- **Severity:** Low in practice (no UI path creates this state today) — but real if the data model is ever extended, or if a future Import brings in a malformed record with a negative quantity.
- **Confidence:** High that the behavior occurs as described (verified numerically); Medium on real-world impact, since there's currently no way to trigger it through normal use.
- **Recommended fix:** Add an explicit guard rejecting or special-casing negative quantity at the `addHolding()` entry point, OR document explicitly that this application is long-only and any negative quantity is undefined behavior by design. See Recommendations for the specific proposal.
