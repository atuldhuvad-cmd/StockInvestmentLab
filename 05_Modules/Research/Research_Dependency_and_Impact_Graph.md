# Research Library — Dependency & Impact Graph

## Dependency Table

| Calculation | Depends On | Shared? | Verified |
|---|---|---|---|
| RL-01 Entry Validation | *(none — direct inputs)* | No | Pending |
| RL-02 Field Normalization | *(none)* | No | Pending |
| RL-03 Decision Conditional Assignment | *(none — direct inputs: `docType`, `decision`)* | No | Pending |
| RL-04 Entry ID & Timestamp | *(none)* | No | Pending |
| RL-05 Total Entry Count | *(none — reads `entries` directly)* | No | Pending |
| RL-06 Unique Company Count | *(none — reads `entries` directly)* | No | Pending |
| RL-07 Per-Ticker Entry Count | *(none — reads `entries` directly)* | No | Pending |
| RL-08 Ticker List Ordering | **RL-04** (needs `addedAt` for date-sort) + **RL-10** (search applied in the same pass) | No | Pending — blocked on RL-04, RL-10 |
| RL-09 Timeline Ordering | **RL-04** (needs `addedAt`) | No | Pending — blocked on RL-04 |
| RL-10 Ticker Search Filter | *(none — direct string match)* | **Yes — `ListControls.filterAndSort()`, already relied on by Fundamentals/Delivery Screener** | Verified Consistent (inherits the shared utility's existing usage, not independently re-verified from scratch) |

## Dependency Graph (visual)

```
RL-04 (ID & Timestamp) ──┬──► RL-08 (Ticker List Ordering) ◄── RL-10 (Search Filter)
                          │
                          └──► RL-09 (Timeline Ordering)

RL-01 (Validation) ──► gates whether an entry is ever created at all
RL-02 (Normalization) ──► feeds directly into the entry object RL-04 timestamps
RL-03 (Decision Conditional) ──► feeds directly into the entry object alongside RL-02

RL-05 (Total Count), RL-06 (Company Count), RL-07 (Per-Ticker Count) — each reads
the raw `entries` array independently; none depends on another.
```

**Nuance worth stating precisely, matching the discipline from Intraday's graph:** RL-08 is not purely a function of RL-04 — it also runs RL-10's search filter in the same call (`computeTickerList()` does both in one pass). A change to the search-filter logic would require re-verifying RL-08's *filtered* output, not just its *ordering* logic in isolation.

## Impact Graph

| Root Change | Must Reverify |
|---|---|
| RL-01 (Validation logic) | Nothing downstream — it only gates entry creation, an entry that fails validation is never created and so never reaches RL-05 through RL-09 |
| RL-02 / RL-03 (`buildEntry()` shape) | RL-05, RL-06, RL-07 (counts derive from the entries these functions produce) |
| RL-04 (ID/Timestamp assignment) | RL-08 (date-sort branch), RL-09 (timeline order) — both read `addedAt` directly |
| RL-10 (shared `ListControls.filterAndSort()`) | RL-08 (ticker list uses it for the search step) — **and** every other module that already depends on it (Fundamentals, Delivery Screener) — any change here is a cross-module change, not scoped to Research alone |

## Verification order for Phase 2/3 (topological)

1. **RL-01, RL-02, RL-03, RL-04, RL-05, RL-06, RL-07** (no dependencies — foundational validation, normalization, ID assignment, and raw counts)
2. **RL-10** (shared utility — already indirectly exercised by two frozen modules; verified here in Research's own context, not re-verified from scratch)
3. **RL-08** (needs RL-04, RL-10 — this is where the confirmed defect, RL-D01, was found and fixed)
4. **RL-09** (needs RL-04)
