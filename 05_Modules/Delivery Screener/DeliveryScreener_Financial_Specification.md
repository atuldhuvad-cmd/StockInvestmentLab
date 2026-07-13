# Delivery Screener — Financial Specification

*Phase 1A (Cross-Module Consistency Review) already complete — see `DeliveryScreener_Duplication_Analysis.md` and the Financial Calculation Registry's FIN-D01–D05 entries. Per Amendment 6, this specification is written registry-first: every calculation below states its Amendment 6 classification (Shared Implementation / Intentional Divergence / Implementation Drift / New Implementation) before its formula, not as an afterthought.*

## DS-01: Business Quality Pillar — Overall Score
- **Amendment 6 classification: Shared Implementation.** Calls `CompanyCalculations.qualityScore()` directly — the same function verified as FIN-F09 in Fundamentals.
- **Formula:** Identical to FIN-F09 — see `Fundamentals_Financial_Specification.md`. Not re-derived here; this entry exists to record that Delivery Screener consumes it, not to restate it.
- **Verification status:** Verified Consistent (registry). The FUND-D04 fix (renormalize over present factors) propagated automatically to this pillar's score the moment it was applied to the shared function — confirmed by direct execution in the duplication audit.

## DS-02: Business Quality Pillar — Per-Factor `subFactors` Breakdown
- **Amendment 6 classification: Implementation Drift** (registry ID FIN-D05).
- **Formula:** `subFactors[i].score = (qualitative[factor_i] / 5) × 100`, computed independently for each of the 7 factors, directly in `businessQualityPillar()` — **not** a call to `qualityScore()` or any shared, guarded function.
- **Business purpose:** Feeds the per-factor breakdown shown in the "full calculation trace" UI, and every entry here is a candidate input to `rankStrengthsAndRisks()`'s Top-3-Strengths/Risks output.
- **Divergence from DS-01:** DS-01 (the pillar's headline score) is protected by the FUND-D04 fix. DS-02 (this entry's per-factor breakdown) is not — it's a parallel, independently-written implementation of the same underlying math, missing the equivalent guard.
- **Confirmed defect, proven by direct execution** (duplication audit, Finding 3): a missing qualitative field produces a live `NaN` in the corresponding `subFactors` entry, which then reaches the sort in `rankStrengthsAndRisks()`, where `NaN` comparisons are unreliable — risk of a missing data point surfacing as a nonsensical "Top Strength" or "Top Risk" rather than being cleanly excluded.
- **Worked example (defect reproduction):** qualitative object missing `managementQuality` → DS-01 correctly shows `83.33` (renormalized over 6 present factors) while this entry's "Management quality" `subFactors` item shows `NaN`.

## DS-03: Financial Strength Pillar — Component Ratios (ROE, ROCE, Debt/Equity)
- **Amendment 6 classification: Implementation Drift** (registry IDs FIN-D01, FIN-D02, FIN-D03).
- **Formula:** `computeCandidate()` independently recomputes ROE, ROCE, and Debt/Equity inline (lines 137–140 of `delivery-screener.js`) rather than calling the shared, fixed `latestRatios()` from Fundamentals.
- **Divergence:** Uses the *pre-fix* truthy-check guard pattern (`latest.totalEquity ? ... : null`), not the corrected `(x && x > 0)` pattern now live in Fundamentals.
- **FIN-D01 (ROE): Confirmed Defect**, proven by direct execution — `totalEquity: -2000` produces `-25` here, where fixed Fundamentals correctly returns `null` for the identical input.
- **FIN-D02 (ROCE), FIN-D03 (Debt/Equity): assessed Medium confidence** — same code pattern, same file, same likely defect, but not yet independently execution-tested with their own negative-input cases. Distinguished honestly from FIN-D01's proven status, not assumed equivalent.
- **Net Margin is absent from this module entirely** — confirmed by reading the `ratios` object construction (line 145: `{ roe, roce, debtEquity, revenueCagr, pe }`, no `netMargin` key). This is a divergence, not a duplication risk — no pillar in Delivery Screener uses Net Margin, so its absence isn't a defect, just worth naming so it isn't later mistaken for an oversight.

