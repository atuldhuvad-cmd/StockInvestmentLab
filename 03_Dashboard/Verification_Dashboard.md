# Wealth Intelligence Suite — Verification Dashboard
*The single source of truth for the verification program. Per Amendment 4: updated after every module freeze, not regenerated — appended or updated in place. This is the corrected v2 of this document: the initial version incorrectly used a global version counter (Fundamentals shown as v1.1). Per the correction, versioning is per-module and independent — Fundamentals is v1.0, the same as Portfolio, since both reached their frozen state on their first freeze event. Confirmed defects found and fixed *before* a module's first freeze are recorded as attributes of that v1.0 state (Fixed Defects: 4), not as a reason for a version bump. A version only increments when an *already-frozen* module is later reopened and changed.*

## Module Status

| Module | Verification Version | Status | Calculations | Verified | Open Defects | Fixed Defects | Frozen |
|---|---|---|---|---|---|---|---|
| Portfolio | v1.0 | ✅ Frozen | 10 | 10 | 0 | 0 | Yes |
| Fundamentals | v1.0 | ✅ Frozen | 10 | 10 | 0 | 4 | Yes |
| Delivery Screener | v1.0 | ✅ Frozen | 10 | 10 | 0 | 5 | Yes |
| Intraday | v1.0 | ✅ Frozen | 10 | 10 | 0 | 0 | Yes |
| Research | v1.0 | ✅ Frozen | 10 | 10 | 0 | 1 | Yes |
| Macro | v0.0 | Pending | – | 0 | – | – | No |
| Watchlist | v0.0 | Pending | – | 0 | – | – | No |
| Persistence / Import / Export | v0.0 | Pending | – | 0 | – | – | No |
| Settings | v0.0 | Pending | – | 0 | – | – | No |

**Note on Portfolio's calculation count (10, not 11):** the Financial Calculation Registry has 11 Portfolio rows (FIN-P00 through FIN-P10) because FIN-P00 (current-price fallback resolution) was registered as its own row. The original Financial Specification, however, documented it as a supporting business rule *within* FIN-P01, not as one of the "10 discovered calculations." This dashboard uses the original 10-calculation convention for consistency with the Specification and every prior narrative reference; the registry's 11-row count stands as-is since the registry is append-only and not retroactively edited. Flagged explicitly rather than silently picking one number without explanation.

**Note on Delivery Screener's "Open Defects" column:** of the 5 Phase 1A duplication findings, only 2 (FIN-D01, FIN-D05) have been proven Confirmed Defects by direct execution. The other 3 (FIN-D02, D03, D04) are assessed as the same defect class by code-pattern inspection but not yet independently execution-tested — reported honestly as "pattern-based," not folded into the confirmed count.

**Correction, 2026-07-13:** the Module Status table previously carried a stale duplicate row for Intraday (`v0.0 Pending`) left over from before its freeze — the correct `v1.0 ✅ Frozen` row already existed alongside it. Removed the stale row during a routine consistency check; no status, version, or metric actually changed as a result.

## Project Metrics

