# Delivery Screener — Duplication & Divergence Analysis
*Completed before Phase 1 (Financial Specification) or any numerical verification, per the new permanent pre-verification rule triggered by the FUND-D04 cross-module finding.*

Read `delivery-screener.js` in full and compared every calculation against the now-frozen Fundamentals module (`fundamentals.js`'s `latestRatios()`, and the shared `company-calculations.js`).

## Summary — this audit already found something important

**Two of Delivery Screener's calculations correctly reuse the shared, fixed code. Two others independently reimplement Fundamentals' logic — including the exact formulas that were just fixed there — and remain unfixed here.** This is precisely the risk this new pre-verification rule exists to catch, confirmed on its first use.

## Finding 1 — Correctly shared, benefits from the Fundamentals fix

**`businessQualityPillar()`'s overall `score`** (line 35): `const score = CompanyCalculations.qualityScore(qualitative);` — calls the shared function directly. **This correctly inherited the FUND-D04 fix** (renormalizes over present factors instead of NaN-ing on one missing field) the moment that fix was made, with no additional work needed here.

**`riskPillar()`'s red flag detection** (line 86): `const detectRedFlags = CompanyCalculations.detectRedFlags;` — calls the shared function directly. No divergence. Already covered by the existing Bajaj Finance 4-flag regression baseline.

**Verdict on these two: intentional, correct sharing. No further action.**

## Finding 2 — Confirmed duplication, NOT sharing the fix: `computeCandidate()`'s ratio block

**Lines 137–144** independently reimplement ROE, ROCE, Debt/Equity, Revenue CAGR, EPS, and P/E — the exact same calculations as `fundamentals.js`'s `latestRatios()` — as a separate inline copy, not a call to the shared/frozen function.

**This is not calling the fixed code.** Direct comparison:

| Line | Delivery Screener (current) | Fundamentals (post-fix, frozen) |
|---|---|---|
| ROE | `latest.totalEquity ? ... : null` — truthy check | `(latest.totalEquity && latest.totalEquity > 0) ? ... : null` — fixed |
| ROCE | `capEmployed ? ... : null` — truthy check | `(capEmployed && capEmployed > 0) ? ... : null` — fixed |
| Debt/Equity | `latest.totalEquity ? ... : null` — truthy check | `(latest.totalEquity && latest.totalEquity > 0) ? ... : null` — fixed |
| Revenue CAGR | `yearsSpan > 0 ? ... : null` — no revenue guard | `(yearsSpan > 0 && first.revenue > 0) ? ... : null` — fixed |
| Net Margin | **Not computed at all** — absent from the `ratios` object | Computed |
| EPS, P/E | Identical logic to Fundamentals — neither had a defect, so no divergence in outcome | — |

**Consequence: FUND-D01, FUND-D02, and FUND-D03's exact defects still exist in Delivery Screener, completely unaffected by the fix just applied to Fundamentals.** **Confirmed by direct execution, not predicted:** a test company with `totalEquity: -2000, netProfit: 500` fed through `computeCandidate()` produces `ratios.roe: -25` — the identical meaningless-but-plausible-looking result that `latestRatios()` in Fundamentals no longer produces for the same input (proven by `Fundamentals_regression_tests.js` TC-F03, which now correctly returns `null`). The module-freeze and fix cycle just completed for Fundamentals gave a false sense that this class of defect was closed project-wide. It was only closed in one of its two locations.

**Net Margin's absence is a divergence, not a duplication risk** — Delivery Screener never needed it (no pillar uses it), so its absence isn't a bug, just worth naming so it isn't mistaken for an oversight during Phase 1.

**Verdict: this is now a Confirmed Defect, proven by direct execution above, not merely anticipated from reading the code — and per the newly-codified fix-before-freeze workflow, resolved by making `computeCandidate()` call the shared, fixed `latestRatios()` logic instead of maintaining its own copy, not by re-patching the guards a second time in a second place.** That's the real fix — not matching the patch, but removing the duplication that made two patches necessary in the first place.

## Finding 3 — Confirmed duplication, NOT sharing the fix: `businessQualityPillar()`'s `subFactors` construction

**Lines 36–44** independently construct the 7-factor breakdown (`Economic moat`, `Pricing power`, etc.) directly from `qualitative.*` fields, computed inline — **not derived from the shared, guarded `qualityScore()` function**, even though the pillar's *overall* score (Finding 1) correctly does use it.

**Consequence:** if a qualitative sub-factor is missing, the pillar's overall `score` is now correctly protected (Finding 1) — but the individual `subFactors` entry for that missing field still computes `undefined/5*100 = NaN`. **Confirmed by direct execution:** feeding `businessQualityPillar()` a qualitative object missing `managementQuality` produces an overall `score` of `83.33` (correctly renormalized, via the shared fix) alongside a `subFactors` array where the "Management quality" entry's `score` is a real, live `NaN` — proving the pillar's headline number and its own detail breakdown can now disagree about whether data is missing. This `NaN`-scored entry then flows into `rankStrengthsAndRisks()`'s sort (line 122: `sorted.sort((a,b) => b.score - a.score)`), where `NaN` comparisons are unreliable in JavaScript (any comparison involving `NaN` is `false`, which can silently misplace the entry rather than exclude it) — a real risk that a missing data point could surface as a nonsensical "Top Strength" or "Top Risk," not just a blank number.

**This is exactly the cross-module issue flagged in `Fundamentals_Verification_Report.md`'s post-fix addendum** — anticipated there, now confirmed here by direct execution against the actual production code.

**Verdict: Confirmed Defect** — to be resolved during this module's own numerical verification, likely by having `subFactors` construction filter out missing factors the same way `qualityScore()` now does, rather than independently reimplementing the per-factor math.

## Finding 4 — Not a duplication: Delivery-Screener-specific logic

`riskPillar()`'s Debt/Equity extremity scoring (`scoreBand(ratios.debtEquity, [[0,100],[1,70],[2,30],[4,5]])`) is genuinely new logic — Fundamentals never computes a D/E "extremity score," only the raw ratio. Not a divergence risk, since there's nothing in Fundamentals for it to have diverged from.

## What this means for Phase 1 onward

Phase 1 (Financial Specification) for Delivery Screener will proceed next, but two things are now already known before it starts, rather than discovered mid-pass:
1. The ROE/ROCE/Debt-Equity/Revenue-CAGR block in `computeCandidate()` needs its own specification entries, explicitly noting they are currently **duplicated, unfixed copies** of already-frozen Fundamentals logic — not independent calculations with their own business purpose.
2. `businessQualityPillar()`'s `subFactors` needs its own specification entry, separate from `qualityScore()`'s, precisely because they are two different code paths despite looking related.

Both will be carried into Phase 3 as explicit numerical test cases (reusing the exact FUND-D01/D02/D03/D04 test vectors already proven to trigger them), not invented fresh — the fastest way to confirm whether the anticipated defects are real is to run the same inputs that already proved them real once.
