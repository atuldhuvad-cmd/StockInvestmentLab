# Stock Investment Lab — Project Home

**This is the permanent master copy.** All future work continues from here.

## What this project is

A verified personal wealth-management application (`01_Source\wealth-suite`), built pure HTML/CSS/JS with IndexedDB persistence, alongside a formal, evidence-based verification methodology applied module by module.

## Current state (2026-07-13)

| Module | Status | Version |
|---|---|---|
| Portfolio | Frozen | v1.0 |
| Fundamentals | Frozen | v1.0 |
| Delivery Screener | Frozen | v1.0 |
| Intraday | Frozen | v1.0 |
| Research | Frozen | v1.0 |
| Macro | Pending | v0.0 |
| Watchlist | Pending | v0.0 |
| Persistence | Pending | v0.0 |
| Settings | Pending | v0.0 |

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

Per the Charter's Golden Rule and the "No Methodology Changes After Module 3" rule: the verification process itself is frozen. From here, only the software changes — apply the same process to Macro next, then Watchlist, Persistence, and Settings, in that order.
