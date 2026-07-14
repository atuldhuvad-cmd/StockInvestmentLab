# Portfolio — Financial Specification

## FIN-P01: Current Value (per holding)
- **Business purpose:** The present market value of one holding, given its quantity and current price.
- **Formula:** `currentValue = quantity × currentPrice`
- **Inputs:** `quantity` (number, shares/units), `currentPrice` (number, ₹ per unit)
- **Outputs:** `currentValue` (number, ₹)
- **Units:** ₹ (Indian Rupees), no currency conversion logic exists
- **Assumptions:** `quantity` is long (positive). No short-position support exists anywhere in the codebase.
- **Business rules:** If `currentPrice` is not set (null/undefined), it falls back to `avgCost` (see FIN-P00 below). This is a deliberate fallback documented in code, not a default masking missing data silently — but it does mean an un-priced holding always shows 0% gain, which could be misread as "this position is flat" rather than "this position has never been priced."
- **Dependencies:** FIN-P00 (currentPrice resolution)
- **Edge cases:** quantity = 0 → currentValue = 0 (verified, TC-005). quantity negative → currentValue negative, mathematically consistent but semantically undefined (see FIN-P03 edge case note).
- **Worked example:** 50 shares of TCS at ₹4,120 → currentValue = 50 × 4,120 = **₹206,000**.

## FIN-P00: Current Price Resolution
- **Business purpose:** Determine what price to value a holding at when the user hasn't entered a live current price.
- **Formula:** `currentPrice = holding.currentPrice || holding.avgCost`
- **Business rules:** Explicit fallback to average cost when no current price is recorded. This is a **JavaScript truthiness check**, not an explicit null-check — `currentPrice = 0` would also trigger the fallback (see Verification Report, Confirmed Defect PORT-D01).
- **Edge case:** `currentPrice = 0` is indistinguishable from `currentPrice = null` under this logic. A ₹0 price is not realistic for a listed equity, but is not impossible for the field to contain (e.g., a data entry error, or a delisted/worthless holding the user wants to record as zero value) — the current logic would silently substitute average cost instead of showing ₹0, which is the wrong behavior for that specific case.

## FIN-P02: Invested Value (per holding)
- **Formula:** `investedValue = quantity × avgCost`
- **Business rules:** `avgCost` is user-entered at holding creation and never recalculated by the app — there is no cost-basis averaging logic for multiple purchases of the same ticker (see Integrity Checklist, duplicate-ticker handling).
- **Worked example:** 50 shares of TCS at ₹3,850 → investedValue = 50 × 3,850 = **₹192,500**.

## FIN-P03: Absolute Gain/Loss (per holding)
- **Formula:** `gainAbs = currentValue − investedValue`
- **Worked example:** ₹206,000 − ₹192,500 = **₹13,500**.
- **Edge case, NOT SPECIFIED:** Behavior with negative `quantity` (a short-position-like input). The formula produces a value that is mathematically consistent internally but semantically backwards if interpreted as a short sale — see Verification Report PORT-P01 for the numerical demonstration. **Status: NOT SPECIFIED** — no business rule exists for negative quantity because the application has no short-selling feature; the UI provides no path to enter one, but the underlying function does not guard against it either.

## FIN-P04: Gain/Loss Percentage (per holding)
- **Formula:** `gainPct = investedValue !== 0 ? (gainAbs / investedValue) × 100 : 0`
- **Business rules:** Explicit zero-division guard — confirmed by reading the code (`investedValue ? ... : 0`), not assumed.
- **Worked example:** 13,500 / 192,500 × 100 = **7.012987...%**
- **Edge case:** `investedValue = 0` (e.g., a zero-quantity or zero-cost holding) → returns exactly 0, not `NaN` or `Infinity`. Verified (TC-005).

## FIN-P05: Portfolio Total Value
- **Formula:** `totalValue = Σ currentValue` across all **active** holdings (`active !== false`)
- **Business rule:** `active` is an optional legacy compatibility field and is no longer written for new holdings. A holding is excluded from totals only when an older imported record explicitly contains `active: false`; missing and `true` remain included through the unchanged `active !== false` filter.

## FIN-P06: Portfolio Total Invested
- **Formula:** `totalInvested = Σ investedValue` across active holdings.

## FIN-P07: Portfolio Total Gain (Absolute)
- **Formula:** `totalGain = totalValue − totalInvested`

## FIN-P08: Portfolio Total Gain (Percentage)
- **Formula:** `totalGainPct = totalInvested !== 0 ? (totalGain / totalInvested) × 100 : 0`
- **Business rule:** Same zero-division guard pattern as FIN-P04.

## FIN-P09: Sector Allocation
- **Formula:** Group `currentValue` by `security.sector`; holdings with no matched security record (i.e., no sector on file) are grouped under the literal key `"Unclassified"`.
- **Business rule:** Sector comes from a *separate* `securities` record looked up by ticker, not stored on the holding itself — meaning sector allocation is only as accurate as whatever `securities` entry exists (or doesn't) for that ticker at render time. A ticker with no `securities` entry at all is `"Unclassified"`, confirmed by design (Standalone Value Rule: Portfolio never requires Fundamentals data to exist).

## FIN-P10: Asset Class Allocation
- **Formula:** Group `currentValue` by `holding.assetClass`, defaulting to `"Equity"` if unset.
- **Business rule:** Unlike sector, asset class is stored directly on the holding record, not looked up elsewhere.

---

## Business Rules Explicitly NOT Specified (Phase 4)

Per the framework's instruction to mark undefined rules rather than invent them:

| Question | Status |
|---|---|
| Are dividends included in gain calculations? | **NOT SPECIFIED** — no dividend field or logic exists anywhere in the module. |
| Are brokerage/transaction charges included? | **NOT SPECIFIED** — `avgCost` is a raw user-entered number; whether it includes brokerage is entirely up to how the user chose to enter it, undocumented in the UI. |
| Are taxes (STCG/LTCG) included or estimated? | **NOT SPECIFIED** — no tax logic exists in this module. (Note: the much earlier standalone Capital Ledger/Portfolio Intelligence artifacts from this session had illustrative tax-rate fields, but none of that carried into this module — worth flagging as a real feature gap, not an oversight to assume away.) |
| Are realized and unrealized gains separated? | **NOT SPECIFIED / NOT IMPLEMENTED** — only unrealized (current holding) gain is computed. Selling a holding calls `removeHolding()`, which deletes the record entirely with no realized-P&L record created anywhere. Realized gain history does not exist. |
| How are stock splits handled? | **NOT SPECIFIED** — no split-adjustment logic. A 1:2 split would require the user to manually halve `avgCost` and double `quantity`; if they don't, gain% will be silently wrong. |
| How are bonus issues handled? | **NOT SPECIFIED** — same gap as stock splits; no automatic adjustment. |
| What happens if quantity reaches zero? | **NOT SPECIFIED as a distinct state** — the UI has no "reduce quantity" path at all; only full removal (`removeHolding`) exists. A partial sale cannot currently be recorded. |
