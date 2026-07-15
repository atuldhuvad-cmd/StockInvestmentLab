# Stock Investment Lab — Project Home

**This is the permanent master copy.** All future work continues from here.

## What this project is

A verified **Personal Delivery Investment and Portfolio Management Platform**
(`01_Source\wealth-suite`), built in pure HTML/CSS/JS with IndexedDB persistence,
alongside formal, evidence-based verification history.

## Active application (wealth-suite-v1.4)

The focused platform has six active navigation modules, in this order:
Overview, Portfolio, Watchlist, Delivery, Fundamentals, and Macro. Overview
opens by default.

Core workflow: Overview → Portfolio → Watchlist → Delivery Screener →
Fundamentals → Macro Context.

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
| Macro | Pending | v0.0 |
| Watchlist | Pending | v0.0 |
| Persistence | Pending | v0.0 |
| Settings | Inactive in Wealth Suite UI | v0.0 |

Regression: **91/91 PASS**, confirmed by real execution. First 59 (Portfolio/Fundamentals/Delivery Screener/Intraday) per `07_Session Reports\Session_Report_Laptop_Migration.md`; the additional 32 (Research) confirmed in this same working session — see `05_Modules\Research\Research_Verification_Report.md`.

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
