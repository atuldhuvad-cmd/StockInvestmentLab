# Fundamentals — Verification Report

## Phase 2: Code Mapping — Verification Coverage Matrix

| Function | Specification | Tests | Status |
|---|---|---|---|
| `latestRatios()` — ROE | FIN-F01 | TC-F01, TC-F02, TC-F03 | Verified (normal/zero) / **Confirmed Defect** (negative equity) |
| `latestRatios()` — ROCE | FIN-F02 | TC-F01 | Verified (normal case only — negative `capEmployed` not separately tested, same guard pattern as ROE, same risk class) |
| `latestRatios()` — Debt/Equity | FIN-F03 | TC-F01 | Verified (normal case only, same guard-pattern risk as ROE) |
| `latestRatios()` — Net Margin | FIN-F04 | TC-F11a, TC-F11b (added during this pass to close the gap) | Verified — same truthy-guard pattern confirmed to share the identical risk class as ROE (negative revenue not excluded, e.g. revenue=−1000/netProfit=200 → −20% shown with no warning) |
| `latestRatios()` — Revenue CAGR | FIN-F05 | TC-F01, TC-F05, TC-F06 | Verified (normal case) / **Confirmed Defect** (zero and negative first-year revenue) |
| `latestRatios()` — EPS | FIN-F06 | TC-F07 | Verified |
| `latestRatios()` — P/E | FIN-F07 | TC-F07 | Verified |
| `latestRatios()` — FCF | FIN-F08 | TC-F04 | **Confirmed Defect** (no guard) — and confirmed dead code (never displayed) |
| `CompanyCalculations.qualityScore()` | FIN-F09 | TC-F08 | Verified (normal case, implicit from Portfolio-session Bajaj Finance runs) / **Confirmed Defect** (missing sub-factor) |
| `CompanyCalculations.detectRedFlags()` | FIN-F10 | TC-F10 | Verified — matches the established Bajaj Finance baseline (4 flags) from every prior run this session |

**Net Margin (FIN-F04) update:** initially left as NOT VERIFIED in the first pass through this report, since it shares ROE's exact truthy-guard code pattern but hadn't been independently executed. Closed within the same verification pass rather than left open — TC-F11a/b added and run, confirming Net Margin shares the identical negative-value gap as ROE (revenue=−1000 with netProfit=200 shows −20% with no warning, same class of issue as FUND-D01). This is now folded into the same defect family, not a separate open item.

## Phase 3: Numerical Verification — Summary

Full detail in `Fundamentals_regression_tests.js` (executable, run directly — not reimplemented here). 14 of 14 executed assertions passed, where "pass" means *matches the actual, current behavior of the production code* — several of those passes are intentionally documenting confirmed defects as a regression baseline, not asserting the behavior is correct. This distinction is stated explicitly in the test file's own summary output, not left implicit.

## Phase 5: Integrity Verification

