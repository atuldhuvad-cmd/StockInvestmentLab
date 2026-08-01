# Persistence — Financial Specification

*Persistence computes no financial ratios, scores, or currency amounts — see `Persistence_CrossModule_Review.md` (Phase 1A). What follows are the module's 7 discovered infrastructure behaviours: storage model, save, load, export, and import. Numbered PER-01 through PER-07. As with Macro and Watchlist, the count reflects what the module actually does.*

**Source:** `js/persistence.js`. **Public API:** `{ save, load, exportToFile, importFromFile }`. **Storage:** IndexedDB `WealthIntelligenceSuite` (v1), one object store `appState`, one fixed record key `"main"`.

## PER-01: Single-Record Storage Model
- **Business purpose:** Persist the entire shared `WealthData` state as one JSON blob, deliberately avoiding one-table-per-entity database complexity in a browser storage API.
- **Location:** `openDB()`, store creation in `onupgradeneeded`.
- **Rule:** one object store, one fixed key (`"main"`); the whole state object is the record. `dbPromise` memoizes the open connection.
- **Verification:** structural; exercised indirectly by every save/load test.

## PER-02: Save + `lastSavedAt` Stamp
- **Location:** `save()`.
- **Rule:** `state.meta.lastSavedAt = new Date().toISOString()` on the live state, then `put(state, "main")` in a `readwrite` transaction; resolves `true` on `tx.oncomplete`.
- **Worked example:** after `save()`, `meta.lastSavedAt` is a valid ISO timestamp (verified).

## PER-03: Load — Merge-or-First-Run
- **Location:** `load()`.
- **Rule:** `get("main")`; if a record exists → `WealthData.replaceAll(record)` and resolve `true`; if absent → resolve `false` (first run, keep empty defaults).
- **Forward-compat:** `replaceAll` merges onto `emptyState()`, so a stored/imported state missing newer fields receives safe defaults rather than `undefined` — no crash. This is the "backup round-trip safety" invariant relied on across the suite.
- **Worked example:** empty store → `false`, state stays empty; a saved record → restored (holdings/watchlist back).

## PER-04: Export Payload + Filename
- **Location:** `exportToFile()`.
- **Rule:** build `exportState = { ...state, meta: { ...state.meta, lastBackupAt: <now> } }`; serialize with `JSON.stringify(…, null, 2)`; download as `wealth-intelligence-backup-<YYYY-MM-DD>.json` (date = timestamp `.slice(0,10)`).
- **Worked example:** export → payload has `meta.lastBackupAt`, includes real data; filename `wealth-intelligence-backup-2026-07-23.json` (verified).

## PER-05: Export Also Persists the Backup Timestamp
- **Location:** `exportToFile()`.
- **Rule:** after triggering the download, set `state.meta.lastBackupAt` on the live state and `await save()`; if the save fails, throw ("Backup downloaded, but its timestamp could not be saved locally.").
- **Purpose:** Overview's "backup Current/Due" indicator reads `lastBackupAt`, so the export must record when it happened.
- **Worked example:** after export, live `state.meta.lastBackupAt` equals the returned timestamp (verified).

## PER-06: Import Validation + Replace  — **PER-D01 fixed 2026-07-23**
- **Location:** `importFromFile(file)`.
- **Rule (fixed):** `JSON.parse` the file; **reject** unless it is a plain object (not `null`, not an array) carrying at least one recognized backup section (`BACKUP_KEYS`); then `WealthData.replaceAll(parsed)` and `save()`. `FileReader` errors reject the promise.
- **Confirmed Defect (PER-D01), found and fixed this pass:** the original guard only checked `typeof parsed === "object" && parsed !== null`, so `{}`, arrays, and wrong-shape objects passed and were merged onto `emptyState()` — **silently wiping all real data**, the exact outcome the guard's own comment claimed to prevent. **Proven by execution** (importing `{}` with real data present dropped holdings to 0). UI-reachable via the Import button → classified **Confirmed**.

  ### Fix Addendum (PER-D01)
  - **Original defect:** shallow `typeof === "object"` validation admits `{}`/arrays/unrelated objects → `replaceAll` onto `emptyState()` silently wipes data.
  - **Root cause:** validation could not distinguish a real backup from any JSON object.
  - **Implementation change:** added module-level `BACKUP_KEYS` (the recognized top-level sections) and tightened the guard to `typeof parsed !== "object" || parsed === null || Array.isArray(parsed) || !BACKUP_KEYS.some(k => k in parsed)`.
  - **Verification evidence:** regression suite updated to assert the corrected behaviour — `{}`, arrays, and unrelated objects are rejected and existing data is preserved; a partial-but-real backup (any known section) and a meta-only backup still import. 30/30 pass.
  - **Forward-compat preserved:** every genuine backup — including an old one missing newer fields — carries at least one known section, so the guard never rejects a real file.
  - **Date:** 2026-07-23.
- **Worked example (post-fix):** import `{}` → rejected, data preserved; import `{holdings:[…]}` → imported.

## PER-07: Error Handling
- **Location:** `save()`/`load()` `try/catch`.
- **Rule:** IndexedDB failures are caught, logged (`console.error`), and return `false` rather than throwing — the app degrades gracefully instead of crashing on a storage error.
- **Verification:** verified by reading (a real IndexedDB failure is not reproducible against the in-memory fake); see the Verification Report's fidelity limitation.

---

## Business Rules Explicitly NOT SPECIFIED / NOT IMPLEMENTED

| Question | Status |
|---|---|
| Inner-shape validation of an imported backup (field *types*, not just presence) | **PER-D02 — Potential Defect, recorded not fixed (owner decision).** `replaceAll` accepts a valid object with a wrong-typed field (e.g. `holdings: "string"`) verbatim, which would crash consumers on next render. |
| Schema-version migration on import (transform an older `schemaVersion`) | **NOT IMPLEMENTED** — `replaceAll` merges structurally but runs no version-specific migration; relies on additive, backward-compatible shape changes only. |
| Backup encryption / at-rest protection | **NOT SPECIFIED** — backups are plain JSON (documented in HOW_TO_USE as private files to protect). |
| Multi-document / multi-profile storage | **NOT SPECIFIED** — single fixed key by design (single-user assumption). |
| Confirmation before an import replaces current data | **NOT SPECIFIED at this layer** — `importFromFile` replaces unconditionally once validation passes; any confirm dialog lives in `app.js`, out of this module's scope. |