## DS-04: Financial Strength Pillar — Score Banding
- **Amendment 6 classification: New Implementation.** The conversion of raw ROE/ROCE/D-E values into 0–100 sub-scores via `scoreBand()` (piecewise linear interpolation against named breakpoints) has no equivalent anywhere in Fundamentals, which displays raw ratios without any scoring transformation.
- **Formula:** `financialStrengthPillar()` averages three independently-banded scores: `roeScore = scoreBand(roe, [[0,0],[10,40],[15,65],[20,85],[30,100]])`, similarly for ROCE and D/E (D/E's bands are inverted — lower is better), then `score = (roeScore + roceScore + deScore) / 3`.
- **Business rule:** Missing ROCE or D/E defaults their component score to `50` (neutral), rather than excluding it from the average or returning `null` overall — **this is a different missing-data convention than Fundamentals uses anywhere**, worth flagging as a genuine design choice to verify is intentional, not an oversight, during Phase 4 (Business Rule Verification).
- **Dependency:** Inherits DS-03's drift — a banded score built from an unfixed raw ROE will itself be wrong, even though the banding logic itself (this entry) has no defect of its own.

## DS-05: Valuation Pillar — Fair Value Gap
- **Amendment 6 classification: New Implementation.** No equivalent calculation exists in Fundamentals — this is Delivery Screener's own valuation heuristic, previously documented in `delivery-screener-methodology.md` (frozen before this module's code was written).
- **Formula:** `reasonablePE = clamp(10 + revenueCagr × 0.8 + (qualityScore − 50) × 0.15, 8, 45)`; `gapPct = (reasonablePE − actualPE) / actualPE × 100`; `score = scoreBand(gapPct, ...)`.
- **Dependency, worth flagging:** `revenueCagr` here comes from DS-03's ratios object — the same, currently-unguarded Revenue CAGR calculation tracked as FIN-D04. A defect in Revenue CAGR would silently propagate into the "reasonable P/E" estimate, and from there into the Valuation pillar's score.
- **Business rule:** Explicitly labeled in the original methodology document as a simplified heuristic, not a DCF — this specification inherits that same honest framing rather than re-litigating it.

## DS-06: Technical Trend Pillar
- **Amendment 6 classification: New Implementation** (trivial). Always returns `{ score: null, available: false }` — a deliberate stub, not a bug, per the Standalone Value Rule and the Import-Driven Data Rule (no price-history data source exists in this app).
- **No numerical verification needed** — there's no formula to verify, only the constant "unavailable" state, which Phase 3 will confirm behaves correctly through the re-weighting logic (DS-08).

## DS-07: Risk Pillar
- **Sub-calculation 1 (red flags): Shared Implementation.** Calls `CompanyCalculations.detectRedFlags()` directly — the same function verified as FIN-F10. Verified Consistent.
- **Sub-calculation 2 (flag count → score banding) and Sub-calculation 3 (D/E extremity scoring): New Implementation.** `flagScore = scoreBand(flags.length, [[0,100],[1,70],[2,45],[3,15],[5,0]])` and `deExtremityScore = scoreBand(debtEquity, [[0,100],[1,70],[2,30],[4,5]])`, then `score = (flagScore + deExtremityScore) / 2` — neither has a Fundamentals equivalent.
- **Dependency, worth flagging:** the D/E extremity score consumes DS-03's `debtEquity` value — same drift-tainted input as DS-04 and DS-05.