| Check | Result | Evidence |
|---|---|---|
| Missing financial statements | **Handled inconsistently** — see FUND-D01 through FUND-D04 below. Some fields guard gracefully to `null`, others silently produce `NaN`/`Infinity`. |
| Division-by-zero handling | **Partially handled.** ROE/ROCE/D-E/Net Margin/EPS all guard their direct denominator being zero. Revenue CAGR does **not** guard its internal division (`latest.revenue / first.revenue`) before applying the fractional power — confirmed, FUND-D02. |
| NaN/Infinity prevention | **Confirmed gap.** Neither the calculation layer nor the display layer (`fmt()`) checks for `NaN` or `Infinity` — only `null`/`undefined`. Both propagate to the UI as literal text. |
| Duplicate fundamentals records | **Not applicable in current schema** — `WealthData.fundamentals` is a plain object keyed by ticker; a second `upsertFundamentals()` call for the same ticker overwrites rather than duplicates, by construction of `Object` key semantics in JavaScript. No duplicate-record state is reachable. |
| Missing ticker references | **No defect found** — `renderDetail()` is only ever called with a ticker already confirmed present in `fundamentals` (via the filtered ticker list), so `WealthData.getFundamentals(ticker)` returning `undefined` is not a reachable state in the current render flow. Worth noting this safety comes from the *caller's* discipline, not a guard inside `renderDetail()` itself — if a future change calls `renderDetail()` directly with an arbitrary ticker, it would crash on `fundamentals.years` being undefined. |
| Banking/non-banking classification | **Confirmed: cosmetic only, not calculational** — see FIN-F04's business rules note. The `isBank` flag changes a warning message, not any formula. This may be intentional (avoiding an over-engineered separate bank-ratio model) or may be an incomplete feature — **NOT SPECIFIED** which, and therefore not classified as a defect. |
| Required financial fields | **Not enforced anywhere in this module.** `latestRatios()` will attempt its calculations on whatever fields exist, guarding some, not others (see above). No upfront validation step confirms a `years` entry has all expected fields before calculations run. |
| Impossible states | **Confirmed Defect — see FUND-D01, FUND-D02, FUND-D03** below. |
| Cross-record consistency | **Not tested this pass** — would require multi-ticker comparison logic that doesn't currently exist in this module (each ticker is evaluated independently, by design). Not applicable to a single-ticker calculation module. |

