# Research Library — Recommendations

## Confirmed Defects
None open. One found and fixed this pass — see below.

## Fixed This Pass

1. **RL-D01 — Sort control had no effect on displayed order.** Fixed 2026-07-13. The "Sort: Newest first / Sort: Ticker A-Z" dropdown updated component state but `refresh()` never read it — the ticker list and its ordering were always alphabetical regardless of selection. Fixed by making `computeTickerList()` branch on `sortKey`, computing each ticker's most recent entry timestamp for the "date" case. Re-verified by direct execution with a dataset engineered so the two orderings diverge (see Verification Report). Zero impact on any other module — the fix is entirely local to `research.js`.

## Improvements (software behaves correctly; optional enhancements)

1. **Consolidate the duplicated `Array.from(new Set(entries.map(e => e.ticker)))` expression** currently written independently in both `computeSummary()` and `computeTickerList()`. (Improvement, Low priority.) Not a defect — both copies are correct and currently consistent — but a future edit to one without the other is exactly the kind of drift risk this project's verification process exists to catch early. A single `uniqueTickers(entries)` helper would remove the risk outright.
2. **Consider a shared `WealthData.newId()` helper** instead of the `Date.now() + Math.random()` pattern independently repeated in `addHolding()`, `addWatchlistItem()`, `addResearchNote()`, and `addIntradayTrade()`. (Improvement, Low priority.) Noted in Phase 1A as non-financial and out of the Registry's scope, but worth a mention here since Research is the fourth module to inherit this same pattern un-consolidated.

## Explicitly Not Recommended

- **Implementing `aiAnalysis` / `sourceUrl` fields just because they're named in the data-shape comment.** (Explicitly deferred, not silently dropped.) A real gap between the documented shape and what's built — but per the Three-Question Gate, whether a dedicated "paste an AI summary here" field (separate from the existing "AI-Generated Summary" `docType`, which already covers this today via the generic `content` field) or a source-URL field would meaningfully help Dr. Atul make better decisions or save time is a product question, not a defect fix. Recommend raising it as its own scoped decision if the current `docType`-based approach ever proves insufficient in practice.
- **Duplicate-entry detection.** Already effectively low-risk in a single-user, manually-curated knowledge base — the user is the only one adding entries and can see immediately if a duplicate was created. Adding detection logic now would be solving a problem not observed in practice, which the project's Performance/Architecture Freeze rules explicitly caution against.
