# Watchlist — Recommendations

*Non-blocking follow-ups surfaced during verification. None blocked the v1.0 freeze. Ordered by value, per the Charter's three-question gate.*

## R-1 — Consolidate the two category-label mappings (WL-D01, Potential Defect)
- **What:** `watchlist.js` `categoryLabel()` and `overview.js` `watchlistLabel()` independently map category → display label and have drifted on the missing/empty-category case (Watchlist → falsy value; Overview → "Unclassified").
- **Why:** One source of truth for category labels prevents the two views from disagreeing as categories evolve.
- **Proposed fix:** Expose `WatchlistModule.categoryLabel` (already done this pass) and have Overview call it, or extract a shared `categoryLabel` into a small shared helper; then decide the single correct behaviour for a missing category (recommend "Unclassified", matching Overview's friendlier output).
- **Cost/risk:** Low, but touches Overview (a frozen module's consumer). **Owner decision 2026-07-23: record and recommend, do not fix this pass.** When actioned, it should run through Overview's own change/verification, not be bundled silently into Watchlist.

## R-2 — (Optional) Duplicate-ticker detection on add
- **What:** Adding the same ticker twice creates two separate items unconditionally.
- **Why:** Avoid accidental duplicates cluttering the list.
- **Cost/risk:** Low. A pre-add check in `buildItem`/the handler (warn or merge). **Recommend only if duplicates become a real annoyance** — otherwise speculative.

## R-3 — (Optional) Guard the unknown-category chip colour (WL-06)
- **What:** An unknown `category` yields `CATEGORY_COLOR[cat] === undefined` → `class="chip undefined"`.
- **Why:** Cosmetic robustness for malformed imported data.
- **Fix:** `CATEGORY_COLOR[cat] || ""`.
- **Cost/risk:** Trivial. **Low priority** — not reachable via the UI (fixed dropdown).

## R-4 — (Optional) Implement or drop `dateUpdated`
- **What:** `dateUpdated` is named in the `watchlist` data-shape comment (`data-model.js`) but never written or read (same class as Research's `aiAnalysis`/`sourceUrl`).
- **Why:** Close the documented-shape-vs-implementation gap — either support edit-with-timestamp, or remove the stale field name.
- **Cost/risk:** Low. **Recommend when an edit-in-place feature is actually wanted;** until then, remove the comment to avoid implying a feature that doesn't exist.

## R-5 — (Optional) Target price vs current price
- **What:** Target price is stored/displayed but never compared to a current price (no upside %, no "target reached" signal).
- **Why:** Would turn the target from a note into a decision aid — but it introduces the module's first genuine *financial* calculation and a price-data dependency.
- **Gate:** Real decision-support value, but adds a calculation + data dependency to a currently calculation-free module. **Recommend as a deliberate future feature, not a verification fix** — it would need its own specification and verification pass.

---

**Freeze disposition:** none of R-1…R-5 blocks Watchlist v1.0. R-1 (WL-D01) is the only item tied to a recorded Potential Defect, and it is deferred by explicit owner decision.
