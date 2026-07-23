# Macro Intelligence — Dependency & Impact Graph

## What Macro depends on

| Dependency | Nature | Verified? |
|---|---|---|
| `WealthData` (`js/data-model.js`) | Reads/writes `macroIndicators`; uses `get()` and (indirectly) `replaceAll()`/`reset()` | Yes — data model is exercised by every frozen module's suite |
| `App.showStatus`, `App.saveNow` (`js/app.js`) | UI feedback + persistence trigger, called only from `render()`'s event handler | Not exercised in Node (DOM/App layer); out of scope for calculation verification |
| DOM (`container`) | `render()`/`refresh()` only | Out of scope (verified by reading) |

Macro depends on **no other feature module** and on **no shared financial utility** (`company-calculations.js`, `list-controls.js`, `PortfolioModule`, etc.) — confirmed in Phase 1A.

## What depends on Macro

| Consumer | Nature | Impact of this pass |
|---|---|---|
| Router / navigation (`app.js`) | Calls `MacroModule.render(container)` | **None** — `render` unchanged; adding `latestTwo` to the public object cannot affect it |
| Any other module | **None** | Macro is a leaf: nothing else reads `macroIndicators` or calls any Macro function |
| JSON Export/Import (`Persistence`) | Serializes `macroIndicators` as part of whole-state backup | **None** — point shape unchanged (`{date,value,source}`) |

## Blast radius of the two changes made this pass

1. **`latestTwo` exposed** — additive only; single existing caller (`render`) unaffected. Zero blast radius beyond enabling tests.
2. **MAC-D01 guard in `importSnapshot`** — changes behaviour *only* for previously-broken input (present-but-non-numeric fields, now skipped). Valid numeric snapshots including `0` produce byte-identical results. No consumer of `macroIndicators` sees any change for well-formed data.

Because Macro is a leaf module with no financial cross-dependencies, **no other module's frozen verification is affected.** The project-wide zero-regression re-run (all suites green) confirms this empirically.

## Note: PROJ-D01 harness fix (separate from Macro's product code)

The same working pass also fixed the Delivery Screener and Intraday **test harnesses** (PROJ-D01). That touches test files only — no product module source — and is tracked in `06_Regression/PROJ-D01_Regression_Harness_Path_Defect.md`, not here.
