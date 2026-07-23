# Watchlist — Verification Report

**Role:** Independent Verification Engineer. Every calculation assumed incorrect until proven otherwise by real, executed test vectors.
**Date:** 2026-07-23. **Module version:** v1.0 (first freeze).
**Result:** Verified • Frozen. 7 business-rule calculations (WL-01–07), **0 Confirmed Defects**, 1 Potential Defect (WL-D01, Overview label drift — recorded, not fixed, per owner decision). **41/41** regression tests pass (`Watchlist_regression_tests.js`, exit 0).

---

## Method

The suite loads the real `js/data-model.js` and `js/modules/watchlist.js` (robust `__dirname → 01_Source/wealth-suite` path) and exercises the actual `buildItem()`, `sortByDateAdded()`, `categoryLabel()`, and the real `WealthData` watchlist API. Expected values are derived independently of the code under test; `WealthData.reset()` isolates cases.

## WL-01 — Add Validation + Normalization (`buildItem`)

| Vector | Expected | Result |
|---|---|---|
| `"  wipro  "` ticker | `"WIPRO"` | PASS |
| whitespace-only / missing ticker | `null` (invalid) | PASS |
| notes `"  buy the dip  "` | `"buy the dip"` | PASS |
| missing notes | `""` (not undefined) | PASS |
| category passthrough | `"Buy Soon"` | PASS |
| target `"450.5"` / `"450"` | `450.5` / `450` | PASS |
| target `""` | `null` | PASS |
| target `"0"` | `null` (0 falsy — documented rule) | PASS |
| target `"N/A"` | `null`, **not NaN** | PASS |

**Positive result (MAC-D01 contrast):** the `parseFloat(x) || null` idiom means a non-numeric target can never be stored as `NaN` — the exact bug Macro had. Proven by execution.

**Note on the `0` target — preserved existing behaviour, not a new decision:** the same `|| null` truthy-guard also maps a `0` target price to `null`, because `0` is falsy (`parseFloat("0") === 0`, then `0 || null → null`). This is the pre-existing behaviour of the module and was preserved unchanged by the Option B extraction — `buildItem` copies the expression verbatim. It is the same truthy-guard pattern relied on in the FUND-D01 fix family, where a falsy/guarded value short-circuits to a safe sentinel rather than flowing through as a misleading number. For Watchlist this is benign and arguably correct — a target price of `0` is not a meaningful target, so treating it as "no target" (`null` → displayed as `—`) matches user intent. Recorded explicitly so the `0 → null` coercion is a documented, intentional-by-preservation behaviour, not an unexamined side effect.

## WL-02 — Category Label Mapping (`categoryLabel`)

| Vector | Expected | Result |
|---|---|---|
| Watch / Buy Soon / Reject | as-is | PASS |
| Research | "Needs Study" | PASS |
| unknown "Hold" | "Hold" (raw) | PASS |
| missing (undefined) | `undefined` (raw) — WL-D01 drift point | PASS |

## WL-03 — List Ordering (`sortByDateAdded`)

| Vector | Expected | Result |
|---|---|---|
| Jan/Jun/Mar items | `[Jun, Mar, Jan]` (newest first) | PASS |
| input array after call | unchanged (non-mutating slice) | PASS |
| empty | `[]` | PASS |

## WL-07 + data model — Add / Remove / Id Round-Trip

| Vector | Expected | Result |
|---|---|---|
| add normalized item | stored; id is number; dateAdded valid ISO; ticker "TCS", notes "quality" | PASS |
| `parseFloat(String(id))` | `=== id` (round-trips exactly) | PASS |
| remove by id | only targeted item removed; correct item remains | PASS |

The id round-trip matters because the Remove button serializes the float id into a `data-remove` attribute and parses it back; verified it survives the round-trip exactly.

## WL-04 / WL-05 — RE-DERIVED (not the live render path)

WL-04 (count/pluralization) and WL-05 (target display) live inline in the DOM-coupled `renderList()`. Verified by **re-derivation** over real data, explicitly not the live path:

| Vector | Expected | Result |
|---|---|---|
| 1 item | "1 stock" | PASS |
| 2 items | "2 stocks" | PASS |
| target 450000 | "₹4,50,000" (en-IN grouping) | PASS |
| target null | "—" | PASS |

## WL-06 — verified by reading

`CATEGORY_COLOR` maps the four categories to chip classes; an unknown category yields `undefined` → `class="chip undefined"`. Cosmetic, not UI-reachable (fixed dropdown). Recorded in the Financial Specification's NOT SPECIFIED table, not a defect.

## WL-D01 — Potential Defect: Overview label drift (Phase 1A)

Overview's `watchlistLabel()` and Watchlist's `categoryLabel()` agree on all four real categories but diverge on a missing/empty category (Watchlist → the falsy value; Overview → `"Unclassified"`). Proven by execution (re-derivation of overview.js lines 34-36). **Classified Potential** (not UI-reachable), and per owner decision (2026-07-23) **recorded and recommended for consolidation, not fixed this pass** — see `Watchlist_Recommendations.md` R-1. Not blocking freeze, consistent with FIN-F08/IN-01 precedent.

## Cross-cutting checks

| Check | Result |
|---|---|
| Empty-state safety (`sortByDateAdded([])`, empty watchlist) | PASS |
| Public API surface = `buildItem, categoryLabel, render, sortByDateAdded` | PASS |
| Writes through `WealthData` setters (no direct-mutation deviation) | PASS (contrast Macro INV-M4) |

## Zero-regression confirmation

Full project re-run from repo root after the extraction: **23 suites, 0 failures** — all six previously-frozen modules unaffected (Fundamentals 43, Delivery 15, Intraday 18, Research 46, Macro 38, Portfolio ✓, plus paper-trading/price-history/workflow suites). No product regression.

## Conclusion

Watchlist is **Verified • Frozen at v1.0**. Zero Confirmed Defects; one Potential Defect (WL-D01) recorded and deferred by owner decision. The extraction was behaviour-preserving and approved before applying; WL-04/05 re-derivation and WL-06 read-level coverage are documented rather than overclaimed. See `Watchlist_Recommendations.md` for non-blocking follow-ups.
