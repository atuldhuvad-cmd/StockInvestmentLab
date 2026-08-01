# Persistence — Recommendations

*Non-blocking follow-ups surfaced during verification. None blocked the v1.0 freeze (PER-D01, the one Confirmed Defect, was fixed this pass). Ordered by value, per the Charter's three-question gate.*

## R-1 — Real-browser Export/Import/reload check (fidelity gap, owed)
- **What:** This module was verified with stubbed browser APIs (Option A). A stubbed IndexedDB is not proof of a real browser round-trip.
- **Why:** The fakes cannot reproduce structured-clone serialization, quota, transaction durability, or `FileReader`/download behaviour. The only way to fully trust the layer is to exercise it on-device.
- **Action:** In a real browser — Export a backup, Import it in a fresh profile, reload, and confirm the state survives. Ideally on a 6.5" Android phone too, per the mobile-first rule.
- **Cost/risk:** Manual, ~10 minutes. **Recommended before Release 1.0** — this is the standing "verified in Node ≠ verified in a browser" item, made explicit for the persistence layer specifically.

## R-2 — Inner-shape validation on import (PER-D02, Potential Defect)
- **What:** `replaceAll` accepts a valid backup object with a wrong-typed field (e.g. `holdings: "string"`) verbatim, which would crash consumers on next render.
- **Why:** Defence-in-depth beyond PER-D01's presence check — validate that each present section is the right *type* (array vs object) before trusting it.
- **Proposed fix:** In `importFromFile` (or a small `WealthData.isPlausibleState()` helper), after the PER-D01 presence check, verify the type of each present section against the expected shape; reject or coerce on mismatch.
- **Cost/risk:** Low-moderate. **Owner decision 2026-07-23: recorded and recommended, not fixed this pass.** Realistically only reachable via a hand-malformed backup (see Dependency graph).

## R-3 — (Optional) Confirm-before-replace on import
- **What:** `importFromFile` replaces current data unconditionally once validation passes; any confirmation lives in `app.js`.
- **Why:** A second guard against accidental data loss — even a valid backup replaces everything.
- **Cost/risk:** Low; belongs in `app.js` (the import button handler), not this module. **Recommend as a UX safety add**, out of Persistence's own scope.

## R-4 — (Optional) Schema-version migration hook
- **What:** `replaceAll` merges structurally but runs no version-specific migration; the design relies on additive, backward-compatible shape changes only.
- **Why:** If a future change ever needs to *transform* an old field (not just add a new one), there's no migration seam.
- **Cost/risk:** Speculative. **Not recommended now** — the additive-only discipline has held; add a migration hook only when a real breaking shape change is actually needed (matches the "don't build infrastructure ahead of need" rule).

---

**Freeze disposition:** PER-D01 (Confirmed) is fixed and re-verified — Persistence is frozen v1.0. R-1 (real-browser check) and R-2 (PER-D02) are the notable open items; neither blocks the freeze, and R-1 applies to the whole app, not just this module.
