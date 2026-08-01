# Persistence — Integrity Checklist

*Invariants that must hold regardless of specific values. Each is proven by an executed regression assertion or by direct code reading (stated per row). See the Verification Report's fidelity limitation — "verified against a faithful mock," not a real browser.*

| ID | Invariant | Status | Evidence |
|---|---|---|---|
| INV-PE1 | **Round-trip fidelity.** `save()` then `load()` restores the same state (against the mock). | ✅ Verified | Regression: holdings + watchlist restored after reset+load. |
| INV-PE2 | **First-run safety.** An empty store never crashes; `load()` returns `false` and leaves the empty default state. | ✅ Verified | Regression PER-03 first-run. |
| INV-PE3 | **Forward compatibility.** A stored/imported state missing newer sections receives safe defaults via `replaceAll`, never `undefined`. | ✅ Verified | Regression: partial backup → `priceHistory:{}`, `watchlist:[]`, no crash. |
| INV-PE4 | **No silent wipe from a non-backup file.** An empty/wrong-shape/array file must not replace real data. | ✅ Verified — **after PER-D01 fix** | Before the fix this invariant was *violated* (`{}` wiped data); the guard now rejects such files and preserves data. Regression PER-D01 post-fix. |
| INV-PE5 | **Genuine backups always import.** The tightened guard never rejects a real backup, including a forward-compat old one. | ✅ Verified | Regression: full, partial-single-section, and meta-only backups all import. |
| INV-PE6 | **Export self-documents.** The exported payload carries `meta.lastBackupAt`, and the live state records the same, so the backup-status indicator is accurate. | ✅ Verified | Regression PER-04/05. |
| INV-PE7 | **Graceful storage failure.** An IndexedDB error is caught and returns `false` rather than throwing. | ⚠️ Verified by reading | Cannot be reproduced against the in-memory fake; `try/catch` confirmed by code reading. |
| INV-PE8 | **Inner-shape trust.** `replaceAll` assumes each section is the right *type*. | ❌ **Not guaranteed (PER-D02, Potential).** | Regression proves a wrong-typed field (`holdings:"string"`) is accepted verbatim. Recorded, not fixed (owner decision). |

## Summary

8 invariants checked; **6 hold, 1 verified by reading (INV-PE7), 1 not guaranteed (INV-PE8 / PER-D02, a recorded Potential defect).** INV-PE4 held only after the PER-D01 fix and is now green. The core durability and no-silent-wipe guarantees are in place; the remaining gap (deep type validation of imports) is the recorded PER-D02.
