# v2.4.0 Portfolio Fundamental Risk Monitoring & Alerts — Implementation Plan

## Components

1. **Portfolio fundamental-risk evaluator** in `01_Source/wealth-suite/js/modules/portfolio.js`: pure helpers will normalize a holding ticker, read its matching Fundamentals record, call `CompanyCalculations.determineReviewStatus()`, safely call `CompanyCalculations.detectRedFlags()` only when year history exists, assign severity, and aggregate actionable risks across active holdings.
2. **Portfolio Risk Dashboard** in `portfolio.js`: a top-of-module panel will summarize active holding risks, show a strict zero-risk state when appropriate, and render one review action per affected ticker.
3. **Holdings health presentation** in `portfolio.js`: the desktop table will gain a `Fundamental Health` column, and mobile holding cards will gain the equivalent status, alert icon, and red-flag count.
4. **Fundamentals navigation target** in `01_Source/wealth-suite/js/modules/fundamentals.js`: a small module-scoped navigation interface will accept a Nifty 500 ticker, switch to the Fundamentals module through `App.switchTo("fundamentals")`, select that ticker, and render its current record without persisting navigation state.
5. **Portfolio regression coverage** in `06_Regression/Portfolio/Portfolio_regression_tests.js`: extend the existing suite rather than creating a seventeenth central suite.
6. **Documentation and verification** in the generated user guide source/artifacts and `07_Session Reports/Portfolio_Fundamental_Risk_Verification.md`.

## Responsibilities

1. Add pure `evaluateFundamentalHealth(holding, fundamentals)` and `buildFundamentalRiskSummary(holdings, fundamentalsByTicker)` helpers to Portfolio’s public test surface. Each result will contain only derived status, severity, missing requirements, and genuine flags from stored WealthData records.
2. Treat every active holding whose review status is not `Eligible for Full Rating` as an alert. Statuses include `Missing`, `Partial`, `User-entered / unverified`, `Stale`, and verified-but-incomplete records. A holding with detected red flags remains an alert even when its evidence coverage is otherwise eligible.
3. Use deterministic severity rules: red when genuine `detectRedFlags()` output is non-empty; amber when the record is missing, incomplete, unverified, or stale; healthy only when it is eligible and has zero detected flags.
4. Render `Zero Fundamental Risks Detected.` only when at least zero active holdings have no derived alerts; do not create placeholder companies, ratios, evidence dates, flags, or alert fixtures in production code.
5. Place the Risk Dashboard below the Portfolio header and above valuation summaries. Escape ticker, status, missing-field labels, and flag text before `innerHTML` insertion. Use local text-safe rendering for all new output.
6. Add the health column to the desktop table, update empty-state `colspan`, and show the same health information in mobile cards. Use existing color tokens and touch-sized buttons without adding a new design dependency.
7. Add `FundamentalsModule.openTicker(ticker)` as a transient navigation action. Validate the ticker through `isNifty500Ticker`, avoid localStorage/IndexedDB writes, select it during render, then clear the pending request.
8. Add regression cases for stale evidence older than 550 days, missing Fundamentals, partial/unverified records, eligible records with no flags, eligible records with genuine year-based red flags, inactive holding exclusion, zero-risk aggregation, HTML escaping, and the Fundamentals navigation target.
9. Run the focused Portfolio suite, Fundamentals suite, all 16 central suites, 14 CSV tests, 11 public-sync tests, JavaScript syntax checks, and `git diff --check`. Keep the branch uncommitted until review.

## Interfaces/Dependencies

1. Read holdings exclusively through `WealthData.getHoldings()` and Fundamentals through `WealthData.get().fundamentals` or `WealthData.getFundamentals(ticker)`; no duplicate state or derived values will be persisted.
2. Reuse `CompanyCalculations.determineReviewStatus()`, `fundamentalCoverage()`, and `detectRedFlags()` as the sole financial-health rules. Portfolio will not reproduce the 550-day threshold or red-flag formulas.
3. Reuse `App.switchTo("fundamentals")` for module navigation and expose only the minimal `FundamentalsModule.openTicker(ticker)` bridge needed to preserve the selected ticker across that render.
4. Preserve existing Portfolio transaction, valuation, deletion, desktop-table, and mobile-card behavior. Risk evaluation is read-only and recalculates whenever `renderLists()` runs.
5. Extend the existing Portfolio regression harness with stored-data-shaped fixtures; fixtures remain test-only and never enter seed data, runtime state, documentation examples, or production fallbacks.

## Constraints

1. Personal-use, offline-first, Vanilla JS only; no APIs, broker connections, credentials, cloud services, packages, background jobs, or new data sources.
2. No fabricated financial values, evidence, red flags, health scores, or alerts. Missing data must remain explicitly missing.
3. Only active holdings (`active !== false`) participate in the dashboard and health aggregation.
4. `detectRedFlags()` must never be called on a missing record or an invalid/missing `years` array; manual-only records legitimately produce zero historical flags.
5. Every new value interpolated into Portfolio or navigation-generated HTML must pass through `escapeHtml()`; fixed internal markup and numeric values may be rendered directly.
6. No schema change or backup migration is required because the feature derives health from existing holdings and Fundamentals state.
7. This planning step modifies only `implementation_plan.md`; JavaScript, tests, documentation, commits, merges, and tags remain untouched until approval.
