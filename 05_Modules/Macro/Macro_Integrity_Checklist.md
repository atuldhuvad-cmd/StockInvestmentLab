# Macro Intelligence — Integrity Checklist

*Invariants that must hold regardless of specific numeric values. Each is either proven by an executed regression assertion or by direct code reading (stated per row).*

| ID | Invariant | Status | Evidence |
|---|---|---|---|
| INV-M1 | **No live data fetch.** The module never performs a network request; all data enters via `importSnapshot(json)`. | ✅ Verified | Regression asserts no `fetch(` / `XMLHttpRequest` in source; code reading confirms `importSnapshot` is the sole data-entry path. |
| INV-M2 | **No duplicate points per date.** Importing the same `date` twice for an indicator never grows the series; it overwrites in place. | ✅ Verified | Regression MAC-01 upsert case: length stays 1 after same-date re-import. |
| INV-M3 | **Chronological correctness independent of insertion order.** `latestTwo` returns the two newest by *date*, and never mutates the stored series. | ✅ Verified | Regression MAC-02: out-of-order import + slice-immutability assertions. |
| INV-M4 | **Shared-state write discipline.** Modules should write through `WealthData` setters. | ⚠️ **Deviation recorded (non-financial).** | Code reading: `importSnapshot` mutates `WealthData.get().macroIndicators` **directly** (line 46) because the data model exposes no macro setter. The write is correct and the shared-by-reference state ends up right, but it bypasses the setter convention (`data-model.js` lines 9–14). Not a financial defect; flagged for a future `WealthData.upsertMacroPoint()` — see Recommendations. |
| INV-M5 | **No NaN persisted.** A present-but-non-numeric field must never be stored or counted. | ✅ Verified — **after MAC-D01 fix** | Before the fix this invariant was *violated* (NaN stored/counted); the Phase 6A guard restores it. Regression MAC-D01 post-fix cases: count 0, no series created. |
| INV-M6 | **Valid `0` is not dropped.** A legitimate zero reading (e.g. FII flow 0) is stored, not treated as "missing". | ✅ Verified | Regression MAC-01: `fii_flow:0` → count 1, value 0 stored. |
| INV-M7 | **Empty-state safety.** With no data, every indicator resolves to null latest/previous and a null delta, with no crash. | ✅ Verified | Regression: all-7-indicator empty-state loop. |
| INV-M8 | **Backup round-trip safety.** Macro points are plain `{date, value, source}` objects, so they serialize/deserialize through the app's JSON Export/Import unchanged. | ✅ Verified (by construction) | Points contain only JSON-native primitives; no functions, dates-as-objects, or circular refs. Reuses `WealthData.replaceAll()` merge, already verified for other modules. |

## Summary

8 invariants checked; **7 hold, 1 is a recorded non-financial deviation** (INV-M4, direct-mutation write). INV-M5 held only after the MAC-D01 fix and is now green. No calculation-level integrity failure remains.
