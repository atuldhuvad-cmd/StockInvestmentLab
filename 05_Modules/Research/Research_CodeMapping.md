# Research Library — Phase 2: Code Mapping
*Ordered by dependency level per the Impact Graph, not file line order. Line numbers refer to `js/modules/research.js` unless stated otherwise — all post-extraction (Phase 2's own extraction of the pure functions below out of the previously DOM-only `render()`/`refresh()`, a zero-behavior-change refactor done to make these calculations independently testable; see `Research_CrossModule_Review.md`).*

## Verification Coverage Matrix

| Level | Calculation | File | Function | Line | Specification |
|---|---|---|---|---|---|
| 0 | RL-01 Entry Validation | `js/modules/research.js` | `validateEntry()` | 39–41 | §RL-01 |
| 0 | RL-02 Field Normalization | `js/modules/research.js` | `buildEntry()` | 45, 47–48 | §RL-02 |
| 0 | RL-03 Decision Conditional Assignment | `js/modules/research.js` | `buildEntry()` | 49 | §RL-03 |
| 0 | RL-04 Entry ID & Timestamp | `js/data-model.js` | `addResearchNote()` | 134–138 | §RL-04 |
| 0 | RL-05 Total Entry Count | `js/modules/research.js` | `computeSummary()` | 57 | §RL-05 |
| 0 | RL-06 Unique Company Count | `js/modules/research.js` | `computeSummary()` | 54, 57 | §RL-06 |
| 0 | RL-07 Per-Ticker Entry Count | `js/modules/research.js` | `computeSummary()` | 55–56 | §RL-07 |
| 0 | RL-10 Ticker Search Filter | `js/modules/research.js` (calls `js/list-controls.js`) | `computeTickerList()` → `ListControls.filterAndSort()` | 78–81 (research.js) / 17–24 (list-controls.js) | §RL-10 |
| 1 | RL-08 Ticker List Ordering | `js/modules/research.js` | `computeTickerList()` (+ helper `latestEntryTime()`) | 60–82 | §RL-08 |
| 1 | RL-09 Timeline Ordering | `js/modules/research.js` | `computeTimeline()` | 84–87 | §RL-09 |

## Coverage confirmation

Every calculation from Phase 1 (RL-01 through RL-10) is mapped to a named, independently-callable function. `render()` (line 89) and `refresh()` (line 147) are deliberately not given their own rows — they are DOM-orchestration wrappers with no independent business logic of their own once the calculations above were extracted; this matches how `fmt()`/`fmtINR()`-style display formatters were excluded from Fundamentals/Delivery Screener/Intraday's own coverage matrices.

## What Phase 2 confirms

Before this pass, all of RL-01 through RL-10's logic lived inline inside `render()`/`refresh()`, reachable only through a real DOM — the same reason none of it could be regression-tested previously (Research is the only one of the five modules verified so far that had zero exported pure functions before this pass; Portfolio, Fundamentals, Delivery Screener, and Intraday all already exported their compute functions when their own verification began). Extracting them into named functions attached to `ResearchModule`'s public interface (`validateEntry`, `buildEntry`, `computeSummary`, `computeTickerList`, `computeTimeline`) is a **zero-behavior-change refactor** — confirmed by manual trace: each extracted function reproduces the exact inline expression it replaced, verified line-by-line against the pre-extraction source before the RL-D01 fix was applied on top of it. This is what made Phase 3's execution-based defect discovery (RL-D01) possible at all.

**Status: Phase 2 complete.**
