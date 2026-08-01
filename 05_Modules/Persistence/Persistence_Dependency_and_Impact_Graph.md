# Persistence — Dependency & Impact Graph

## What Persistence depends on

| Dependency | Nature | Verified? |
|---|---|---|
| `WealthData` (`js/data-model.js`) | `get()` (save/export), `replaceAll()` (load/import) | Yes — `replaceAll` exercised directly and via load/import |
| `indexedDB` (browser) | the durable store | Via in-memory fake (see fidelity limitation) |
| `FileReader`, `Blob`, `URL`, `document` (browser) | import read + export download | Via fakes |
| `console` | error logging on the catch paths | n/a |

Persistence depends on **no feature module** and calls into none.

## What depends on Persistence

| Consumer | Nature | Impact of this pass |
|---|---|---|
| `app.js` | `save()` (manual + 60s autosave + `beforeunload`), `load()` (init), `exportToFile()`/`importFromFile()` (buttons) | **None** — public API unchanged; the PER-D01 fix only makes `importFromFile` reject non-backup files it should already have rejected |
| Every feature module | indirectly, via `App.saveNow()` after each mutation | **None** — save path unchanged |
| Overview | reads `meta.lastBackupAt` for the backup-status indicator | **None** — export still records `lastBackupAt` |

## Blast radius of the PER-D01 fix

The fix tightens `importFromFile`'s validation only. Behaviour changes **exclusively** for input that was previously mis-accepted (`{}`, arrays, unrelated objects → now rejected with a clear error). Every genuine backup still imports (forward-compat preserved — proven for full, partial, and meta-only backups). `save`, `load`, `exportToFile`, and the whole save path are untouched.

Persistence is a **foundational leaf**: everything depends on it for durability, but it depends on no module, so a change here cannot alter any module's *calculations*. The project-wide zero-regression re-run (25 suites, 0 failures) confirms this empirically — no frozen module's suite changed.

## Note on the shared primitive

`WealthData.replaceAll()` is used only by Persistence. Its unfixed inner-shape gap (PER-D02) is therefore contained to the import path — the only route by which externally-supplied, unvalidated data reaches it. `load()` reads data the app itself wrote, so PER-D02 is realistically only reachable via a hand-malformed imported backup.