| Metric | Value | Method |
|---|---|---|
| Modules completed | 5 | Portfolio, Fundamentals, Delivery Screener, Intraday, Research — full lifecycle complete |
| Modules frozen | 5 | Same as above |
| Calculations discovered | 50 | 10 (Portfolio) + 10 (Fundamentals) + 10 (Delivery Screener) + 10 (Intraday, IN-01 through IN-10) + 10 (Research, RL-01 through RL-10) |
| Calculations verified | 50 | All five modules fully verified — 100% of currently-known calculations |
| Regression tests implemented | 91 | 9 (Portfolio) + 17 (Fundamentals) + 15 (Delivery Screener) + 18 (Intraday) + 32 (Research) — all counted by actually running the scripts |
| Regression tests passing | 91 / 91 | Confirmed by execution — all five suites currently exit 0, re-confirmed together in the same pass after Research's change |
| Confirmed defects (open) | 0 | All resolved |
| Confirmed defects (fixed) | 10 | FUND-D01–D04 (Fundamentals) + FIN-D01–D05 (Delivery Screener) + RL-D01 (Research). Intraday required zero fixes — its one duplication finding (IN-06) was caught and eliminated before it ever produced a defect. Note: RL-D01 is a different defect class from the others — an inert UI sort control (state captured but never read), not a duplicated-calculation drift case; it is not counted in "Implementation drift findings" below for that reason |
| Potential defects | 3 | PORT-P01 (Portfolio) + FIN-F08 (Fundamentals, FCF dead code) + IN-01 (Intraday, zero-risk Infinity case — mathematically defensible, practically ambiguous). Research has none |
| Implementation drift findings | 6 total ever found | 4 fully resolved in both behavior and code structure (FIN-D01–D04); 1 resolved in behavior only, still structurally separate (FIN-D05); 1 caught and fully resolved before ever producing a defect (IN-06, Intraday's Portfolio Value duplication). Research introduced zero duplicated financial logic (Phase 1A), so contributes nothing to this count |
| Shared calculations | 9 | F01, F02, F03, F05, F06, F07, F09, F10 (Fundamentals↔Delivery Screener) + IN-06 (Intraday↔Portfolio) — all now **Verified Consistent**. Research's reuse of `ListControls.filterAndSort()` (RL-10) is deliberately not counted here — it's a shared non-financial utility, not a shared *financial* calculation, consistent with this Registry's own scope (see `Research_CrossModule_Review.md`) |
| Shared calculations verified | 9 of 9 | 100% |
| Shared calculations with drift | 0 | Every duplication ever found across the project has been resolved — none currently open |
| NOT SPECIFIED business rules | 18 | 6 (Portfolio) + 3 (Fundamentals) + 2 (Delivery Screener) + 4 (Intraday) + 3 (Research: unused `aiAnalysis`/`sourceUrl` schema fields, no content-length limit, no duplicate-entry detection) |
| Integrity invariants verified | 21 of 24 checked | 7 of 10 (Portfolio + Fundamentals, unchanged) + 4 of 4 (Delivery Screener) + 4 of 4 (Intraday) + 6 of 6 (Research — empty-state safety, `undefined`-input safety, decision-field guard, sort-order fix, and two reconciliation checks) |
| Overall verification progress (by module) | 56% | 5 of 9 modules frozen |
| Overall verification progress (by known calculation) | 100% of known, 50 total so far | Every currently-discovered calculation is verified — the real remaining work is in the 4 modules not yet started |

## Shared Logic Coverage
*Watches technical debt shrink (or grow) over time as more modules are verified.*

| Shared Financial Logic | Count |
|---|---|
| Shared implementations | 4 (`latestRatios()`, `qualityScore()`, `detectRedFlags()` in `company-calculations.js` + `PortfolioModule.computeRow()`/`computeSummary()`, now also called by Intraday) |
| Duplicate implementations (ever found) | 6 (FIN-D01–D05 + IN-06) |
| Duplicate implementations eliminated | 5 (FIN-D01–D04 + IN-06 — Intraday's Portfolio Value duplication caught and fixed the same day it was found, before any defect occurred) |
| Remaining implementation drift | 1 (FIN-D05 — behavior fixed and correct; `subFactors` construction remains its own code path, not a call to `qualityScore()`) |

## Verification History
*Append-only. Never edit a past entry — corrections get a new dated row.*

| Date | Module | Version | Result |
|---|---|---|---|
| 2026-07-12 | Portfolio | v1.0 | Verified • Frozen |
| 2026-07-12 | Fundamentals | v1.0 | Fixed • Re-Verified • Frozen |
| 2026-07-12 | Fundamentals | v1.0 | Integrity Checklist correction — 2 stale pre-fix entries found and corrected during Dashboard metric compilation (Amendment 4). Does not change the frozen status or version; the underlying code was already correct, only the checklist document had not been updated to reflect it. Recorded here as a transparency entry, not a re-freeze. |
| 2026-07-12 | Delivery Screener | v0.1 | Phase 1A (Cross-Module Consistency Review) complete — 5 findings recorded, 2 proven Confirmed Defects by direct execution |
| 2026-07-12 | Delivery Screener | v1.0 | Fixed • Re-Verified • Frozen. All 5 findings (FIN-D01–D05) resolved: FIN-D01–D04 by eliminating duplication (shared `latestRatios()`), FIN-D05 by adding the missing per-factor guard. Zero regression against frozen Fundamentals (17/17 re-confirmed) and against all 10 real companies (identical scores/ranking). 15/15 new regression tests pass, 4/4 integrity checks pass. One design-consistency question left genuinely open (ROCE/D-E neutral-default vs. renormalization) — does not block freeze, per Portfolio/Fundamentals precedent |
| 2026-07-13 | Intraday | v1.0 | Verified • Frozen. Registry-first Phase 1A review caught one duplication (IN-06, Portfolio Value — an inline reimplementation of Portfolio's frozen total-value formula) before any specification was written. Confirmed behaviorally identical by direct execution, then fixed proactively — `computeAllocation()` now calls the shared, already-exported `PortfolioModule` functions directly — before the duplication ever produced an actual defect, so no Phase 6A Mandatory Defect Resolution Cycle was triggered. 18/18 new regression tests pass, all independently cross-checked against hand-derived expected values, not the code under test. All 3 previously-frozen modules re-run and confirmed unaffected (Portfolio 9/9, Fundamentals 17/17, Delivery Screener 15/15). Project regression total: 59/59 PASS. One Potential Defect recorded (IN-01, zero-risk `Infinity` case) and one real specification-vs-implementation gap found (P&L tracking described in the frozen scope document but never built) — both documented, neither blocking freeze |
| 2026-07-13 | Research | v1.0 | Fixed • Re-Verified • Frozen. Registry-first Phase 1A review found zero duplicated financial calculations (this module computes none) — but the same review, tracing `refresh()` ahead of writing the specification, surfaced RL-D01: the ticker-list "Sort: Newest first / Ticker A-Z" dropdown updated component state but was never read, so it had no effect on what was displayed. Proven by direct execution (not inferred from reading alone) using a dataset engineered so alphabetical and recency order diverge — both sort options produced the identical, always-alphabetical result before the fix. Phase 6A cycle completed: `computeTickerList()` now correctly branches on `sortKey`; Financial Specification, regression suite, and Registry all updated to reflect the fix, not overwritten silently. 32/32 new regression tests pass (one test-authoring flakiness issue found and corrected mid-pass — a timestamp-tie race in the test itself, not a product defect — see Verification Report). All 4 previously-frozen modules re-run and confirmed unaffected (Portfolio 9/9, Fundamentals 17/17, Delivery Screener 15/15, Intraday 18/18). Project regression total: 91/91 PASS. Standalone Value Rule re-confirmed by direct execution for a ticker with zero Fundamentals/Portfolio/Watchlist data. Three NOT SPECIFIED/NOT IMPLEMENTED gaps recorded (unused `aiAnalysis`/`sourceUrl` schema fields, no content-length limit, no duplicate-entry detection) — none blocking freeze |
