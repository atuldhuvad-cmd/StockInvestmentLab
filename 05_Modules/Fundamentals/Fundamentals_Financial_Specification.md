# Fundamentals — Financial Specification

## FIN-F01: Return on Equity (ROE)
- **Business purpose:** Profitability relative to shareholder equity — how efficiently the company converts equity capital into profit.
- **Formula (fixed 2026-07-12, FUND-D01):** `roe = (totalEquity && totalEquity > 0) ? (netProfit / totalEquity) × 100 : null`
- **Inputs:** `netProfit` (₹ Cr), `totalEquity` (₹ Cr), both from the latest fiscal year.
- **Outputs:** Percentage, or `null`.
- **Units:** %
- **Assumptions:** Requires `totalEquity` strictly positive. Negative or zero equity now correctly returns `null` rather than a numerically valid but meaningless ratio.
- **Business rules:** Negative equity is treated as "not calculable," not silently computed. **Status: Specified and fixed.**
- **Dependencies:** `latestRatios()` in `fundamentals.js`.
- **Edge cases:** `totalEquity = 0` → `null` (verified). `totalEquity < 0` → now also `null` (verified, TC-F03, fixed 2026-07-12).
- **Worked example:** netProfit=₹1,360 Cr, totalEquity=₹5,000 Cr → ROE = 1360/5000×100 = **27.2%**.

### Historical ROE presentation

The desktop year table and mobile year cards share `formatHistoricalRoe(year)`. For finite numeric inputs, the helper preserves the established historical formula and formatting: `netProfit / totalEquity × 100`, rendered to one decimal with `%`; zero equity or incomplete, non-numeric, or non-finite presentation inputs render `—%`. Negative finite equity retains its existing mathematical result. Historical revenue and net profit use the same local currency formatter in both views; incomplete or invalid values render `—` without throwing.

These checks are display validation only. No financial records are normalized or rewritten, and IndexedDB and backup data remain unchanged. The helper does not call or alter the stricter latest-year ROE calculation and is not consumed by Delivery Screener scoring, ratings, or rankings.

## FIN-F02: Return on Capital Employed (ROCE)
- **Formula (fixed 2026-07-12, FUND-D01):** `capEmployed = totalAssets − (currentLiabilities || 0)`; `roce = (capEmployed && capEmployed > 0) ? (ebit / capEmployed) × 100 : null`
- **Business rules:** Now requires `capEmployed` strictly positive, same fix pattern as ROE.
- **Worked example:** ebit=₹1,500 Cr, capEmployed = 8,000 − 1,500 = 6,500 → ROCE = 1500/6500×100 = **23.08%**.

## FIN-F03: Debt/Equity Ratio
- **Formula (fixed 2026-07-12, FUND-D01):** `debtEquity = (totalEquity && totalEquity > 0) ? totalDebt / totalEquity : null`
- **Business rules:** Same fix pattern as ROE.
- **Worked example:** totalDebt=₹1,000 Cr, totalEquity=₹5,000 Cr → **0.2**.

## FIN-F04: Net Margin
- **Formula (fixed 2026-07-12, FUND-D01):** `netMargin = (revenue && revenue > 0) ? (netProfit / revenue) × 100 : null`
- **Business rules:** Same fix pattern as ROE.

## FIN-F05: Revenue CAGR
- **Formula (fixed 2026-07-12, FUND-D02/D03):** `revenueCagr = (yearsSpan > 0 && first.revenue > 0) ? (Math.pow(latest.revenue / first.revenue, 1/yearsSpan) − 1) × 100 : null`
- **Business rules:** Now guards both `yearsSpan > 0` and `first.revenue > 0`. Zero or negative first-year revenue correctly returns `null`.
- **Edge cases, fixed:** first-year revenue = 0 → now `null` (was `Infinity`, rendering as literal "Infinity%"). First-year revenue negative → now `null` (was `NaN`, rendering as literal "NaN%"). Both fixed and re-verified, TC-F05/TC-F06.
- **Defense-in-depth fix, same date:** `fmt()`, the display formatter, now also treats `NaN` and `Infinity` as "no data" (rendering "—"), not just `null`/`undefined` — protects against any future calculation producing a non-finite number, not only this one.
- **Worked example:** revenue grew 10,000 → 13,000 Cr over 3 years → CAGR = (13000/10000)^(1/3) − 1 × 100 = **9.14%**.

## FIN-F06: Earnings Per Share (EPS)
- **Formula:** `eps = sharesOutstanding ? netProfit / sharesOutstanding : null`
- **Business rules:** Guards zero shares outstanding. **Does not guard against negative `netProfit`** — a loss-making year correctly produces a negative EPS, which is accurate and expected (EPS should be allowed to be negative; this is correct behavior, not a gap).

