# Persistence — Verification Report

**Role:** Independent Verification Engineer. Every behaviour assumed incorrect until proven otherwise by real, executed test vectors.
**Date:** 2026-07-23. **Module version:** v1.0 (first freeze).
**Result:** Verified • Fixed • Re-Verified • Frozen. 7 infrastructure behaviours (PER-01–07), **1 Confirmed Defect found and fixed (PER-D01)**, 1 Potential Defect recorded (PER-D02). **30/30** regression tests pass (`Persistence_regression_tests.js`, exit 0).

---

## ⚠️ Fidelity limitation — stubbed IndexedDB is NOT proof of a real browser round-trip

This module was verified with **Option A**: the real `save`/`load`/`exportToFile`/`importFromFile` functions run against **in-memory fakes** for `indexedDB`, `FileReader`, `Blob`, `URL`, and `document`. This exercises the code's control flow and data handling faithfully, but it is **not equivalent to a real browser**. Specifically, the fakes do **not** reproduce:
- a real IndexedDB engine, its **structured-clone** serialization of the stored object, storage **quota** limits, or `onblocked`/version-change semantics;
- real **transaction durability** and failure modes (the PER-07 error path is therefore verified by *reading*, not execution);
- real `FileReader`/`Blob`/download behaviour in a browser sandbox.

**A passing suite here means the logic is correct against a faithful mock. A real on-device check is still owed** — actually Export a backup, Import it in a fresh browser profile, and reload — before the persistence layer is trusted end-to-end. This is recorded as an explicit outstanding item (Recommendations R-1), consistent with the project's standing honesty about "verified in Node ≠ verified in a browser."

## Method

The suite installs the fakes, then `eval`s the real `js/data-model.js` and `js/persistence.js` and calls the actual public functions. `WealthData.reset()` and the fake store isolate cases; expected values are derived independently of the code under test.

## PER-01 / PER-02 / PER-03 — Storage, Save, Load (round-trip)

| Vector | Expected | Result |
|---|---|---|
| empty store → `load()` | resolves `false`; state stays empty (first run) | PASS |
| `save()` with holdings+watchlist | resolves `true`; `meta.lastSavedAt` valid ISO | PASS |
| `reset()` then `load()` | resolves `true`; holdings/watchlist restored; ticker "TCS" back | PASS |

## PER-03 forward-compat — `replaceAll` fills missing newer fields

| Vector | Expected | Result |
|---|---|---|
| `replaceAll({holdings:[…]})` (backup missing other sections) | `priceHistory` defaults to `{}`, `watchlist` to `[]`, no crash; present field kept | PASS |

## PER-04 / PER-05 — Export

| Vector | Expected | Result |
|---|---|---|
| `exportToFile()` | returns ISO timestamp; payload has `meta.lastBackupAt`; payload includes real data; filename `wealth-intelligence-backup-<date>.json`; live `meta.lastBackupAt` updated | PASS (5 assertions) |

## PER-06 — Import validation (the guard that already worked)

| Vector | Expected | Result |
|---|---|---|
| JSON string / number / `null` / malformed JSON | rejected | PASS (4) |
| a real backup (holdings/watchlist/meta) | imported; holding "ITC" present | PASS |

## PER-D01 — Confirmed Defect → FIXED (Phase 6A)

**Discovery (pre-fix, proven by execution):** importing `{}` with real data present dropped holdings to **0** — the shallow `typeof === "object"` guard admitted the empty object, and `replaceAll({})` reset the entire state to `emptyState()` and saved it. A JSON array was likewise not rejected. This contradicts the guard's own comment ("an empty or malformed file should not silently wipe real data"). **UI-reachable** via the Import button (a user selecting any non-backup `.json`) → classified **Confirmed** per owner rule. Severity high — silent loss of the complete financial record.

**Phase 6A Mandatory Defect Resolution Cycle (all steps completed):**
1. **Code fixed** — added `BACKUP_KEYS` and required a plain object (not array) carrying at least one recognized section before `replaceAll`.
2. **Specification updated** — `Persistence_Financial_Specification.md` PER-06 + Fix Addendum.
3. **Regression tests updated** — assertions flipped from the defect to the fix.
4. **Suite executed** — 30 passed, 0 failed, exit 0.
5. **Real-world revalidation** — genuine backups (full, partial-single-section, meta-only) still import; non-object rejections unchanged; round-trip/export unaffected.
6. **Frozen** — PER-D01 recorded as a fixed attribute of the v1.0 first freeze.

**Post-fix vectors:**

| Vector | Expected | Result |
|---|---|---|
| import `{}` | rejected; existing holdings preserved (count 1) | PASS |
| import `[1,2,3]` | rejected | PASS |
| import `{foo:1, bar:2}` (no known keys) | rejected | PASS |
| import `{holdings:[…]}` (partial real backup) | imported ("MINI") | PASS |
| import `{meta:{schemaVersion:4}}` (meta-only) | accepted | PASS |

## PER-D02 — Potential Defect (recorded, not fixed, per owner decision)

`replaceAll` performs no inner-shape validation: `replaceAll({holdings:"not an array"})` stores the string verbatim, which would crash consumers that `.map`/`.filter` over holdings. Proven by execution (the field is accepted as-is). More contrived than PER-D01 (needs a specifically type-corrupted field within an otherwise-valid backup). **Recorded and recommended (Recommendations R-2); not fixed this pass.** Not blocking freeze — consistent with FIN-F08/IN-01/WL-D01 precedent for Potential defects.

## Cross-cutting

| Check | Result |
|---|---|
| Public API surface = `exportToFile, importFromFile, load, save` | PASS |
| PER-07 error handling (catch → return false) | Verified by reading (fake can't fail realistically) |

## Zero-regression confirmation

Full project re-run from repo root after the fix: **25 suites, 0 failures** — all seven previously-frozen modules unaffected. No product regression.

## Conclusion

Persistence is **Verified • Fixed • Re-Verified • Frozen at v1.0**. One Confirmed Defect (PER-D01, silent-wipe on import) found by execution and fully resolved via Phase 6A; one Potential Defect (PER-D02) recorded and deferred by owner decision. The stub-fidelity limitation above is explicit — a real-browser Export/Import/reload check remains owed (R-1).
