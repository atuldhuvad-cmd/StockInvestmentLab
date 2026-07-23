# Watchlist — Financial Specification

*Watchlist computes no financial ratios, scores, or currency amounts — see `Watchlist_CrossModule_Review.md` (Phase 1A). What follows are the module's 7 discovered business-rule calculations: validation, normalization, label mapping, ordering, counting, display formatting, and removal. Numbered WL-01 through WL-07. As with Macro and Research, the count reflects what the module actually does, not a "10 per module" target.*

**Source:** `js/modules/watchlist.js`. **Categories (4):** `Watch`, `Research` (labelled "Needs Study"), `Buy Soon`, `Reject`.

## WL-01: Add Validation + Field Normalization
- **Business purpose:** Ensure every watchlist item has a usable ticker and consistently-formatted fields before it is saved.
- **Location:** `buildItem(raw)` (pure, extracted + exposed 2026-07-23); invoked by the add-click handler in `render()`.
- **Formula:** `ticker = (raw.ticker||"").trim().toUpperCase()`; **invalid (return null) if `ticker` empty**; `targetPrice = parseFloat(raw.targetPrice) || null`; `notes = (raw.notes||"").trim()`; `category = raw.category` (passthrough).
- **Business rules:**
  - Whitespace-only / missing ticker → `null` → caller shows "Enter a ticker first" and adds nothing (fields not cleared).
  - `content`/`notes` defaults to `""`, never `undefined`.
  - **Target price:** `parseFloat(...) || null` — a blank, non-numeric, or `"0"` target becomes `null`. This deliberately treats `0` as "no target" (0 is falsy) and, importantly, **never stores `NaN`** (the MAC-D01 class), verified by execution.
- **Worked example:** `{ticker:"  wipro  ", targetPrice:"N/A", notes:"  x  "}` → `{ticker:"WIPRO", targetPrice:null, notes:"x", category:undefined}`.

## WL-02: Category Label Mapping
- **Business purpose:** Show a friendly label ("Needs Study") for the stored category value ("Research").
- **Location:** `categoryLabel(value)` (pure, exposed 2026-07-23).
- **Formula:** find `value` in `CATEGORIES`; return its `label`, else return `value` unchanged.
- **Business rules:** Presentation-only; never mutates stored data. Unknown non-empty value → the raw value; missing value → the falsy value as-is (**the WL-D01 drift point vs Overview** — see Cross-Module Review).
- **Worked example:** `"Research"` → `"Needs Study"`; `"Hold"` → `"Hold"`.

## WL-03: List Ordering (newest first)
- **Business purpose:** Show the most recently added stock at the top.
- **Location:** `sortByDateAdded(items)` (pure, extracted + exposed 2026-07-23); used by `renderList()`.
- **Formula:** `items.slice().sort((a,b) => new Date(b.dateAdded) - new Date(a.dateAdded))`.
- **Business rules:** Descending by `dateAdded`; operates on a **copy** (never mutates the stored array); empty → `[]`.
- **Worked example:** items dated Jan/Jun/Mar → `[Jun, Mar, Jan]`.

## WL-04: Item Count + Pluralization
- **Location:** inline in `renderList()`: `${n} ${n === 1 ? "stock" : "stocks"}` where `n = items.length`.
- **Verification note:** DOM-coupled; verified by **re-derivation** over the real `WealthData.getWatchlist().length`, not the live render path.
- **Worked example:** 1 item → "1 stock"; 2 → "2 stocks".

## WL-05: Target-Price Display Format
- **Location:** inline in `renderList()`: `item.targetPrice ? '₹' + item.targetPrice.toLocaleString('en-IN') : '—'`.
- **Business rules:** `null` target → em dash `—`; otherwise Indian-grouped rupee string.
- **Verification note:** DOM-coupled; verified by **re-derivation** of the branch, not the live path.
- **Worked example:** `450000` → `₹4,50,000`; `null` → `—`.

## WL-06: Category → Chip-Colour Mapping
- **Location:** `CATEGORY_COLOR` object, used in the mobile card markup: `class="chip ${CATEGORY_COLOR[item.category]}"`.
- **Business rules:** `Watch→""`, `Research→"flag"`, `Buy Soon→"gain"`, `Reject→"loss"`. An unknown category yields `undefined` → the chip renders `class="chip undefined"`.
- **Verification note:** DOM-coupled + cosmetic; verified by **reading**. The unknown-category → `"undefined"`-class case is recorded as a minor cosmetic gap (see NOT SPECIFIED table), not a defect (categories come from a fixed dropdown).

## WL-07: Remove by Id
- **Business purpose:** Remove a specific item when the user clicks its Remove button.
- **Location:** `renderList()` click handler → `parseFloat(btn.dataset.remove)` → `WealthData.removeWatchlistItem(id)`.
- **Business rules:** The float id (`Date.now()+Math.random()`) is serialized into the `data-remove` attribute and parsed back with `parseFloat(String(id))`; verified by execution to round-trip exactly and remove only the targeted item.
- **Worked example:** two items added, remove first by id → only the second remains.

---

## Business Rules Explicitly NOT SPECIFIED / NOT IMPLEMENTED

| Question | Status |
|---|---|
| Duplicate-ticker detection (same ticker added twice) | **NOT SPECIFIED / NOT IMPLEMENTED** — every "Add" click creates a new item unconditionally, even if the ticker is already on the list. |
| Target price vs current price (upside %, "reached target" flag) | **NOT SPECIFIED** — target is stored/displayed only, never compared to any price. No financial calculation exists. |
| Unknown category → chip colour | **NOT SPECIFIED** — `CATEGORY_COLOR[unknown]` is `undefined`, rendering `class="chip undefined"`. Cosmetic; not reachable via the UI (fixed dropdown). |
| Ticker validity / existence check | **NOT SPECIFIED** — any non-empty string is accepted as a ticker; no cross-check against `securities`. |
| Editing an existing item | **NOT SPECIFIED / NOT IMPLEMENTED** — items can be added and removed, not edited in place. |
| `dateUpdated` field (named in the data-shape comment, `data-model.js` line 78) | **NOT IMPLEMENTED** — never written or read; a documented-shape-vs-implementation gap, same class as Research's `aiAnalysis`/`sourceUrl`. |
