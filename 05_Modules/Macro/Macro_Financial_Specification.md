# Macro Intelligence — Financial Specification

*Macro Intelligence computes no financial ratios, scores, or currency amounts — see `Macro_CrossModule_Review.md` (Phase 1A). What follows are the module's 3 discovered calculations: data import/upsert, chronological selection, and a scalar change delta. Numbered MAC-01 through MAC-03. Macro genuinely has 3 — not the usual ~10 — because its post-audit build (2026-07-13 Product Simplification Audit) removed the manual entry form and the entire Sector Regime engine, leaving factual indicator readings with no interpretive/predictive layer. The "10 per module" figure was always a convention, not a target (the Research spec said the same).*

**Source:** `js/modules/macro.js`. **Indicators (7):** repo rate, CPI, USD/INR, crude, 10Y bond yield, FII net flow, DII net flow — each an object `{ key, label, jsonField, unit }` in the `INDICATORS` array. Note the internal series **key** (e.g. `bondYield10Y`) differs from the **jsonField** used in imported JSON (e.g. `bond10y`).

## MAC-01: Snapshot Import & Upsert-by-Date
- **Business purpose:** Bring an external macro snapshot into the app through the Import-Driven Data Rule (paste JSON obtained from an AI assistant or entered by hand) — no live fetch, ever. A same-day correction must replace the earlier point, not create a duplicate.
- **Location:** `importSnapshot(json)`.
- **Formula / procedure:** For each of the 7 indicators, read `json[jsonField]`; skip if `undefined`/`null`; **parse to a number and skip if not finite (MAC-D01 fix)**; then upsert `{ date, value, source:"import" }` into `macroIndicators[key]` — replacing the existing point whose `date` matches, else appending. `date = json.date || today (ISO yyyy-mm-dd)`. Returns the count of indicators actually stored.
- **Inputs:** a parsed JSON object with any subset of the 7 `jsonField`s, optional `date`.
- **Outputs:** integer count of recognized, numeric fields stored; side effect on `WealthData.macroIndicators`.
- **Business rules:**
  - `undefined`/`null` fields are skipped (not stored, not counted).
  - **Value `0` is valid and stored** — the guard tests `=== undefined || === null`, not falsiness (`parseFloat(0)===0`, finite).
  - Unrecognized JSON keys (e.g. `gdp`) are ignored.
  - Missing `date` defaults to today's ISO date.
  - **Upsert by exact `date` string match** — re-importing the same date overwrites in place (series length unchanged); a new date appends.
  - **MAC-D01 (Confirmed Defect, fixed 2026-07-23):** before the fix, a present-but-non-numeric field (e.g. `"N/A"`, `""`) produced `parseFloat(...) → NaN`, which was **stored and counted**, and would render the literal "NaN" in the UI. Now such fields are parsed first and skipped when not finite. See `Macro_Verification_Report.md` §MAC-D01 for the full Phase 6A cycle.
- **Worked example:** `{date:"2026-07-12", repo_rate:5.5, cpi:"N/A"}` → count `1` (repo rate stored; CPI skipped as non-numeric).

## MAC-02: Latest-Two Chronological Selection
- **Business purpose:** Identify the most recent reading and the one before it, so the module can show the current value and its change — correctly, even if snapshots were imported out of date order.
- **Location:** `latestTwo(key)` (exposed on the module's public interface 2026-07-23 for verification; behaviour unchanged — see `Macro_CodeMapping.md`).
- **Formula:** sort a **copy** (`.slice()`) of `macroIndicators[key]` ascending by `new Date(date)`; return `{ latest: series[len-1] || null, previous: series[len-2] || null }`.
- **Business rules:**
  - Empty series → `{latest:null, previous:null}`; single point → `previous:null`.
  - Ordering is by **date**, not insertion order — an older snapshot imported after a newer one still yields the correct latest/previous.
  - Does **not** mutate the stored series (operates on a slice).
- **Worked example:** import 2026-03-01 (6.0) then 2026-01-01 (5.0) → `latest.value=6.0`, `previous.value=5.0`.

## MAC-03: Change vs Prior (delta)
- **Business purpose:** Show how far each indicator has moved since the previous snapshot (the "+0.25 vs prior" line), coloured up/down/flat.
- **Location:** inline inside `refresh()` (DOM-coupled): `const change = previous ? latest.value - previous.value : null;`
- **Formula:** `change = previous ? latest.value - previous.value : null`.
- **Business rules:** `null` when there is no prior point (single point or empty series). Displayed to 2 decimals with a leading `+` when `>= 0`. Because `latestTwo` guarantees `previous` truthy ⇒ `latest` truthy, the guard never dereferences a null latest.
- **Verification note:** MAC-03 lives inside the DOM render path and is therefore **verified by re-derivation** over the real `latestTwo()` output (the exact source expression, copied verbatim), **not** by executing `refresh()` in Node. This is an explicit, approved scope decision — only `latestTwo` was exposed; `refresh()` was left unchanged. See `Macro_Verification_Report.md` §MAC-03.
- **Worked example:** 5.0 then 5.5 → `+0.5`; 6.25 then 6.0 → `-0.25`; single point → `null`.

---

## Business Rules Explicitly NOT SPECIFIED / NOT IMPLEMENTED

| Question | Status |
|---|---|
| Sector Regime / tailwind-headwind interpretation | **REMOVED 2026-07-13** — an unsourced predictive layer, deleted in the Product Simplification Audit as conflicting with the Charter's "no prediction without evidence" rule. Not a gap; a deliberate removal. Legacy regime data is not recomputed. |
| Manual 7-field entry form | **REMOVED 2026-07-13** — produced identical data to the JSON import path; deleted as duplication. JSON import is the sole entry path. |
| Validation of macro *values* (plausible ranges, e.g. repo rate 0–20%) | **NOT SPECIFIED** — any finite number is accepted; there is no domain-range check. A negative or absurd value would be stored as-is (post-MAC-D01, only non-numeric input is rejected). |
| Date-format validation | **NOT SPECIFIED** — `date` is taken as a string; a malformed date would sort via `new Date(...)` (possibly `Invalid Date`). No current UI path supplies one, but the import accepts arbitrary JSON — see `Macro_Recommendations.md`. |
| Units / currency conversion | **NOT SPECIFIED** — `unit` is a display suffix only; no conversion is performed. |
