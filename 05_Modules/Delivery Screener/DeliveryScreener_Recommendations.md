# Delivery Screener — Recommendations

Per the framework's classification rules: every Confirmed Defect found in this module (FIN-D01–D05) was fixed within this same verification pass — none remain open. What follows is what's left after that: one genuine open design question, plus improvements and observations.

## Confirmed Defects

None open. FIN-D01 through FIN-D05 — all fixed, re-verified, zero regression. See `DeliveryScreener_Verification_Report.md`.

## Improvements (software behaves correctly; optional enhancements)

1. **Resolve the ROCE/D-E neutral-default vs. renormalization inconsistency.** (Improvement, Medium priority — a genuine open design question, not resolved unilaterally in this pass.) `qualityScore()` renormalizes over present factors when data is missing; `financialStrengthPillar()` defaults missing ROCE/D-E to a neutral 50 instead. Both are defensible — neutral-default avoids score swings from a 2-of-3 vs 3-of-3 average when data is sparse; renormalization avoids fabricating a number for unassessed data — but they're inconsistent with each other. Recommend a deliberate decision (either convention, applied consistently) rather than leaving two different unstated philosophies in the same codebase.

2. **Decide whether the Fair Value Gap heuristic (DS-05) is a permanent simplification or meant to be recalibrated as real market data becomes available.** (Improvement, Low priority.) Currently and correctly labeled a heuristic, not a DCF, in the original methodology document — this recommendation is simply to make that framing explicit in the code-level specification too, so a future reader doesn't mistake it for a more rigorous model than it is.

## Observations (neutral design notes)

3. **FIN-D05's fix closed the behavioral gap but not the structural one.** `businessQualityPillar()`'s `subFactors` construction is now correctly guarded, but it's still a separate implementation from `qualityScore()`, not a call to it. Tracked precisely in the registry as "Verified Consistent in behavior, still Implementation Drift in code structure" rather than overclaimed as full unification. Worth a future pass if this module is revisited for other reasons — not urgent enough to justify reopening a frozen module on its own.

4. **Regression test infrastructure lesson, worth carrying forward:** the Fundamentals regression suite broke during this fix cycle not because of an application defect, but because it extracted `latestRatios()` by string-slicing `fundamentals.js`'s source — an implicit assumption about file location that was never part of any specification. Recommend future regression suites depend on public behavior (calling the actual exported function) rather than internal file structure, wherever practical, so refactoring doesn't require touching the tests that verify the thing being refactored.

## Explicitly Not Recommended

- Building a full DCF model to replace the Fair Value Gap heuristic — no evidence this level of rigor is needed for a single-user tool, and it would require real market data the Import-Driven Data Rule doesn't currently supply for this purpose.
- Fully unifying `subFactors` with `qualityScore()` right now — the behavioral defect is fixed; forcing a structural refactor into an already-frozen module for a cosmetic-only improvement isn't justified by the Three-Question Gate.
