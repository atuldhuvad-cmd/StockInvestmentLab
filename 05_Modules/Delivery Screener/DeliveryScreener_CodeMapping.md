# Delivery Screener — Phase 2: Code Mapping
*Ordered by dependency level (per `DeliveryScreener_Dependency_Graph.md`), not by file line order — verifying DS-04 before DS-03 is resolved would prove nothing about correctness, only internal consistency with a known-wrong input.*

## Verification Coverage Matrix

| Level | Calculation | File | Function | Line | Specification | Tests | Status |
|---|---|---|---|---|---|---|---|
| 0 | DS-03 Shared Ratios | `js/modules/delivery-screener.js` | `computeCandidate()` | 137–145 | DeliveryScreener_Financial_Specification.md §DS-03 | Duplication audit (Finding 2) — 1 executed, 3 pending | **Blocking — must resolve first** |
| 0 | DS-01 Business Quality (score) | `js/company-calculations.js` | `qualityScore()`, called at line 35 | 34–35 | §DS-01 | Inherits FIN-F09's suite (`Fundamentals_regression_tests.js` TC-F08, TC-F08b) | Verified (no new work needed — already frozen in Fundamentals) |
| 0 | DS-02 Business Quality (subFactors) | `js/modules/delivery-screener.js` | `businessQualityPillar()` | 36–44 | §DS-02 | Duplication audit (Finding 3) — 1 executed | **Confirmed Defect — pending fix** |
| 0 | DS-06 Technical Trend | `js/modules/delivery-screener.js` | `technicalTrendPillar()` | 81–83 | §DS-06 | Not yet formally tested (trivial — constant return, low risk) | Verified (by inspection — no formula to break) |
| 1 | DS-04 Financial Strength | `js/modules/delivery-screener.js` | `financialStrengthPillar()` | 49–60 | §DS-04 | Not yet executed — blocked on DS-03 | **Pending — blocked** |
| 1 | DS-05 Fair Value Gap | `js/modules/delivery-screener.js` | `valuationPillar()` | 63–78 | §DS-05 | Not yet executed — blocked on DS-03 and DS-01 | **Pending — blocked** (DS-01 side is actually resolved; DS-03 side still blocks) |
| 1 | DS-07 Risk | `js/modules/delivery-screener.js` | `riskPillar()` | 88–98 | §DS-07 | Red-flag sub-calc inherits FIN-F10's suite; D/E-extremity sub-calc not yet tested — blocked on DS-03 | **Pending — blocked** |
| 2 | DS-08 Overall Score | `js/modules/delivery-screener.js` | `computeOverall()` | 101–106 | §DS-08 | Not yet executed — blocked on all Level 1 | **Pending — blocked** |
| 3 | DS-09 Rating | `js/modules/delivery-screener.js` | `computeRating()` | 108–114 | §DS-09 | Not yet executed — blocked on DS-08, DS-07 | **Pending — blocked** |
| 3 | DS-10 Ranking | `js/modules/delivery-screener.js` | `rankStrengthsAndRisks()` | 117–126 | §DS-10 | Duplication audit demonstrated the NaN-reaches-ranking mechanism; full numerical suite not yet built | **Pending — blocked, and carries a known defect mechanism (DS-02's NaN) even once unblocked** |

## Coverage confirmation

Every calculation identified in Phase 1 (DS-01 through DS-10) has a corresponding row above — no implemented calculation was left unmapped. `scoreBand()` and `clamp()` (lines 21–31) are deliberately **not** given their own rows: they're generic utility functions with no independent business meaning of their own, used by DS-04, DS-05, and DS-07 — their correctness is implicitly covered by testing the pillars that use them, consistent with how Fundamentals' `fmt()` display helper wasn't separately registry-tracked either.

## What Phase 2 confirms that Phase 1 could only assert

Phase 1's specification *stated* the dependency chains (DS-04/DS-05/DS-07 all consuming DS-03). Phase 2's line-level mapping *confirms* those are real, direct references in the actual function signatures — `financialStrengthPillar(ratios)`, `valuationPillar(ratios, qualityScore)`, `riskPillar(fundamentals, ratios)` all take the exact same `ratios` object constructed once in `computeCandidate()` (line 145) and passed through unchanged. There is no intermediate transformation between DS-03's output and its consumers — meaning a fix to DS-03 will flow through cleanly to Level 1 without needing any change to the pillar functions themselves, which is a genuinely useful thing to know before Phase 6A begins: **the fix is likely to be localized to `computeCandidate()`'s ratio block alone, not scattered across every pillar function.**

## Status: Phase 2 complete. Phase 3 (Numerical Verification, in the same dependency order) is next — not attempted in this pass, per the established discipline of completing one phase before starting another.
