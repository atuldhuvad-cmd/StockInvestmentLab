# Intraday — Phase 2: Code Mapping
*Ordered by dependency level per the Impact Graph, not file line order.*

## Verification Coverage Matrix

| Level | Calculation | File | Function | Line | Specification |
|---|---|---|---|---|---|
| 0 | IN-01 Risk-Reward Ratio | `js/modules/intraday.js` | `computeChecklist()` | 18–20 | §IN-01 |
| 0 | IN-02 Stop-Loss Set | `js/modules/intraday.js` | `computeChecklist()` | 22 | §IN-02 |
| 0 | IN-04 Reason Stated | `js/modules/intraday.js` | `computeChecklist()` | 25 | §IN-04 |
| 0 | IN-05 Deployed Capital | `js/modules/intraday.js` | `computeAllocation()` | 30–31 | §IN-05 |
| 0 | IN-06 Portfolio Value | `js/modules/portfolio.js` (called from `computeAllocation()`, line 36) | `PortfolioModule.computeRow()` / `computeSummary()` | 15, 28 (portfolio.js) / 36 (intraday.js, call site) | §IN-06 |
| 1 | IN-03 Risk-Reward Threshold Pass | `js/modules/intraday.js` | `computeChecklist()` | 23 | §IN-03 |
| 1 | IN-07 Total Capital Base | `js/modules/intraday.js` | `computeAllocation()` | 37 | §IN-07 |
| 2 | IN-08 Ceiling Amount | `js/modules/intraday.js` | `computeAllocation()` | 39 | §IN-08 |
| 2 | IN-09 Used Percentage | `js/modules/intraday.js` | `computeAllocation()` | 40 | §IN-09 |
| 3 | IN-10 Over-Ceiling Flag | `js/modules/intraday.js` | `computeAllocation()` | 41 | §IN-10 |

## Coverage confirmation

Every calculation from Phase 1 (IN-01 through IN-10) is mapped. `fmtINR()` (line 47) is deliberately not given its own row — a display formatter with no independent business logic, consistent with how `fmt()` in Fundamentals and `scoreBand()` in Delivery Screener were treated.

## What Phase 2 confirms

`computeAllocation()` is a single function computing IN-05 through IN-10 in one pass — there's no intermediate persistence or transformation between steps, meaning the entire allocation calculation can be verified as one unit once IN-06 (the external Portfolio call) is confirmed correct. This matches the pattern already seen in Delivery Screener: fixing/confirming the shared upstream input first collapses most of the downstream verification into a single pass rather than several disconnected ones.

**Status: Phase 2 complete.**
