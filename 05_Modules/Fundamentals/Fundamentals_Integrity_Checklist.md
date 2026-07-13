# Fundamentals — Integrity Checklist

Standing invariants for this module. Re-run after any future change to `fundamentals.js` or `company-calculations.js`.

## Data Invariants

- [x] **Every ratio guards its direct denominator against zero.** Confirmed true for ROE, ROCE, Debt/Equity, Net Margin, EPS, P/E, Revenue CAGR's year-span. **Still not true for FCF**, which has zero guard at all — FCF was correctly out of scope for the FUND-D01–D04 fix (classified Potential, not Confirmed — see Verification Report), so this line item remains a stated, open gap, not stale.
- [x] **Ratios correctly exclude negative denominators, not just zero.** **Fixed 2026-07-12 (FUND-D01).** ROE, ROCE, Debt/Equity, and Net Margin now all require a strictly-positive denominator, matching P/E's existing correct pattern. *This item previously read "False for ROE, ROCE, Debt/Equity, Net Margin" — that was accurate before the fix and is corrected here now that it isn't; leaving stale checklist text after a fix would itself be a process gap, caught and corrected during the Verification Dashboard's metric compilation.*
- [x] **`qualityScore()` requires all 7 qualitative sub-factors to be present, or gracefully renormalizes over what's present.** **Fixed 2026-07-12 (FUND-D04).** Previously "not enforced," silently NaN-ing on any missing field. *This function is shared with Delivery Screener — the fix propagated automatically, confirmed by direct execution in the Delivery Screener duplication audit.* **Related, unfixed issue remains:** Delivery Screener's own `subFactors` breakdown (a separate, parallel implementation, not a call to this function) still lacks the equivalent guard — tracked as FIN-D05, to be resolved during Delivery Screener's own verification, not here.
- [ ] **`detectRedFlags()` requires at least 2 years of data to detect anything.** Confirmed by reading the loop (`for i = 1; i < years.length`) — with 0 or 1 years, the loop body never executes and an empty flags array is correctly returned, not a crash. Verified implicitly (BAJFINANCE test has 4 years of data and produces flags correctly); not separately tested with a 1-year dataset in this pass — a gap worth closing in a future revision, not urgent.
- [x] **`isBank` classification affects display only, never calculation.** Confirmed by reading `renderDetail()` — the flag gates a warning `<div>`, nothing else. If a future requirement expects bank-specific formulas, this invariant will need to be revisited deliberately, not assumed to already exist.

## Validation Checks Not Yet Implemented

- No upfront check that a `years` array entry has all expected numeric fields before any ratio calculation runs — each formula independently guards (or doesn't) its own inputs, rather than one shared validation pass.
- No check preventing a `years` entry with a duplicate `year` value (e.g., two "2025" entries) — `latestRatios()`'s sort-and-take-last logic would silently pick whichever duplicate happens to sort last, with no warning that a duplicate existed.
- No check on `pledgePct` being within a sane 0–100 range before `detectRedFlags()` compares it year-over-year.

## Reconciliation Checks

- **`qualityScore()` output range is 0–100 by construction**, given valid (1–5) inputs for all 7 sub-factors — confirmed algebraically (each term is `(x/5)×100` for `x∈[1,5]`, giving each term range `[20,100]`, and the average of values in `[20,100]` is itself in `[20,100]`, a strict subset of `[0,100]`). Not separately executed as a test, since it follows directly and unambiguously from the formula's structure with valid inputs — flagged here as a reasoned invariant, not an executed one, per the framework's honesty requirement to distinguish the two.
- **Red flag count is non-negative and bounded by (years−1)×5 + 1** (5 year-over-year checks per transition, plus one possible auditor-change flag) — a sanity bound, not independently tested this pass.
