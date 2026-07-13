# Research Library — Integrity Checklist

## Data Invariants

- [x] **`computeSummary()` handles an empty library without crashing or producing `NaN`.** Confirmed by direct execution — `totalEntries: 0`, `companyCount: 0`, `perTickerCounts: {}`.
- [x] **`computeTickerList()` on an empty library returns `[]`, not `undefined` or a crash.** Confirmed by direct execution.
- [x] **`computeTimeline()` for a ticker with zero entries (including one that's never existed) returns `[]`, not a crash.** Confirmed by direct execution.
- [x] **`buildEntry()`'s `decision` field is `null` for every `docType` except `"Decision Record"`, even if a `decision` value is explicitly passed in.** Confirmed by direct execution — the guard lives in `buildEntry()` itself, not only in the UI's conditional field visibility.
- [x] **`validateEntry()` never throws on `undefined` inputs.** Confirmed by direct execution — short-circuit evaluation (`ticker && ticker.trim()`) means an `undefined` ticker or title returns `false` cleanly rather than throwing on `.trim()` of `undefined`.
- [x] **The ticker list's sort order actually changes when `sortKey` changes.** Confirmed by direct execution with a dataset engineered so alphabetical and recency order diverge (RL-D01 — see Verification Report's Phase 6A entry for the full before/after).

## Validation Checks Not Yet Implemented

- No duplicate-entry detection — adding the same ticker + title twice creates two separate entries, both retained.
- No maximum length enforced on `content` — a very large paste is accepted as-is (no observed crash risk at any size tested, but no explicit ceiling either).
- `aiAnalysis` and `sourceUrl`, named in the `researchLibrary` data-shape comment, are never written or read anywhere — a genuine specification-vs-implementation gap (see Financial Specification's NOT SPECIFIED table), not a data-integrity risk in itself.

## Reconciliation Checks

- **`computeSummary().perTickerCounts` and the ticker badges rendered in the UI use the exact same computation, not two independently-maintained counts.** Confirmed by reading `refresh()`: the badge text (`${summary.perTickerCounts[t]}`) reads directly from the same `summary` object used for the header count — no separate re-derivation that could silently drift.
- **`computeTickerList()`'s output set is always a subset of `computeSummary()`'s ticker keys for the same `entries` array** — both derive their ticker set from the identical `Array.from(new Set(entries.map(e => e.ticker)))` expression (duplicated in two functions, not shared via one helper — a minor internal duplication noted here rather than silently present; see Recommendations for whether it's worth consolidating). Confirmed consistent by direct execution across every test in the regression suite that uses both functions on the same `entries` value.
- **Standalone Value Rule holds under direct execution, not just by design intent.** A ticker with a research entry but zero `securities`/`fundamentals` record was confirmed to save, count, and list correctly, with `WealthData.getSecurity()`/`getFundamentals()` both correctly returning `undefined` and no downstream crash — see the regression suite's dedicated Standalone Value Rule block.