## FIN-F07: Price-to-Earnings (P/E)
- **Formula:** `pe = (eps && eps > 0) ? marketPrice / eps : null`
- **Business rules:** **This is the one ratio in the module with an explicit, correct sign guard** (`eps > 0`, not just truthy) — a negative or zero EPS correctly excludes P/E entirely rather than showing a negative or nonsensical multiple. This is inconsistent with ROE/ROCE/D-E/Net Margin, which lack the equivalent care — see Recommendations.
- **Worked example:** marketPrice=₹200, netProfit=−500 (loss year) → EPS=−5 → P/E = **null** (correctly excluded).

## FIN-F08: Free Cash Flow (FCF)
- **Formula:** `fcf = operatingCashFlow − capex`
- **Business rules:** **No guard of any kind** — a missing `operatingCashFlow` or `capex` produces `NaN` silently.
- **Status: dead calculation.** Confirmed by reading `renderDetail()` in full — `fcf` is returned by `latestRatios()` but never referenced anywhere in the render function. It is computed on every render and discarded. See Recommendations.

## FIN-F09: Quality Score
- **Formula (fixed 2026-07-12, FUND-D04):** Average of whatever qualitative sub-factors are present (missing/undefined factors excluded from both the sum and the divisor — the average renormalizes over present factors, rather than the previous fixed divisor of 7). Returns `null` only if all 7 factors are missing (nothing to average).
- **Business rules:** A single missing sub-factor no longer poisons the whole score. Re-normalizing over present factors was chosen over defaulting missing ones to a fabricated neutral value, since a real (if partial) average is more honest than inventing an "assessed" score for data that was never actually assessed.
- **Business rule for weighting:** Equal weight across all *present* factors (simple average). This is a design choice, not a gap.
- **Score normalization:** 0–100 scale, by construction. Unchanged by the fix.
- **Cross-module note:** This is a shared function (`CompanyCalculations.qualityScore`), used identically by both Fundamentals and Delivery Screener — this fix applies to both simultaneously, since they call the same file. **A related, distinct issue remains in Delivery Screener's `businessQualityPillar()`**, which independently constructs its own per-factor `subFactors` array for the Top-3-Strengths/Risks display, bypassing this fix — flagged for Delivery Screener's own upcoming verification pass, not fixed here, per the module-boundary discipline established for this verification framework.

## FIN-F10: Red Flag Detection
- **Business purpose:** Flag year-over-year changes suggesting financial or governance deterioration.
- **Six independent rules, each producing zero or one flag per year transition:**
  1. Debt growth > 30% YoY → flag.
  2. Share count growth > 5% YoY (dilution) → flag.
  3. Promoter pledge percentage increased YoY → flag.
  4. Net margin declined more than 15% *relative* to the prior year (only checked when prior margin was positive) → flag.
  5. Negative operating cash flow in a given year → flag.
  6. Any recorded auditor change (`auditorLog` entries with `changed: true`) → one flag, not per-year.
- **Business rules — thresholds are hardcoded constants (30%, 5%, 15%), not configurable, not derived from any external benchmark.** This is a deliberate, simple rule-based design (matching the charter's Indicator Freeze Policy philosophy from the earlier screening engine work), not a gap — but worth stating plainly that these are the module's own fixed judgment calls, not industry-standard thresholds.
- **Shared function** — identical usage in Delivery Screener, confirmed via the codebase-wide dedup performed during the Product Completion Phase.

## Business Rules Explicitly NOT Specified (Phase 4)

| Question | Status |
|---|---|
| Is EPS CAGR computed (vs. just Revenue CAGR)? | **NOT SPECIFIED / NOT IMPLEMENTED** — no EPS CAGR calculation exists anywhere in this module. |
| Is Profit Growth (a separate metric from Revenue CAGR) computed? | **NOT SPECIFIED / NOT IMPLEMENTED** — only revenue growth is computed; net profit growth rate is not. |
| Are Banking vs. Non-Banking companies calculated differently? | **NOT SPECIFIED at the calculation level.** The `isBank` flag exists on `securities` and triggers a *warning message* in the UI ("Debt/Equity and current-ratio-style metrics don't map onto a financial institution's balance sheet") — but the actual ROE/ROCE/D-E formulas are **identical** for banks and non-banks. The flag changes what's *displayed as a caveat*, not what's *calculated*. |
| How is missing financial data handled across the board? | **Inconsistent, not a single specified rule** — some fields use truthy guards (ROE, ROCE, D/E, Net Margin), one uses a proper sign guard (P/E), and one has no guard at all (FCF). This inconsistency is itself a finding, not a designed behavior. |
| Weighting method for Quality Score | **Specified: equal weight, simple average.** (One of the few explicitly confirmed rules in this module.) |
| Score normalization | **Specified: 0–100 by construction, no separate step.** |
