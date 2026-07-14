# Portfolio — Regression Test Suite

**Permanent test file: `Portfolio_regression_tests.js`** — runnable via `node Portfolio_regression_tests.js` from the `wealth-suite/` directory (loads `data-model.js` and `portfolio.js` directly, no browser required). This file, not this markdown, is the authoritative test suite; the table below documents what it covers for human review.

**Legacy compatibility companion:** `06_Regression/Portfolio/Portfolio_active_compatibility_tests.js` verifies that new holdings omit `active`, legacy missing/true holdings remain included, legacy false holdings remain excluded, Portfolio and Intraday totals remain unchanged, and JSON backup round-tripping preserves each legacy state.

| Test ID | Purpose | Input | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| TC-001 | Normal-case gain calculation | qty=50, avgCost=3850, price=4120 | value=206000, gain=13500, gain%=7.0130% | Matches (float-level precision) | PASS |
| TC-002 | Zero-gain boundary (price = cost) | qty=10, avgCost=100, price=100 | gain=0, gain%=0 | Matches exactly | PASS |
| TC-003 | Loss case | qty=20, avgCost=500, price=400 | gain=−2000, gain%=−20% | Matches exactly | PASS |
| TC-004 | Missing price → fallback to avgCost | price=null | value=invested, gain=0 | Matches exactly | PASS |
| TC-005 | Zero quantity | qty=0 | all values zero, no NaN/Infinity | Matches exactly | PASS |
| TC-006 | Negative quantity (undocumented edge case) | qty=−10, rising price | Flagged as Potential Defect PORT-P01, not a pass/fail case | Sign-inverted result confirmed | **DOCUMENTED, NOT SPECIFIED** |
| TC-007 | Large-value precision | qty=1,000,000 | No precision loss at this scale | Matches exactly | PASS |
| TC-008 | Floating-point sensitivity | Fractional avgCost/price | ~2.7×10⁻¹⁴ IEEE 754 error, immaterial | Confirmed, documented | PASS (with documented float note) |
| TC-Summary-01 | Multi-holding aggregation, sector + asset class grouping | 2 holdings, different sectors/classes | Totals and group sums reconcile exactly | Matches exactly | PASS |

**Regression baseline for future changes:** any future edit to `computeRow()` or `computeSummary()` should be checked against this file before being considered complete. A change that alters any "Actual Result" above without a corresponding, deliberate specification update should be treated as a regression, not a feature.

**Coverage gaps, stated rather than hidden:** the original calculation suite does not cover multi-holding scenarios beyond 2 records or actual DOM rendering. The active-field companion now covers a 4-holding compatibility mix and JSON round-tripping; the actual Persistence export/import and DOM filtering paths were separately smoke-tested in headless Chrome on 2026-07-14.
