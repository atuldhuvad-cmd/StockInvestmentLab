# Research Library — Financial Specification

*Research Library computes no financial ratios, scores, or currency amounts — see `Research_CrossModule_Review.md` (Phase 1A). What follows are the module's 10 discovered business-rule calculations: validation, data normalization, counting, and ordering. Numbered RL-01 through RL-10 to match this project's established "10 calculations per module" convention, not because 10 was a target.*

## RL-01: Entry Validation
- **Business purpose:** Prevents a research entry from being saved without the two fields every entry needs to be findable and meaningful — which company it's about, and what it is.
- **Formula:** `valid = Boolean(ticker && ticker.trim() && title && title.trim())`
- **Inputs:** `ticker`, `title` (both user-entered strings).
- **Outputs:** `true`/`false`.
- **Business rules:** Whitespace-only input fails, same as empty input — trimming happens before the truthiness check, not after. `content` is not required — an entry can be title-only (e.g., a one-line thesis statement).
- **Worked example:** `ticker="  "`, `title="Q1 notes"` → `false` (ticker is whitespace-only).

## RL-02: Entry Field Normalization
- **Business purpose:** Ensures tickers are stored consistently (so `"tcs"` and `"TCS"` are treated as the same company) and that saved text has no leading/trailing whitespace from copy-pasted content.
- **Formula:** `ticker = input.ticker.trim().toUpperCase()`; `title = input.title.trim()`; `content = (input.content || "").trim()`
- **Inputs:** Raw form values.
- **Outputs:** Normalized strings.
- **Business rules:** `content` defaults to `""` if omitted, then trimmed — never `undefined`.
- **Worked example:** `ticker=" tcs "` → `"TCS"`.

## RL-03: Decision Field Conditional Assignment
- **Business purpose:** Only a "Decision Record" entry represents an actual buy/sell/hold decision — every other document type (thesis, risk note, concall summary, etc.) must not carry a stray decision value.
- **Formula:** `decision = (docType === "Decision Record") ? input.decision : null`
- **Inputs:** `docType`, `input.decision` (one of `Buy`/`Sell`/`Hold`/`Watching`/`Passed`, from the decision dropdown — only shown in the UI when `docType === "Decision Record"`).
- **Outputs:** The decision string, or `null`.
- **Business rules:** The guard is enforced in `buildEntry()` itself, not just by hiding the dropdown in the UI — so even if a caller passed a stray `decision` value alongside a non-Decision-Record `docType`, it would still be discarded. Defense at the data layer, not only at the form layer.
- **Worked example:** `docType="Bull Case"`, `decision="Buy"` (hypothetically passed) → stored `decision: null`.

### Research document-type presentation compatibility

Research document types use a presentation-only compatibility mapping. Existing records are never rewritten during rendering, IndexedDB loading, or backup import/export.

- Canonical types for new entries: `Investment Thesis`, `Bull Case`, `Bear Case`, `Management Assessment`, `Company Update`, `AI-Generated Summary`, `Decision Record`.
- Legacy `Key Risk` displays as `Bear Case`.
- Legacy `Annual Report Note`, `Concall Summary`, and `Quarterly Observation` display as `Company Update`.
- Unknown non-empty types display as `Legacy: <raw value>` while retaining the raw stored value.
- Missing or blank types display as `Unclassified`.
- The canonical type controls badge presentation and the `Decision Record` guard only; it does not mutate persisted data.

## RL-04: Entry ID & Timestamp Assignment
- **Business purpose:** Every entry needs a unique identifier (for click/select targeting) and a creation timestamp (for the "newest first" ordering in RL-08/RL-09).
- **Formula:** `id = Date.now() + Math.random()`; `addedAt = new Date().toISOString()`
- **Location:** `js/data-model.js`, `addResearchNote()`.
- **Business rules:** Same pattern as `addHolding()`, `addWatchlistItem()`, `addIntradayTrade()` — see `Research_CrossModule_Review.md` for why this is noted but not registered as shared *financial* logic.
- **Edge case:** Two entries added in the same millisecond with an identical `Math.random()` draw would collide on `id` — astronomically unlikely, and an accepted risk already present in three other places in this codebase before Research existed.

## RL-05: Total Entry Count
- **Formula:** `totalEntries = entries.length`
- **Business purpose:** Drives the "N entries across M companies" summary line.
- **Worked example:** 7 entries across all tickers → `7`.

