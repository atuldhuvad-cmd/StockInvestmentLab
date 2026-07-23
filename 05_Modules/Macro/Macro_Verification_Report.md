# Macro Intelligence — Verification Report

**Role:** Independent Verification Engineer. Every calculation assumed incorrect until proven otherwise by real, executed test vectors — not hand-asserted.
**Date:** 2026-07-23. **Module version:** v1.0 (first freeze).
**Result:** Verified • Fixed • Re-Verified • Frozen. 3 calculations (MAC-01–03), 1 Confirmed Defect found and fixed (MAC-D01). **38/38** regression tests pass (`Macro_regression_tests.js`, exit 0).

---

## Method

The suite loads the real `js/data-model.js` and `js/modules/macro.js` (robust `__dirname → 01_Source/wealth-suite` path) and exercises the actual `importSnapshot()` and `latestTwo()`. Assertions use exact/deep equality; every expected value is derived independently of the code under test. `WealthData.reset()` isolates each case.

## MAC-01 — Snapshot Import & Upsert-by-Date

| # | Vector | Expected | Result |
|---|---|---|---|
| 1 | Full 7-field snapshot | count 7; repoRate=5.5, source "import", date carried; FII −2500 preserved | PASS |
| 2 | Numeric string `"85.6"` | parsed to 85.6 | PASS |
| 3 | `cpi:null` alongside `repo_rate:5.5` | count 1; cpiInflation series never created | PASS |
| 4 | `fii_flow:0` | count 1; value 0 stored (valid, not skipped) | PASS |
| 5 | Unrecognized keys (`gdp`, `unemployment`) | count 0 | PASS |
| 6 | Missing `date` | point date = today's ISO yyyy-mm-dd | PASS |
| 7 | Same date re-imported (5.50 → 5.75) | length stays 1; value overwritten to 5.75 | PASS |
| 8 | Then a new date | length 2 (appends) | PASS |

**Boundary insight (positive result):** the `=== null/undefined` guard — rather than a falsy check — is *correct*, and is what lets a genuine `0` reading through while still skipping absent fields. Verified by execution, not assumed.

## MAC-D01 — Confirmed Defect: non-numeric field stored/counted as NaN → FIXED (Phase 6A)

**Discovery (pre-fix, proven by execution):** `importSnapshot({date:"…", cpi:"N/A"})` returned count **1** and stored `{value: NaN}` in `cpiInflation`. `parseFloat("N/A") → NaN`, and the original code stored/counted it with no guard. Downstream, `refresh()` would render the literal string `"NaN"` as the reading and `"NaN vs prior"` as the change — the same broken-UI-text class as Fundamentals' FUND-D02/D03 ("Infinity%"/"NaN%"). **Reachable** via the module's primary import surface (a pasted snapshot with a non-numeric or `"N/A"` field), so classified **Confirmed**, not Potential.

**Phase 6A Mandatory Defect Resolution Cycle (all steps completed):**
1. **Code fixed** — minimal change: parse first, skip non-finite. `const num = parseFloat(value); if (Number.isNaN(num)) return;` then store `num`.
2. **Specification updated** — `Macro_Financial_Specification.md` MAC-01 records the guard and the fix.
3. **Regression tests updated** — the two assertions that pinned the *defective* behaviour were replaced with assertions of the *corrected* behaviour (non-numeric field → count 0, series not created; mixed snapshot counts only the numeric field; empty-string field skipped).
4. **Suite executed** — 38 passed, 0 failed, exit 0.
5. **Real-world revalidation** — valid numeric snapshots (including `0`) unchanged; only previously-broken input changes. Confirmed by the MAC-01 table above still passing.
6. **Frozen** — as v1.0, MAC-D01 recorded as a fixed attribute of that first freeze (same convention as Fundamentals' 4 fixed defects at v1.0).

**Post-fix vectors:**

| Vector | Expected | Result |
|---|---|---|
| `cpi:"N/A"` | count 0; no cpiInflation series | PASS |
| `{repo_rate:5.5, cpi:"N/A"}` | count 1; repoRate=5.5; cpiInflation absent | PASS |
| `usd_inr:""` | count 0 (parseFloat("")=NaN) | PASS |

## MAC-02 — Latest-Two Chronological Selection

| Vector | Expected | Result |
|---|---|---|
| Empty series | `{latest:null, previous:null}` | PASS |
| Single point | latest set, previous null | PASS |
| Import 2026-03 then 2026-01 (out of order) | latest = Mar (newest date), previous = Jan | PASS |
| Three points Jan/Feb/Mar | latest = Mar, previous = Feb (not the oldest) | PASS |
| Order after a `latestTwo` call | stored insertion order unchanged (`.slice()` used) | PASS |

The out-of-order case is the important one: it proves selection is by **date**, not insertion order.

## MAC-03 — Change vs Prior (RE-DERIVED, not the live render path)

**Scope disclosure (per the approved 2026-07-23 decision):** MAC-03's delta lives inline inside the DOM-coupled `refresh()`, which cannot execute in Node without a document. Only `latestTwo` was exposed; `refresh()` was deliberately left unchanged. MAC-03 is therefore verified by **re-derivation** — the test computes `previous ? latest.value - previous.value : null`, a **verbatim copy of source line 108**, over the **real** `latestTwo()` output. This confirms the arithmetic and the null-handling, but it is **not** a test of the live `refresh()` render path (colour/sign/`toFixed(2)` formatting is verified by reading, not execution). Stated plainly rather than overclaimed.

| Vector | Expected | Result |
|---|---|---|
| 5.0 then 5.5 | +0.5 | PASS |
| 6.25 then 6.0 | −0.25 | PASS |
| Single point | null (no prior) | PASS |
| No data | null | PASS |

## Cross-cutting checks

| Check | Expected | Result |
|---|---|---|
| Standalone / empty-state across all 7 indicators | every indicator `{null,null}`, delta null, no crash | PASS |
| Import-Driven Data Rule | no `fetch(` and no `XMLHttpRequest` in the module source | PASS |
| Public API surface | exactly `importSnapshot, latestTwo, render` | PASS |

## Zero-regression confirmation

After the MAC-D01 source change and the PROJ-D01 harness fix applied in the same pass, all previously-frozen modules were re-run on execution and pass: **Fundamentals 43/43, Delivery Screener 15/15, Intraday 18/18, Research 46/46, Portfolio ✓** (plus PaperDelivery 49, PaperQuotes 13, PriceHistory 55, Portfolio active-compat 16, Portfolio txn-ledger 40, Workflow 14+24). No product regression introduced.

## Conclusion

Macro is **Verified • Fixed • Re-Verified • Frozen at v1.0**. One Confirmed Defect (MAC-D01) found by execution and fully resolved via Phase 6A. One integrity observation (INV-M4, direct-mutation write) recorded — non-financial, non-blocking. MAC-03's re-derivation limitation is documented, not hidden. See `Macro_Recommendations.md` for non-blocking follow-ups.
