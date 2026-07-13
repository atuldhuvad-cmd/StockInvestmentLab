# Research Library — Cross-Module Consistency Review (Phase 1A)

*Registry-first, per Amendment 6: `Financial_Calculation_Registry.md` checked first — zero prior Research entries, confirmed clean start. Implementation (`js/modules/research.js`, `js/data-model.js`) then read in full and compared against every already-verified module and shared utility before any specification was written.*

## Finding: no duplicated *financial* calculation exists in this module

Research Library stores free-text knowledge-base entries (thesis, bull/bear case, risks, notes, decision history) — it computes no ratio, score, valuation, or currency amount anywhere. Confirmed by reading the full module: `research.js` never calls `WealthData.getSecurity()`, `getFundamentals()`, `CompanyCalculations.*`, or `PortfolioModule.*`, and defines no arithmetic of its own beyond counting and sorting. There is therefore no equivalent to the ROE/ROCE/Quality-Score/Portfolio-Value style duplication findings seen in Fundamentals, Delivery Screener, and Intraday.

## Finding: entry ID + timestamp generation follows an already-established (but not shared-function) pattern — non-financial, out of Registry scope

**Location:** `js/data-model.js`, `addResearchNote()` (line 136):
```js
state.researchLibrary.push({ id, addedAt: new Date().toISOString(), ...note });
```
where `id = Date.now() + Math.random()` (line 135).

This is the exact same pattern already used by `addHolding()`, `addWatchlistItem()`, and `addIntradayTrade()` — each independently writes `const id = Date.now() + Math.random();` rather than calling one shared ID-generator function. Research's copy is the fourth instance of this pattern, not a new one it introduces.

**Classification:** Duplicated *infrastructure* logic (ID/timestamp assignment), not duplicated *financial* logic. The Financial Calculation Registry tracks financial calculations specifically (per its own stated scope and every prior entry in it); this pattern computes no financial value and carries no risk of producing a wrong number — at most, two entries could theoretically collide on `id` if created in the exact same millisecond with the exact same `Math.random()` output, a risk already accepted identically in three other places in the codebase before this module existed. **Recorded here for transparency, not added to the Registry** — consistent with how Intraday's review distinguished "correctly reused" Settings access from actual duplicated calculations. Worth a future consolidation (one `WealthData.newId()` helper) but that is a maintainability improvement, not a verification finding — see Recommendations.

## Finding: `ListControls.filterAndSort()` is reused correctly, not duplicated

Research's ticker search reuses the same shared utility already relied on by Fundamentals and Delivery Screener (`js/list-controls.js`) rather than reimplementing search filtering locally. No duplication risk here — this is the intended pattern the utility was built for.

## What's genuinely new (no cross-module equivalent)

- **Entry validation** (ticker + title required before an entry can be added).
- **Decision-field conditional assignment** (only `Decision Record` entries carry a `decision` value; every other `docType` must leave it `null`).
- **Entry/company counting** (total entries, unique ticker count, per-ticker entry count).
- **Ticker-list and per-ticker-timeline ordering** — new to this module, and the subject of a defect found during this review (see below).

## Finding: the sort control (`date` / `ticker`) has no effect on what is displayed — confirmed by direct execution, not by reading alone

While tracing `refresh()` to map its logic ahead of Phase 2, the sort dropdown wired in `ListControls.wireControls()` (`state.sortKey = e.target.value`) is set on every change but never read anywhere in `refresh()`. The ticker list is unconditionally `Array.from(new Set(...)).sort()` (alphabetical), and the per-ticker timeline is unconditionally sorted newest-first — regardless of which option the user has selected in the "Sort" dropdown.

This was not assumed from the code alone: it is proven by direct execution in Phase 3 (`Research_regression_tests.js`, RL-D01) against the extracted `computeTickerList()` function, run once before any fix — see `Research_Financial_Specification.md` §RL-08/RL-D01 and the Verification Report's Phase 6A entry for the full before/after evidence. **Classified as a Confirmed Defect**, not a Potential one, since it was reproduced by running the actual production logic, not inferred from inspection.

## Conclusion

Zero shared or duplicated *financial* calculations (this module has none to share). One non-financial duplicated pattern noted for transparency (ID generation) but correctly excluded from the Registry's scope. One genuine Confirmed Defect found (RL-D01, sort control inert) — resolved via the Phase 6A Mandatory Defect Resolution Cycle before this module's freeze, documented in full in the Financial Specification and Verification Report rather than silently patched.
