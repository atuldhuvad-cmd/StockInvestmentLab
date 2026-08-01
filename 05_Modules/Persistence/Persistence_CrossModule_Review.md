# Persistence — Cross-Module Consistency Review (Phase 1A)

*Registry-first, per Amendment 6: `Financial_Calculation_Registry.md` checked first — zero prior Persistence entries, confirmed clean start. `js/persistence.js`, `js/data-model.js`, and every consumer (`app.js` and each module's `App.saveNow`) read before any specification was written.*

## Finding: no financial calculation exists in this module

Persistence is pure infrastructure — IndexedDB save/load and Export/Import JSON. It computes no ratio, score, valuation, or currency amount. Zero shared *financial* logic with any frozen module.

## Finding: Persistence is the shared save/load foundation everything depends on

`app.js` wires the whole app to it: `saveNow()` → `Persistence.save()`; init → `Persistence.load()`; the Export/Import buttons → `exportToFile()`/`importFromFile()`; a 60s autosave and a `beforeunload` save. Every feature module calls `App.saveNow()` after mutating state (Portfolio, Delivery Screener, Intraday, Macro, Research, Watchlist). Persistence depends only on `WealthData` and calls into **no** module — a foundational leaf that the entire suite relies on for durability.

## Finding: `WealthData.replaceAll()` is Persistence's core primitive — used nowhere else

`replaceAll(newState) { state = { ...emptyState(), ...newState }; }` (data-model.js) is the schema-forward-compatible merge that both `load()` and `importFromFile()` rely on. It is invoked **only** by Persistence. This is the mechanism behind the "backup round-trip safety" invariant every prior module's Integrity Checklist asserted (INV-*8). Verified directly here (PER-03).

## Finding: Macro's parse-and-merge is a related concept, not shared code

`macro.js` `importSnapshot()` also does `JSON.parse` + merge, but it is a **narrower section-merge** (one slice, `macroIndicators`), not a whole-state replace. Macro's own Cross-Module Review already recorded that it reuses Persistence's *concept* with no shared code. Confirmed here: Persistence is the source-of-truth for whole-state import; Macro is a scoped, independent merge. No duplication, no drift.

## Finding: the HTML-escaping `.replaceAll(...)` calls are unrelated

Several modules use `String.prototype.replaceAll("&","&amp;")` for HTML escaping — a different API entirely from `WealthData.replaceAll()`. Noted only to rule it out of this review.

## Findings from numerical verification (Phase 3) — surfaced by execution

- **PER-D01 (Confirmed Defect, fixed this pass):** `importFromFile`'s validation only checked `typeof === "object"`, so `{}`, arrays, and wrong-shape objects passed and `replaceAll()` merged them onto `emptyState()` — silently wiping all real data, the exact outcome the guard's own comment says it prevents. UI-reachable via the Import button; classified **Confirmed** per the owner's "UI-reachable ⇒ not merely Potential" rule. **Fixed** (Phase 6A) — see the Verification Report and the Financial Specification Fix Addendum.
- **PER-D02 (Potential Defect, recorded not fixed):** `replaceAll()` performs no inner-shape validation, so a valid object with a wrong-typed field (e.g. `holdings: "string"`) is accepted verbatim and would crash consumers. More contrived than PER-D01 (requires a specifically type-corrupted field); recorded and recommended, deferred by owner decision.

## Conclusion

Zero shared or duplicated *financial* calculations. Persistence is the shared durability foundation; `replaceAll` is its core primitive, used only here. One Confirmed Defect (PER-D01) found by execution and fixed via Phase 6A this pass; one Potential Defect (PER-D02) recorded and deferred.
