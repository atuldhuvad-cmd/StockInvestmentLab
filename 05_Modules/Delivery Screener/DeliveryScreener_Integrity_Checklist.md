# Delivery Screener — Integrity Checklist

Standing invariants for this module. Re-run after any future change to `delivery-screener.js` or the shared `company-calculations.js`.

## Data Invariants

- [x] **A ticker with no fundamentals data returns `null`, not a crash.** Confirmed by direct execution — `computeCandidate("NOTREAL")` with no matching `WealthData.getFundamentals()` entry returns `null` cleanly.
- [x] **Overall score is always bounded within `[0, 100]`.** Confirmed across all 10 real seeded companies (range observed: 53.3 to 96.9) — no value outside bounds.
- [x] **Rating is always exactly one of the 4 valid values** (Strong Buy, Buy, Watch, Avoid). Confirmed across all 10 real companies.
- [x] **`redFlagCount` never drifts from the actual `detectRedFlags()` output.** Confirmed by direct comparison across all 10 real companies — the count displayed always exactly matches re-running the shared detection function independently.
- [x] **No `NaN` reaches any user-visible output** (overall score, rating, strength/risk labels). Confirmed across all 10 real companies post-fix (FIN-D01–D05) — this was the exact failure mode found and closed during the fix cycle; re-verified clean, not merely assumed fixed.

## Validation Checks Not Yet Implemented

- No check preventing a ticker from being screened with fewer than 2 years of fundamentals data (Revenue CAGR would correctly return `null` via the shared guard, but no explicit "insufficient data" message is surfaced to the user beyond the missing metric itself).
- No check on `pe` being a sane, non-extreme value before it feeds into the Fair Value Gap calculation — an unusually large or small but technically valid P/E could produce a `gapPct` at the very edge of `scoreBand()`'s defined range without any warning that the input itself was unusual.

## Reconciliation Checks

- **Sum of available pillar weights always equals the denominator used in `computeOverall()`'s re-normalization.** Verified for the current state (Technical Trend permanently unavailable): `0.25 + 0.25 + 0.20 + 0.15 = 0.85`, confirmed by independent recomputation matching the actual `overall` value exactly for a real company (TCS).
- **`businessQualityPillar()`'s overall score and its own `subFactors` breakdown never disagree about whether a factor is missing**, post FIN-D05 fix — confirmed by direct execution (missing `managementQuality` now shows `null` in `subFactors`, consistent with the renormalized overall score, rather than the pre-fix state where the two could silently disagree).
