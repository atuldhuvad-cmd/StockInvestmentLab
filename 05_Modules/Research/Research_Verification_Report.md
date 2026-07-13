# Research Library — Verification Report

## Phase 1A: Cross-Module Consistency Review
See `Research_CrossModule_Review.md`. Zero prior Research entries in the Registry, confirmed clean start. No duplicated *financial* calculation found — this module computes none. One non-financial duplicated pattern noted for transparency (ID/timestamp generation, shared with three other `add*` methods) but correctly excluded from the Financial Calculation Registry's scope. One Confirmed Defect found during this review (RL-D01, sort control inert), resolved via Phase 6A below.

## Phase 1: Financial Specification
See `Research_Financial_Specification.md`. 10 calculations discovered (RL-01 through RL-10) — validation, normalization, ID/timestamp assignment, counting, and two ordering rules (ticker-list and per-ticker timeline) plus a shared search filter. Three business rules recorded as NOT SPECIFIED/NOT IMPLEMENTED (unused `aiAnalysis`/`sourceUrl` schema fields, no content-length limit, no duplicate detection).

## Phase 2: Code Mapping
See `Research_CodeMapping.md` and `Research_Dependency_and_Impact_Graph.md`. All 10 calculations mapped to named, independently-callable functions — extracted from what was previously DOM-only inline logic inside `render()`/`refresh()` (Research is the first of the five modules verified so far that required this extraction; the other four already exported pure compute functions before their own verification began). Extraction confirmed zero-behavior-change by manual line-by-line trace before the RL-D01 fix was layered on top.

## Phase 3: Numerical Verification
`Research_regression_tests.js` — **32/32 pass**, run against the actual production functions.

**Key findings from execution, not assumption:**
- **RL-D01 proven by direct execution before any fix was applied:** a two-ticker dataset engineered so alphabetical order and recency order disagree (`AAACO` older, `ZZZCO` newer) produced the identical `["AAACO","ZZZCO"]` result for both `sortKey="ticker"` and `sortKey="date"` against the pre-fix `computeTickerList()` — proving the sort dropdown was fully inert, not inferred from reading the code alone. See the probe run recorded in this session's history and referenced in the Financial Specification.
- **A test-quality issue found and corrected during this same pass, recorded for transparency:** the first version of the RL-08 regression test relied on real wall-clock gaps between two synchronous `addResearchNote()` calls to produce distinct `addedAt` timestamps. Because `Date.now()`'s 1ms resolution can tie for two statements executed back-to-back, this produced one flaky failure on the first full-suite run (the two entries landed in the same millisecond, so the tie-break preserved insertion order — coincidentally identical to the alphabetical case, masking whether the fix actually worked). Fixed by explicitly setting `addedAt` on both entries after creation, the same deterministic-timestamp technique already used in the RL-09 test. This was a test-authoring gap, not a product defect — the fix to `computeTickerList()` itself was already correct; the test just needed to eliminate its own timing dependency to prove it reliably.
- **Standalone Value Rule confirmed by direct execution**, not just design intent: a ticker with a research entry and zero `securities`/`fundamentals` record correctly saves, counts, and lists, with `getSecurity()`/`getFundamentals()` both returning `undefined` and no downstream crash.

## Phase 5: Integrity Verification
6 checks run, 6 passed — see `Research_Integrity_Checklist.md`. Empty-state safety (zero entries), `undefined`-input safety in `validateEntry()`, the `decision`-field guard holding even when a stray value is passed for a non-Decision-Record entry, and the sort-order fix all confirmed by direct execution.

## Phase 6A: Mandatory Defect Resolution Cycle (RL-D01)
1. **Corrected the code** — `computeTickerList()` in `js/modules/research.js` now branches on `sortKey`, sorting by each ticker's most recent `addedAt` (descending) when `sortKey === "date"`, falling back to alphabetical otherwise. Minimum change: no unrelated refactoring bundled in beyond the Phase-2 extraction that made this function callable at all.
2. **Updated the Financial Specification** — §RL-08 now documents the fixed formula, with the original defect and fix recorded as a dated note rather than silently overwritten.
3. **Updated the regression suite** — `Research_regression_tests.js` asserts the corrected behavior (diverging orders for `sortKey="ticker"` vs `sortKey="date"`), with the pre-fix expected value noted in the test label for traceability.
4. **Executed the complete regression suite** — 32/32 pass, exit code 0.
5. **Re-validated representative data** — the Standalone Value Rule scenario and empty-state checks (unaffected by this fix) were re-run in the same pass and remain correct.
6. **Freezing now** — all five prior steps complete.

## Confirmed Defects
**One, found and fixed within this same verification pass: RL-D01.** No defect remains open.

## Regression re-run: previously frozen modules unaffected
This module's only source change was to `research.js` (a file no other module reads or calls into — confirmed by Phase 1A). Per the execution requirements, all previously frozen module suites were re-run anyway:

| Suite | Result |
|---|---|
| Portfolio | 9/9 PASS |
| Fundamentals | 17/17 PASS |
| Delivery Screener | 15/15 PASS |
| Intraday | 18/18 PASS |
| **Research (new)** | **32/32 PASS** |
| **Total** | **91/91 PASS** |

## Status: Verified • Fixed • Re-Verified • Frozen (v1.0), 2026-07-13.
