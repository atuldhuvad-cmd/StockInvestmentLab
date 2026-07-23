# Stock Investment Lab — Project Home

**This is the permanent master copy.** All future work continues from here.

## What this project is

A verified **Personal Delivery Investment and Portfolio Management Platform**
(`01_Source\wealth-suite`), built in pure HTML/CSS/JS with IndexedDB persistence,
alongside formal, evidence-based verification history.

## Active application (wealth-suite-v1.8)

The focused platform has six active navigation modules, in this order:
Overview, Portfolio, Watchlist, Delivery, Paper Trading, and Fundamentals.
Overview opens by default.

Delivery is the ranked screener and its Paper Buy action opens the dedicated
top-level Paper Trading module. Paper Trading contains Summary, Paper Portfolio,
Transactions, and Performance Review sections. Paper capital,
transactions, holdings, realised results, and entry-score snapshots remain
separate from the real Portfolio. An optional localhost-only Python helper can
retrieve read-only Angel One quotes for Paper Buy/Sell. Browser code never holds
broker credentials, stale market-hours quotes are blocked after five minutes,
and no order endpoints exist. Manual Observed Price is the default and requires
observed date, time, and source; API controls are collapsed and optional.
Offline imported closes remain explicitly historical and never live.

Use `Open_Wealth_Intelligence_Suite.bat` for the normal offline app. Use
`Open_Wealth_Suite_With_Quotes.bat` only after locally configuring the ignored
credential file described in `10_Integrations\AngelOneQuotes\HOW_TO_USE_QUOTES.txt`.

Core workflow: Overview → Portfolio → Watchlist → Delivery Screener →
Paper Trading → Fundamentals.

Legacy Macro data remains preserved in backups but is no longer part of the
active workflow. Macro source and regressions remain in the repository for
compatibility and historical reference.

Legacy Research Library data remains preserved in backups but is no longer part
of the active workflow. Its source, state fields, verification evidence, and
regressions remain in the repository for compatibility and historical reference.

Intraday trading is being developed as a separate satellite project. Existing
legacy Intraday data remains preserved in backups. Intraday and Settings source,
verification evidence, state fields, and regression suites remain in this
repository for compatibility until the standalone project is created and
verified; neither module is loaded or registered in the active application.

## Historical module-verification state (2026-07-13)

| Module | Status | Version |
|---|---|---|
| Portfolio | Frozen | v1.0 |
| Fundamentals | Frozen | v1.0 |
| Delivery Screener | Frozen | v1.0 |
| Intraday | Frozen; inactive in Wealth Suite UI | v1.0 |
| Research | Frozen; inactive in Wealth Suite UI | v1.0 |
| Macro | **Frozen 2026-07-23 (v1.0)**; inactive in Wealth Suite UI; legacy data preserved | v1.0 |
| Watchlist | **Frozen 2026-07-23 (v1.0)** | v1.0 |
| Persistence | Pending | v0.0 |
| Settings | Inactive in Wealth Suite UI | v0.0 |

Regression: **91/91 PASS**, confirmed by real execution. First 59 (Portfolio/Fundamentals/Delivery Screener/Intraday) per `07_Session Reports\Session_Report_Laptop_Migration.md`; the additional 32 (Research) confirmed in this same working session — see `05_Modules\Research\Research_Verification_Report.md`.

> ℹ️ **Update 2026-07-23 (PROJ-D01, now RESOLVED).** The "91/91 PASS" line above was found to be temporarily **unverifiable**: the Delivery Screener (15) and Intraday (18) harnesses — 33 of the 91 tests — crashed on load with `ENOENT` from any working directory (source path `__dirname`-anchored, missing the `01_Source\wealth-suite` hop). This was **a test-harness defect, not a product regression** — the Delivery/Intraday logic passed 15/15 and 18/18 once the path was corrected. **Fixed the same day** and re-verified in-repo from the repository root (cwd-independent): all committed suites now execute and pass, 0 failures. Note the original "91" was itself a freeze-time snapshot — the suite set has since grown (Fundamentals now 43, Research now 46, plus paper-trading/price-history/workflow suites and Macro 38), so the live executed count is higher. A milder related residual — **PROJ-D01b**, `Portfolio_regression_tests.js` using a cwd-relative loader — was **also fixed the same day**, so **all 21 committed regression suites now execute and pass from any working directory (0 failures)**, and the "runnable independently" description of `06_Regression` (below) is fully true again. Full record: `06_Regression\PROJ-D01_Regression_Harness_Path_Defect.md`.

## Where to look for what

- `01_Source` — the actual application. Open `wealth-suite\index.html` in a browser to run it.
- `02_Framework` — the verification methodology itself (frozen after Delivery Screener, per project rule — see the Charter's closing section).
- `03_Dashboard` — single-page status view of the whole verification program.
- `04_Registry` — every financial calculation ever discovered, its verification status, and its cross-module consistency status.
- `05_Modules` — full verification evidence per module (specification, verification report, regression suite, integrity checklist, recommendations).
- `06_Regression` — every regression suite in one place, runnable independently of the module folders.
- `07_Session Reports` — session-level notes, including this reconstruction's own confirmation report.
- `08_Releases` — reserved for future packaged releases of the application itself.
- `09_Backups` — contains `Stock Investment Lab v1.zip`, the baseline archive of this exact reconstruction.

## Rule for continuing this project

Per the Charter's Golden Rule and the "No Methodology Changes After Module 3"
rule, the verification process itself remains frozen. Historical Intraday
evidence stays intact while its future development moves to a separate project.
