# Fundamentals — Recommendations

## Confirmed Defects (evidence: `Fundamentals_Verification_Report.md`)

1. **FUND-D01 — Fix the negative-equity/revenue guard on ROE, ROCE, Debt/Equity, Net Margin.** (High priority — this exact fix already exists elsewhere in the codebase, so the cost is near-zero.) Change `totalEquity ?` to `totalEquity && totalEquity > 0 ?` (and the equivalent for `revenue`, `capEmployed`) across all four ratios. **This isn't a new fix to design** — it's the identical change already made to `screening-engine-v1.py` (Fix 6, from this session's earlier Python engine audit) and never carried over here. Recommend applying it now for consistency, and — separately — recommend a note in the project charter that a fix applied to one implementation of a shared concept should trigger a check of any sibling implementation, not just the one being edited at the time.

2. **FUND-D02 / FUND-D03 — Guard Revenue CAGR's inputs, and make `fmt()` NaN/Infinity-aware.** (High priority — these produce literally broken UI text, the most user-visible defect class in this module.) Two independent fixes needed: (a) guard `first.revenue > 0` before the CAGR division, returning `null` for zero or negative first-year revenue, same pattern as the other ratios; (b) update `fmt()` to treat `NaN` and `Infinity` the same way it already treats `null`/`undefined` — showing `"—"` rather than the literal broken string. Fixing (a) alone would prevent the specific cases found, but (b) is the more durable fix, since it protects against *any* future calculation that might produce a non-finite number, not just this one.

3. **FUND-D04 — Guard `qualityScore()` against a missing sub-factor.** (High priority — shared-function blast radius affects both Fundamentals and Delivery Screener.) Either default a missing sub-factor to a stated neutral value (e.g., 3/5, the midpoint) with a visible "incomplete data" flag, or exclude it from the average entirely (re-normalizing over however many of the 7 factors are actually present) rather than letting one missing field silently break the whole score. The second option is more honest — a defaulted neutral value could mask genuinely missing information as a real, if middling, assessment.

## Potential Defects

4. **FCF's missing guard — potential, not confirmed as user-facing, because FCF is never displayed.** (See Improvement #7 below — this is really a dead-code question more than a defect, since a broken calculation that's never shown to the user causes no visible harm today, but pollutes the codebase and would immediately become a hidden defect the moment someone wires it into the UI without independently rediscovering the gap.)

## Improvements (software behaves correctly; optional enhancements)

5. **Add EPS CAGR and Profit Growth as separate calculations.** (Improvement, Medium priority) Currently only Revenue CAGR exists — a reasonable design choice for simplicity (per the Indicator Freeze Policy's spirit), but worth naming as a real, currently-absent capability if it's ever requested, rather than assuming it's already covered by Revenue CAGR (it is not — profit and revenue growth rates diverge meaningfully in real companies, especially ones improving or declining in margin).

6. **Add a first-year-of-data check to `detectRedFlags()`.** (Improvement, Low priority) The function is only implicitly proven safe with 1-year data via reasoning about the loop bounds, not an executed test. A cheap, permanent regression test closes this without needing any code change — pure test-coverage completeness.

## Observations (neutral design notes)

7. **FCF is a dead calculation — computed on every render, displayed nowhere.** Not harmful today (it just wastes a trivial amount of computation and clutters the return value), but worth a decision: either wire it into the UI (and then FUND-D-class guard it properly first) or remove it entirely. Leaving unused, unguarded code in the calculation layer is the kind of thing that becomes a real defect later if someone assumes "it's already computed, so it must already be safe to display."

8. **The banking/non-banking distinction is cosmetic, not calculational — this may be intentional, not a gap.** Building genuinely different formulas for financial institutions (which have fundamentally different balance sheet structures) is a substantial undertaking, and a clear warning label is a reasonable, honest middle ground for a single-user tool rather than under-engineering silently. Recorded as an Observation rather than a Recommendation, since there's no evidence either way about whether deeper bank-specific modeling is actually wanted.

## Explicitly Not Recommended

- Building separate bank-specific ROE/ROCE formulas as part of this verification pass — that's new functionality, not a defect fix, and should go through the Three-Question Gate on its own merits if it's ever wanted, not be bundled into a correctness audit.
- Adding configurable red-flag thresholds (currently hardcoded at 30%/5%/15%) — no evidence this rigidity has caused a real problem; changing it now would be speculative complexity, not a response to a demonstrated need.
