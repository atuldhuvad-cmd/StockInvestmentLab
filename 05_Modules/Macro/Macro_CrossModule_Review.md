# Macro Intelligence — Cross-Module Consistency Review (Phase 1A)

*Registry-first, per Amendment 6: `Financial_Calculation_Registry.md` checked first — zero prior Macro entries, confirmed clean start. Implementation (`js/modules/macro.js`, `js/data-model.js`) then read in full and compared against every already-verified module and shared utility before any specification was written.*

## Finding: no duplicated *financial* calculation exists in this module

Macro Intelligence stores a time series of factual India-macro indicator readings (repo rate, CPI, USD/INR, crude, 10Y bond yield, FII/DII net flow) and shows each latest reading plus its change since the prior snapshot. It computes **no ratio, score, valuation, or currency amount** anywhere.

Confirmed by reading the full module: `macro.js` never calls `WealthData.getSecurity()`, `getFundamentals()`, `CompanyCalculations.*`, `PortfolioModule.*`, or `ListControls.*`, and defines no arithmetic of its own beyond `parseFloat`, a subtraction (`latest.value - previous.value`), and a chronological sort. There is therefore no equivalent to the ROE/ROCE/Quality-Score/Portfolio-Value duplication findings seen in Fundamentals, Delivery Screener, and Intraday.

## Finding: the change-vs-prior subtraction is not shared logic

The only arithmetic operation, `latest.value - previous.value` (MAC-03), is a plain scalar delta with no business-rule counterpart anywhere else in the suite. No other module computes a period-over-period change on a stored series. New implementation, nothing to reconcile.

## Finding: JSON-parse-and-merge follows the established Persistence pattern — reused concept, not duplicated code

`importSnapshot()` parses a pasted JSON object and merges it into `WealthData` (upsert by date). The module header explicitly frames this as reusing "the same JSON-parse-and-merge pattern already proven in `Persistence.js`." **This is a shared *concept*, not shared code** — `importSnapshot()` does not call any Persistence function; it independently reads/writes `WealthData.get().macroIndicators`. Because it computes no financial value, it is out of the Registry's scope (same reasoning Research's review applied to its ID-generation pattern). Recorded here for transparency, not added to the Registry.

## Finding: Macro writes to shared state by direct mutation, not through a setter

**Location:** `macro.js`, `importSnapshot()` (line 46):
```js
const series = WealthData.get().macroIndicators[ind.key] || (WealthData.get().macroIndicators[ind.key] = []);
```
Unlike `addHolding()`, `addWatchlistItem()`, `addResearchNote()`, etc., which write through dedicated `WealthData` setters, Macro mutates `WealthData.get().macroIndicators` **directly**, because the data model exposes no macro setter. This deviates from the data-model's stated rule ("Every module … writes back through the setters below," `data-model.js` lines 9–14). It is a **code-integrity/architecture-consistency observation, not a financial-calculation defect** — the write is correct and the shared-by-reference state ends up right. Carried into the Integrity Checklist (INV-M4) and Recommendations, not the Registry.

## What's genuinely new (no cross-module equivalent)

- **Snapshot import + upsert-by-date** (MAC-01) — parse recognized fields, skip null/undefined, upsert the point for a given date so a same-date correction replaces rather than duplicates.
- **Latest-two chronological selection** (MAC-02) — sort a copy of the series by date and return the two newest points.
- **Change vs prior** (MAC-03) — scalar delta of the two newest values.

## Conclusion

Zero shared or duplicated *financial* calculations (this module has none to share). Two non-financial patterns noted for transparency — the Persistence-style parse-and-merge (reused concept) and the direct-mutation write (an architecture-consistency deviation, tracked as INV-M4). Numerical verification (Phase 3) surfaced one defect in the import path — **MAC-D01, unguarded `NaN` on a non-numeric field** — documented in full in the Financial Specification and Verification Report; classification and disposition discussed there.
