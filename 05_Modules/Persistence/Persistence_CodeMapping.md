# Persistence — Code Mapping (Phase 2)

*Maps each specified behaviour to the exact production code. The tests run the real functions against in-memory browser-API fakes (Option A) — nothing in `persistence.js` is reimplemented or modified for testability.*

**Module shape:** `Persistence = (function(){ … })()`. Public surface: `{ save, load, exportToFile, importFromFile }` (unchanged by this pass — no exposure change needed; Option A stubs the environment instead).

| Behaviour | Function | Location | Executed in Node tests? |
|---|---|---|---|
| PER-01 | `openDB()` + store creation | `persistence.js` lines 27-41 | Yes — via the fake `indexedDB` |
| PER-02 | `save()` | lines ~43-58 | **Yes** — real function, fake IndexedDB |
| PER-03 | `load()` | lines ~60-80 | **Yes** — real function, fake IndexedDB |
| PER-04/05 | `exportToFile()` | lines ~82-106 | **Yes** — real function, fake `Blob`/`URL`/`document` + fake IndexedDB |
| PER-06 | `importFromFile(file)` | lines ~108-129 | **Yes** — real function, fake `FileReader` |
| PER-07 | `save`/`load` `try/catch` | inline | No — verified by reading (fake can't reproduce a real storage failure) |

## The source change made this pass (PER-D01 fix — Phase 6A)

**No testability/exposure change** was needed (Option A stubs the environment). The only source change is the **PER-D01 defect fix** in `importFromFile`:

1. Added module-level `const BACKUP_KEYS = [ …14 recognized top-level sections… ]`.
2. Tightened the import guard from `typeof parsed !== "object" || parsed === null` to also reject arrays and objects with no recognized section: `… || Array.isArray(parsed) || !BACKUP_KEYS.some(k => k in parsed)`.

This changes behaviour **only** for input that was previously mis-accepted (`{}`, arrays, unrelated objects → now rejected). Every genuine backup — including a forward-compat old one missing newer fields — carries at least one known section and still imports. Verified by the updated regression suite (30/30).

## How the Option A fakes map to the real APIs

| Real API used by `persistence.js` | Fake provided by the harness |
|---|---|
| `indexedDB.open` → `onupgradeneeded`/`onsuccess`, `db.transaction`, `objectStore.put`/`get`, `tx.oncomplete`/`req.onsuccess` | In-memory `Map`-backed store; async callbacks fired via `queueMicrotask` to mirror the request/transaction ordering the code relies on |
| `FileReader.readAsText` → `onload({target:{result}})` | Fake reader that resolves `file._text` via microtask |
| `Blob`, `URL.createObjectURL`/`revokeObjectURL`, `document.createElement('a')`/`body.appendChild`/`removeChild`/`a.click()` | Minimal stubs; the Blob stub captures the serialized payload and the anchor captures the `download` filename for assertion |

## Data-model touchpoints

- `WealthData.get()` (save/export read the live state), `WealthData.replaceAll()` (load/import replace), `WealthData` getters used by the tests to assert round-trip results. `replaceAll` lives in `js/data-model.js` and is exercised directly as well as through `load`/`importFromFile`.
