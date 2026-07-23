# Watchlist — Cross-Module Consistency Review (Phase 1A)

*Registry-first, per Amendment 6: `Financial_Calculation_Registry.md` checked first — zero prior Watchlist entries, confirmed clean start. Implementation (`js/modules/watchlist.js`, `js/data-model.js`) then read in full, and every consumer of the watchlist (`overview.js`, `delivery-screener.js`, `research.js`) compared before any specification was written.*

## Finding: no duplicated *financial* calculation exists in this module

Watchlist stores stocks under consideration with a category, an optional target price, and notes. It computes **no ratio, score, valuation, or currency math** — the target price is stored and displayed but never compared against a current price or used in any calculation. So, like Research and Macro, it shares zero *financial* logic with any frozen module.

## Finding: WL-D01 — Overview duplicates the category-label mapping, and the two have drifted (Potential Defect)

**Two implementations of the same concept:**
- `watchlist.js` `categoryLabel(value)` — maps via the `CATEGORIES` array; unknown value → the raw value.
- `overview.js` `watchlistLabel(category)` (line 34) — `category === "Research" ? "Needs Study" : (category || "Unclassified")`.

**Line-by-line comparison (verified by execution, re-derivation of overview.js lines 34-36):**

| Input | `categoryLabel` (Watchlist) | `watchlistLabel` (Overview) | Consistent? |
|---|---|---|---|
| Watch / Buy Soon / Reject | as-is | as-is | ✅ |
| Research | "Needs Study" | "Needs Study" | ✅ |
| unknown non-empty (e.g. "Hold") | "Hold" | "Hold" | ✅ |
| **empty / null / undefined** | returns the falsy value as-is | **"Unclassified"** | ❌ **drift** |

**Classification: Potential Defect (WL-D01), not Confirmed.** The divergence only manifests for an item with a missing/empty category, which the UI cannot produce (the category `<select>` always yields one of the four values). It is reachable only via a hand-malformed imported backup. This mirrors the project's precedent for FIN-F08 (FCF dead code) and IN-01 (zero-risk Infinity): a real but non-UI-reachable gap → Potential, non-blocking. **Per the owner's decision (2026-07-23): record and recommend consolidation, do not fix this pass.** See `Watchlist_Recommendations.md` R-1.

**Registry scope note:** WL-D01 is a *presentation-label* drift, not a *financial* calculation. Consistent with how Research's ID-generation pattern and Macro's parse-and-merge were handled, it is documented here for transparency and **excluded from the Financial Calculation Registry**, which tracks financial calculations specifically.

## Finding: Overview also computes watchlist counts — no drift, different question

`overview.js` (lines 58-62) tallies per-category counts and a total for its summary panel. This is Overview's own aggregation for its own view; Watchlist computes only its own item count (WL-04). No shared code, no duplication risk — they answer different questions.

## Finding: other consumers reference the watchlist but compute nothing

- `delivery-screener.js` line 440 — a navigation link (`App.switchTo('watchlist')`). No logic.
- `research.js` — placeholder text only ("…even one you haven't added to Fundamentals, Portfolio, or Watchlist"). No logic.

## Finding: id + timestamp generation follows the established (non-shared) pattern

`data-model.js` `addWatchlistItem()` uses `id = Date.now() + Math.random()` and `dateAdded = new Date().toISOString()` — the same infrastructure pattern as `addHolding`/`addResearchNote`/`addIntradayTrade`. Non-financial, out of Registry scope (identical treatment to RL-04). Noted for transparency.

## Positive finding: target parsing correctly avoids the MAC-D01 NaN class

`buildItem()`'s `parseFloat(raw.targetPrice) || null` coerces any non-numeric or blank target to `null` — it can never store a `NaN`, the exact bug found and fixed in Macro (MAC-D01). Verified by execution (WL-01 tests). No fix needed.

## Conclusion

Zero shared or duplicated *financial* calculations. One non-financial cross-module drift (WL-D01, Overview label mapping) recorded as a Potential Defect — record + recommend consolidation, not fixed this pass, per owner decision. No Confirmed Defects.
