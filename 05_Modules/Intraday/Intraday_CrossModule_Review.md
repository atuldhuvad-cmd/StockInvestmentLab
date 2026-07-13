# Intraday — Cross-Module Consistency Review (Phase 1A)

*Registry-first, per Amendment 6: `Financial_Calculation_Registry.md` checked first — zero prior Intraday entries, confirmed clean start. Implementation then read and compared against every already-verified module before any specification was written.*

## Finding: `computeAllocation()`'s `portfolioValue` duplicates Portfolio's frozen total-value calculation

**Location:** `js/modules/intraday.js`, lines 35–36:
```js
const holdings = WealthData.getHoldings().filter(h => h.active !== false);
const portfolioValue = holdings.reduce((s, h) => s + h.quantity * (h.currentPrice || h.avgCost), 0);
```

**This is the exact same formula as Portfolio's frozen FIN-P00/P01/P05** (current-price fallback → per-holding current value → summed total value), independently reimplemented inline rather than calling the already-exported `PortfolioModule.computeRow()` / `PortfolioModule.computeSummary()`.

**Confirmed avoidable, not structurally necessary:** `portfolio.js` exports `{ render, computeRow, computeSummary }` — both functions needed were already accessible to any other module before this duplication was written.

**Tested for actual drift, not assumed identical:** seeded two holdings (including one triggering the `currentPrice` fallback to `avgCost`, the exact edge case FIN-P00 documents) and compared Portfolio's own `computeSummary().totalValue` against Intraday's independently-computed value via back-derivation from the ceiling calculation. **Result: identical (₹2,100 both ways).** This is a **pure duplication risk, not a current behavioral defect** — worth stating precisely, since the Mandatory Defect Resolution Cycle (Phase 6A) is triggered by Confirmed Defects specifically, and none exists here yet.

**Classification (Amendment 6):** Implementation Drift risk — currently Verified Consistent in behavior, but structurally a second copy of Portfolio's formula that would silently stop matching if either copy were ever edited alone. Given the fix is trivial (call the already-exported shared function instead of reimplementing three lines) and this project's now-established pattern of eliminating duplication proactively once found — rather than waiting for it to produce an actual defect first — **this will be fixed during this module's build, not left as a recommendation for later.** Documented as a proactive architectural fix, not a defect resolution, since nothing was actually broken.

## What's genuinely new (no cross-module equivalent)

- **Risk-Reward Ratio** (`|target−entry| / |entry−stop|`) — no equivalent anywhere else in the suite.
- **Checklist pass/fail logic** (stop set, risk-reward above threshold, reason stated) — new, specific to the trade-discipline-log design.
- **Capital ceiling math** (deployed vs. ceiling amount, used %, over-ceiling flag) — new, though it *consumes* the duplicated Portfolio value above as one of its inputs.

## What's correctly reused, not duplicated

- **Settings values** (`minRiskRewardRatio`, `intradaySatelliteAllocationPct`) — read directly via `WealthData.getSetting()`/`getAllSettings()`, the same shared settings store every other module uses. No duplication risk here; this is the intended pattern.

## Conclusion

One real, proactively-caught duplication finding (portfolioValue), zero confirmed defects, three genuinely new calculations. Phase 1 (Financial Specification) proceeds next, with the duplication finding already resolved as part of the build rather than carried forward as an open item.
