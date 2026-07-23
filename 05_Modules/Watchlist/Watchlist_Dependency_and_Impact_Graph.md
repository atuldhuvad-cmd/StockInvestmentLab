# Watchlist — Dependency & Impact Graph

## What Watchlist depends on

| Dependency | Nature | Verified? |
|---|---|---|
| `WealthData` (`js/data-model.js`) | `getWatchlist`, `addWatchlistItem`, `removeWatchlistItem` | Yes — data model exercised by every frozen module's suite |
| `App.showStatus`, `App.saveNow` (`js/app.js`) | UI feedback + persistence, called only from `render()`'s handlers | Not exercised in Node (DOM/App layer); out of scope for calculation verification |
| DOM (`container`) | `render()`/`renderList()` only | Out of scope (verified by reading) |

Watchlist depends on **no other feature module** and on **no shared financial utility** — confirmed in Phase 1A.

## What depends on Watchlist

| Consumer | Nature | Impact of this pass |
|---|---|---|
| Router / navigation (`app.js`) | Calls `WatchlistModule.render(container)` | **None** — `render` behaviour unchanged; added object keys can't affect it |
| `overview.js` | Reads `WealthData.getWatchlist()` directly and applies its **own** `watchlistLabel()` + counts | **None from code** — Overview does not call any `WatchlistModule` function. The label duplication is the WL-D01 drift (Phase 1A), not a runtime coupling |
| `delivery-screener.js` | Navigation link only | **None** |
| `research.js` | Placeholder text only | **None** |
| JSON Export/Import (`Persistence`) | Serializes `WealthData.watchlist` as part of whole-state backup | **None** — item shape unchanged |

## Blast radius of the extraction

The Option B change extracted `buildItem`/`sortByDateAdded` from inline code and exposed them plus `categoryLabel`. It is **additive and behaviour-preserving**: the same expressions, now named; `render`/`renderList` produce identical output; `addWatchlistItem` receives the same object shape. No consumer sees any behavioural change.

Because Watchlist is a **leaf** module (nothing else calls its functions; Overview reads the shared array independently), **no other module's frozen verification is affected.** The project-wide zero-regression re-run (23 suites, 0 failures) confirms this empirically.

## Note: WL-D01 lives partly in Overview

The one cross-module item, WL-D01, is a *label-mapping divergence* between `watchlist.js` `categoryLabel()` and `overview.js` `watchlistLabel()`. Resolving it (R-1) would touch Overview — a frozen module's consumer code — so it is deferred and recommended, not applied in this Watchlist pass.