## DS-08: Overall Score — Weighted Re-Normalization
- **Amendment 6 classification: New Implementation.**
- **Formula:** `computeOverall()` filters pillars with `score !== null`, sums their weights, and re-normalizes each available pillar's contribution by `weight / totalAvailableWeight` — this is the mechanism that lets Technical Trend (DS-06) be "unavailable" without breaking the overall score.
- **Business rule, already partially verified conceptually:** with Technical Trend always unavailable currently, the effective weights become Business Quality 25/85≈29.4%, Financial Strength 25/85≈29.4%, Valuation 20/85≈23.5%, Risk 15/85≈17.6% — this arithmetic needs independent numerical verification in Phase 3, not just restated here as presumed-correct.

## DS-09: Rating
- **Amendment 6 classification: New Implementation.**
- **Formula:** `computeRating()` — Avoid if `overall < 45` OR `riskScore < 30` OR `redFlagCount >= 3`; else Strong Buy if `overall >= 80` AND `riskScore >= 60`; else Buy if `overall >= 65`; else Watch if `overall >= 45`; else Avoid.
- **Dependency:** Every input here (`overall`, `riskScore`, `redFlagCount`) traces back through DS-08, DS-07, and ultimately DS-03/DS-04's drift-affected values — a rating could be wrong not because the rating logic itself is wrong, but because what feeds it is.

## DS-10: Top 3 Strengths / Top 3 Risks
- **Amendment 6 classification: New Implementation.**
- **Formula:** `rankStrengthsAndRisks()` pools every pillar's `subFactors` array, filters `score !== null`, sorts descending, takes the top 3 as strengths and bottom 3 (reversed) as risks.
- **Confirmed defect dependency:** this function's `!== null` filter does **not** catch `NaN` (JavaScript: `NaN !== null` evaluates `true`, so a `NaN`-scored entry passes the filter and enters the sort) — this is the exact mechanism by which DS-02's defect (FIN-D05) reaches the user-visible Top-3 display, not merely a theoretical risk.

---

## Business Rules Explicitly NOT Specified (Phase 4)

| Question | Status |
|---|---|
| Why does Financial Strength default missing ROCE/D-E to 50 (neutral) rather than excluding/nulling, unlike Fundamentals' convention elsewhere? | **Genuinely open — not silently resolved.** Worth noting the inconsistency precisely: `qualityScore()` (FUND-D04's fix) chose to *renormalize over present factors* rather than default to a neutral value, reasoning that a real partial average is more honest than inventing a score for unassessed data. DS-04 does the opposite — defaults to neutral 50. Both are defensible (neutral-default avoids wild score swings from a 2-of-3 vs 3-of-3 average when data is sparse; renormalization avoids fabricating a number), but they're inconsistent with each other, and this specification isn't the place to unilaterally pick one — flagged for a deliberate decision, not resolved here. **Does not block this module's freeze**, consistent with Portfolio's and Fundamentals' precedent of freezing with genuinely open business questions on record. |
| Is the Fair Value Gap heuristic (DS-05) meant to be recalibrated as real market data becomes available, or is it a permanent simplification? | **NOT SPECIFIED.** |
| Should Delivery Screener's duplicated ratio block (DS-03) be replaced by a call to the shared `latestRatios()`, or is some intentional divergence expected here? | **Resolved, 2026-07-12.** Fixed via Phase 6A — `computeCandidate()` now calls the shared, guarded `CompanyCalculations.latestRatios()` directly. No intentional divergence was ever identified; this was confirmed duplication, not a deliberate design choice, and has been eliminated. |

*Phase 2 (Code Mapping), Phase 3 (Numerical Verification), and Integrity Verification are complete — see `DeliveryScreener_CodeMapping.md`, `DeliveryScreener_regression_tests.js` (15/15 pass), and the integrity checks logged in `DeliveryScreener_Dependency_Graph.md`'s fix cycle audit. All 5 Phase 1A findings (FIN-D01–D05) resolved. One genuinely open Phase 4 design-consistency question remains (see above) — does not block freeze, consistent with Portfolio's and Fundamentals' precedent.*
