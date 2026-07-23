# Watchlist — Code Mapping (Phase 2)

*Maps each specified calculation to the exact production code. Nothing is reimplemented in the tests except the DOM-coupled display bits (WL-04/05), which are re-derived and labelled.*

**Module shape:** `WatchlistModule = (function(){ … })()`. Public surface after this pass: `{ render, categoryLabel, buildItem, sortByDateAdded }`.

| Calc | Function | Location | Public? | Executed in Node tests? |
|---|---|---|---|---|
| WL-01 | `buildItem(raw)` | `watchlist.js` (extracted 2026-07-23) | **Yes (new)** | **Yes** — real function |
| WL-02 | `categoryLabel(value)` | `watchlist.js` | **Yes (exposed 2026-07-23)** | **Yes** — real function |
| WL-03 | `sortByDateAdded(items)` | `watchlist.js` (extracted 2026-07-23) | **Yes (new)** | **Yes** — real function |
| WL-04 | count + pluralization, inline | inside `renderList()` | No (DOM) | **No** — re-derived over real `getWatchlist().length` |
| WL-05 | target display, inline | inside `renderList()` | No (DOM) | **No** — re-derived branch |
| WL-06 | `CATEGORY_COLOR[cat]` | `watchlist.js` object, used in card markup | No (DOM) | **No** — verified by reading |
| WL-07 | remove-by-id | `renderList()` handler → `WealthData.removeWatchlistItem` | via data model | **Yes** — `addWatchlistItem`/`removeWatchlistItem` are real |

## The source change made this pass (Option B — approved 2026-07-23)

A **behaviour-preserving extraction**, shown as a diff and approved before applying:

1. **`buildItem(raw)`** — new pure function holding the exact normalization expressions previously inline in the add-click handler (`(x).trim().toUpperCase()`, `parseFloat(x)||null`, `(x).trim()`), returning `null` when the ticker is empty. The handler now calls it and checks `if (!item)` before `addWatchlistItem`.
2. **`sortByDateAdded(items)`** — new pure function holding the identical `.slice().sort((a,b)=>new Date(b.dateAdded)-new Date(a.dateAdded))`; `renderList()` now calls it.
3. **Exposure** — `return { render }` → `return { render, categoryLabel, buildItem, sortByDateAdded }`.

**Why behaviour is unchanged:** the extracted expressions are character-for-character the originals; the empty-ticker path still shows the same error and adds nothing (fields not cleared); the sort is the same non-mutating slice+sort; rendered markup is identical (same items, order, and normalized fields); the single existing caller (`render`, via the router) is unaffected by added object keys; `render`/`renderList` are never executed in Node (only the pure functions are). This mirrors Research's `buildEntry`/`computeTickerList` extraction shape.

## Data-model touchpoints

- `WealthData.getWatchlist()`, `addWatchlistItem(item)` (assigns `id = Date.now()+Math.random()`, `dateAdded = new Date().toISOString()`), `removeWatchlistItem(id)` — all pre-existing public setters/getters in `js/data-model.js`. Watchlist writes **through** these setters (unlike Macro's direct-mutation INV-M4) — correct discipline, no integrity deviation here.