### FUND-D01 — Confirmed Defect: Negative total equity/revenue produces a meaningless but plausible-looking ratio (ROE, ROCE, Debt/Equity, Net Margin)
- **File:** `js/modules/fundamentals.js`, **Function:** `latestRatios()`, lines 34–38 (ROE, ROCE, Debt/Equity, Net Margin all share the identical truthy-guard pattern)
- **Evidence:** `latestRatios({ years: [...with totalEquity: -2000, netProfit: 500...] })` → `roe: -25`. **Confirmed to extend to Net Margin as well**, tested explicitly within this pass: `latestRatios({ years: [...with revenue: -1000, netProfit: 200...] })` → `netMargin: -20`, with no warning or exclusion. Both reproduced deterministically in `Fundamentals_regression_tests.js` (TC-F03, TC-F11b).
- **Expected behavior:** Undefined by the module's own documentation — no business rule exists for negative equity.
- **Observed behavior:** A company with *positive* net profit (₹500 Cr) and *negative* equity (a real, if distressed, balance-sheet state) shows a *negative* 25% ROE — actively misleading, since the sign of the displayed number suggests unprofitability when the company is actually profitable but balance-sheet-impaired.
- **Cross-reference:** This exact defect class was found and **fixed** in the separate Python screening engine (`screening-engine-v1.py`, Fix 6, from this session's earlier audit) — `totalEquity > 0` was required there, not just truthy. That fix was never carried over to this JavaScript module, since the two are structurally similar but were built at different times and never reconciled. **This is a confirmed cross-module inconsistency, not merely an isolated gap.**
- **Severity:** Medium — real distressed-company data (not a purely theoretical input) would trigger this, and the output actively misleads rather than showing a clear "not available."
- **Confidence:** High.

### FUND-D02 — Confirmed Defect: Zero first-year revenue produces "Infinity%" as literal UI text
- **File:** `js/modules/fundamentals.js`, **Function:** `latestRatios()` (calculation) and `renderDetail()`'s `fmt()` helper (display)
- **Evidence:** `latestRatios({ years: [...with first year revenue: 0...] })` → `revenueCagr: Infinity`. `fmt(Infinity, "%")` → the string `"Infinity%"`, confirmed by direct execution.
- **Observed behavior:** A user would see the literal text "Infinity%" rendered in the Revenue CAGR cell — an obviously broken display state, not just an internal data problem.
- **Severity:** Medium — a company with zero revenue in its earliest recorded year is unusual but not impossible (e.g., a newly-listed company, or incomplete historical data entry).
- **Confidence:** High.

### FUND-D03 — Confirmed Defect: Negative first-year revenue produces "NaN%" as literal UI text
- **File/Function:** Same as FUND-D02.
- **Evidence:** `latestRatios({ years: [...with first year revenue: -5000...] })` → `revenueCagr: NaN` (JavaScript's `Math.pow` of a negative base with a fractional exponent is `NaN` by language specification). `fmt(NaN, "%")` → the string `"NaN%"`, confirmed by direct execution.
- **Severity:** Low — negative revenue is not a realistic real-world input for this field, but the module has no validation preventing a data-entry error from producing this exact broken state.
- **Confidence:** High.

### FUND-D04 — Confirmed Defect: `qualityScore()` has no guard against a missing sub-factor
- **File:** `js/company-calculations.js`, **Function:** `qualityScore()`
- **Evidence:** A qualitative object missing even one of its 7 expected fields (e.g., `managementQuality: undefined`) produces `NaN` for the entire score. Confirmed by direct execution, TC-F08.
- **Impact scope:** This function is shared between Fundamentals **and** Delivery Screener (confirmed via the dedup performed during the Product Completion Phase) — a single missing field on any company's qualitative data would silently break the quality score display (and, in Delivery Screener, the Overall Score and Rating derived from it) in **two modules simultaneously**, not just one.
- **Severity:** Medium-High, specifically because of the shared-function blast radius — this is worse than an isolated single-module gap.
- **Confidence:** High.

---

## Post-Fix Addendum — 2026-07-12

All four Confirmed Defects (FUND-D01, D02, D03, D04) have been fixed and re-verified. This addendum documents the fix; the sections above remain as the original finding record and are not rewritten, per the framework's audit-trail principle.

| Defect | Fix | Re-verification |
|---|---|---|
| FUND-D01 | ROE, ROCE, Debt/Equity, Net Margin now require their denominator strictly positive (`&& > 0`), not merely truthy. Mirrors the identical fix already applied to `screening-engine-v1.py` earlier this session. | TC-F03 updated to assert `null` (was `-25`); TC-F11b updated to assert `null` (was `-20`). Both pass. |
| FUND-D02 / FUND-D03 | Revenue CAGR now requires `first.revenue > 0` before computing. Additionally, `fmt()` (the display layer) now treats `NaN`/`Infinity` the same as `null`/`undefined` — defense-in-depth against any future non-finite result, not just this one. | TC-F05 updated to assert `null` (was `Infinity`); TC-F06 updated to assert `null` (was `NaN`). Both pass. |
| FUND-D04 | `qualityScore()` now excludes missing sub-factors and renormalizes over whatever is present, returning `null` only if all 7 are missing. The display layer (`renderDetail()`) updated to handle a `null` quality score gracefully (shows "—"). | TC-F08 updated to assert the renormalized value `83.33` (was `NaN`); new TC-F08b added for the all-missing edge case, asserting `null`. Both pass. |

**Regression safety, confirmed by real execution, not assumed:** all 10 real companies' ROE and Quality Score values were re-checked against this session's established baseline values post-fix — zero change to any of them (none had negative equity/revenue or missing qualitative fields, so none were ever affected by the defects; the fix only changes behavior for inputs that were already producing broken output).

**Explicitly not fixed this pass:** FIN-F08 (FCF)'s missing guard. This was classified as a **Potential Defect** in `Fundamentals_Recommendations.md`, not one of the four **Confirmed** Defects — it's dead code (computed, never displayed), so no user-facing harm was ever confirmed. Left as an open item for a future pass, not silently dropped.

**Cross-module note carried forward, not fixed here:** Delivery Screener's `businessQualityPillar()` independently constructs its own per-factor `subFactors` array for the Top-3-Strengths/Risks display, bypassing the `qualityScore()` fix above. A missing qualitative field would still produce a `NaN`-scored sub-factor entry there. This is flagged explicitly for Delivery Screener's own upcoming verification pass — not fixed here, per the module-boundary discipline established for this framework ("do not revisit... unless a newly discovered defect requires it" — this is a *related* issue in a *different, not-yet-verified* module, not a Fundamentals defect requiring Fundamentals to reopen).

**Module status: Fundamentals is now FROZEN, 2026-07-12.**

