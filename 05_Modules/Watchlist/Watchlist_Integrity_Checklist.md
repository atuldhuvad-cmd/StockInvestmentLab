# Watchlist — Integrity Checklist

*Invariants that must hold regardless of specific values. Each is proven by an executed regression assertion or by direct code reading (stated per row).*

| ID | Invariant | Status | Evidence |
|---|---|---|---|
| INV-W1 | **No NaN persisted.** A non-numeric or blank target price is stored as `null`, never `NaN`. | ✅ Verified | Regression WL-01: `"N/A"`, `""`, `"0"` → `null`; `Number.isNaN` check false. |
| INV-W2 | **Ticker required.** An item with an empty/whitespace ticker is never created. | ✅ Verified | Regression WL-01: `buildItem` returns `null`; handler adds nothing. |
| INV-W3 | **Normalization is total.** Ticker always trimmed+uppercased; notes always a trimmed string (never `undefined`). | ✅ Verified | Regression WL-01. |
| INV-W4 | **Ordering is non-mutating.** `sortByDateAdded` never reorders the stored array. | ✅ Verified | Regression WL-03: input order unchanged after call. |
| INV-W5 | **Write discipline.** Watchlist writes shared state through `WealthData` setters, not by direct mutation. | ✅ Verified | Code reading: uses `addWatchlistItem`/`removeWatchlistItem` (contrast Macro INV-M4). |
| INV-W6 | **Id round-trip.** The float id survives serialization into the `data-remove` attribute and `parseFloat(String(id))` back. | ✅ Verified | Regression WL-07: `parseFloat(String(id)) === id`; correct item removed. |
| INV-W7 | **Empty-state safety.** No data → empty sorted list, count 0, no crash. | ✅ Verified | Regression empty-state + WL-03 empty. |
| INV-W8 | **Backup round-trip safety.** Items are plain `{id, ticker, category, targetPrice, notes, dateAdded}` — JSON-native, serialize/deserialize unchanged through Export/Import. | ✅ Verified (by construction) | Only JSON-native primitives; reuses `replaceAll()` merge already verified elsewhere. |
| INV-W9 | **Presentation never mutates data.** `categoryLabel` and the chip-colour map affect display only; stored `category` is unchanged. | ✅ Verified | Code reading: mappings return/read only; no writes. |

## Summary

9 invariants checked; **all 9 hold.** No calculation-level integrity failure. The one cross-module divergence (WL-D01, Overview label drift) is a *presentation* inconsistency, not an integrity violation of Watchlist's own stored data — tracked as a Potential Defect in the Verification Report and Recommendations.