## RL-06: Unique Company (Ticker) Count
- **Formula:** `companyCount = new Set(entries.map(e => e.ticker)).size`
- **Business rules:** Counts distinct tickers regardless of how many entries each has — a ticker with 5 entries counts once.
- **Worked example:** entries for TCS(×3), INFY(×2), TCS again → `companyCount = 2`.

## RL-07: Per-Ticker Entry Count
- **Formula:** `perTickerCounts[t] = entries.filter(e => e.ticker === t).length`
- **Business purpose:** The `(N)` badge shown next to each ticker chip.
- **Worked example:** 3 entries for TCS → chip reads `TCS (3)`.

## RL-08: Ticker List Ordering — **fixed 2026-07-13, RL-D01**
- **Business purpose:** Lets the user browse companies either alphabetically or by which company they've most recently added research for (the one they're actively working on tends to be at the top).
- **Formula (fixed):**
  ```
  tickers = (sortKey === "date")
    ? uniqueTickers.sort(by: max(addedAt) across that ticker's entries, descending)
    : uniqueTickers.sort()  // alphabetical ascending
  ```
- **Inputs:** `sortKey` (`"date"` or `"ticker"`, from the Sort dropdown; default `"date"`).
- **Confirmed Defect, found and fixed this pass (RL-D01):** before the fix, the ticker list was unconditionally `.sort()`-ed (alphabetical) — `sortKey` was captured from the dropdown into component state but never read by the ordering logic. Selecting "Sort: Newest first" had **zero effect** on what was displayed; the dropdown was a fully inert control. **Proven by direct execution**, not inferred from reading the code: a two-ticker dataset engineered so alphabetical order and recency order disagree (`AAACO` added first/older, `ZZZCO` added second/newer) produced the identical `["AAACO","ZZZCO"]` result for both `sortKey` values before the fix. See `Research_regression_tests.js`, RL-D01.
- **Fix:** `computeTickerList()` now branches on `sortKey`, computing each ticker's most recent `addedAt` and sorting descending when `sortKey === "date"`.
- **Worked example (post-fix):** AAACO's newest entry 2026-01-01, ZZZCO's newest entry 2026-06-01 → `sortKey="date"` → `["ZZZCO","AAACO"]`; `sortKey="ticker"` → `["AAACO","ZZZCO"]`.

## RL-09: Per-Ticker Timeline Ordering
- **Formula:** `tickerEntries = entries.filter(e => e.ticker === selectedTicker).sort(by addedAt, descending)`
- **Business purpose:** Within a single company's knowledge base, always show the most recent note first — this ordering is fixed (not user-selectable) and is unaffected by RL-08's fix, since it answers a different question ("this company's history, newest first") rather than "which companies to show in what order."
- **Worked example:** Three TCS entries dated Jan/Mar/Jun → displayed Jun, Mar, Jan.

## RL-10: Ticker Search Filter
- **Formula:** Substring match, case-insensitive, via the shared `ListControls.filterAndSort()`: `getSearchable(ticker) = ticker`, filtered by `searchText.toUpperCase()` as a substring.
- **Business rules:** Filters the ticker list only (not entry titles/content) — searching "TCS" finds the TCS chip, not an entry whose title happens to contain the word "TCS" under a different ticker.
- **Dependency:** Shared utility, already verified indirectly via Fundamentals/Delivery Screener's use of the same function (Phase 1A).
- **Worked example:** `searchText="TC"` with tickers `[AAACO, TCS, TCSTEST]` → matches `[TCS, TCSTEST]`.

---

## Business Rules Explicitly NOT SPECIFIED / NOT IMPLEMENTED

| Question | Status |
|---|---|
| `aiAnalysis` and `sourceUrl` fields, named in the `researchLibrary` data-shape comment (`data-model.js` line 48) | **NOT IMPLEMENTED** — no UI field captures either, and no code anywhere reads them. A genuine gap between the documented data shape and the actual implementation, not a calculation defect (nothing crashes; the fields are simply always absent). Recorded precisely rather than assumed harmless just because nothing breaks. |
| Is there any limit on entry `content` length? | **NOT SPECIFIED** — no client-side limit exists; a very large paste is accepted as-is. |
| Duplicate-entry detection (same ticker + title added twice) | **NOT SPECIFIED / NOT IMPLEMENTED** — every "Add entry" click creates a new entry unconditionally, even if identical to an existing one. |
