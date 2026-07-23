# PROJ-D01 — Delivery Screener & Intraday regression harnesses cannot execute

**Classification:** Confirmed Defect (project-level, regression tooling) — execution-proven, not inferred.
**Status:** ✅ RESOLVED 2026-07-23 (fix applied and re-verified in-repo — see Resolution). Related sub-finding PROJ-D01b (Portfolio suite cwd-relative loader) also RESOLVED 2026-07-23 — see below. All 21 committed suites now execute and pass from any working directory.
**Severity:** High — invalidates the project's headline "91/91 PASS" verification claim (see Impact).
**Found:** 2026-07-23, during the Macro verification pass, at the mandatory "re-run all prior suites, confirm unaffected" step.
**Product code affected:** None. This is a defect in the *test harnesses*, not in any shipped module.

---

## Summary

Four regression-suite files — the Delivery Screener and Intraday suites, in **both** their `05_Modules/` and `06_Regression/` copies — fail to load their source-under-test and crash on startup with `ENOENT` before running a single assertion. They are un-runnable from **any** working directory as committed.

## Root cause

Each of these suites loads the application source with a `__dirname`-anchored path that is missing the hop into the source tree:

```js
// Delivery Screener suite, line 50 (both copies); Intraday suite, line 28 (both copies)
eval(fs.readFileSync(path.join(__dirname, 'js/data-model.js'), 'utf8') + ...);
```

`__dirname` is the directory the test file lives in (e.g. `06_Regression/Intraday/`). The real source lives in `01_Source/wealth-suite/js/`. So the join resolves to, e.g., `06_Regression/Intraday/js/data-model.js`, which does not exist. Because the path is anchored to `__dirname` (the file's own location), **no choice of current working directory can correct it.**

The working suites (Research, Fundamentals, Portfolio transaction-ledger, and the new Macro suite) use the correct robust form:

```js
const suiteRoot = path.resolve(__dirname, '..', '..', '01_Source', 'wealth-suite');
eval(fs.readFileSync(path.join(suiteRoot, 'js/data-model.js'), 'utf8') + ...);
```

The four broken files are simply missing the `'..', '..', '01_Source', 'wealth-suite'` segment. The most likely history: these test files originally lived inside `01_Source/wealth-suite/` (where `__dirname/js` did resolve) and were later copied into `05_Modules/` and `06_Regression/` without updating the loader path.

## Evidence (execution-proven)

Every invocation, every cwd:
```
$ node 06_Regression/DeliveryScreener/DeliveryScreener_regression_tests.js
Error: ENOENT: no such file or directory, open '.../06_Regression/DeliveryScreener/js/data-model.js'
$ node 06_Regression/Intraday/Intraday_regression_tests.js
Error: ENOENT: no such file or directory, open '.../06_Regression/Intraday/js/data-model.js'
```
Confirmed:
- No runnable copy of either suite exists inside `01_Source/wealth-suite/` (searched — none).
- No test runner, npm script, or `package.json` exists that repoints cwd or stages a `js/` folder next to the suites (searched — none).

## The product logic is intact — this is a tooling defect only

Re-pointing the loader at the real source out-of-band (a throwaway probe that modifies **no** repo file) makes both suites pass:
```
DeliveryScreener_regression_tests.js (path-corrected) → 15 passed, 0 failed
Intraday_regression_tests.js         (path-corrected) → 18 passed, 0 failed
```
So the Delivery Screener and Intraday **modules remain correct**; only their committed test harnesses cannot execute. No product regression is implied by this defect.

## Impact — the "91/91 PASS" claim is currently unverifiable

The "91/91 PASS" figure in `03_Dashboard/Verification_Dashboard.md` and `00_Project/README.md` is composed of: Portfolio 9 + Fundamentals 17 + Delivery Screener 15 + Intraday 18 + Research 32.

**33 of those 91 tests (Delivery Screener 15 + Intraday 18) cannot be executed from the repository as committed.** Therefore the "91/91, confirmed by real execution" claim **cannot currently be reproduced** by running the committed suites. It was presumably true at the time it was recorded (when the suites resolved their paths), but it is not verifiable in the repository's present state.

This also directly falsifies `README.md` line 72 — *"`06_Regression` — every regression suite in one place, **runnable independently** of the module folders"* — which is currently false for two of the suites.

## Proposed remediation (identified, validated, NOT yet applied)

One-line loader correction in each of the four files — add the missing source-tree hop so the path matches the working suites:

```js
// FROM
path.join(__dirname, 'js/data-model.js')
// TO
path.join(__dirname, '..', '..', '01_Source', 'wealth-suite', 'js/data-model.js')
```
(apply to every `path.join(__dirname, 'js/…')` load in the four files). Validated out-of-band to yield 15/15 and 18/18.

## Resolution (applied 2026-07-23)

The correction above was applied to all four files (`replace_all` of `path.join(__dirname,'js/` → `path.join(__dirname,'..','..','01_Source','wealth-suite','js/`). Re-verified **in-repo, from the repository root** (no cwd tricks, no probe) — both copies of both suites now execute and pass, cwd-independently:

```
$ node 06_Regression/DeliveryScreener/DeliveryScreener_regression_tests.js  → 15 passed, 0 failed
$ node 06_Regression/Intraday/Intraday_regression_tests.js                  → 18 passed, 0 failed
$ node "05_Modules/Delivery Screener/DeliveryScreener_regression_tests.js"  → 15 passed, 0 failed
$ node "05_Modules/Intraday/Intraday_regression_tests.js"                    → 18 passed, 0 failed
```
Full-suite re-run: all committed suites execute and pass (0 failures). The 33 previously un-runnable tests are restored.

## PROJ-D01b — related sub-finding: Portfolio suite is cwd-relative (✅ RESOLVED 2026-07-23)

Surfaced during the post-fix full re-run. `06_Regression/Portfolio/Portfolio_regression_tests.js` (and its `05_Modules/Portfolio/` copy) loads source with a **bare cwd-relative** path, not `__dirname`:
```js
eval(fs.readFileSync('js/data-model.js', 'utf8') + ...);   // resolves against process.cwd()
```
This is a *different* mechanism from PROJ-D01: the suite ran correctly **only when cwd was `01_Source/wealth-suite`** (from repo root it crashed with `ENOENT: … open 'D:\StockInvestmentLab\js\data-model.js'`). Less severe than PROJ-D01 (runnable, just location-sensitive), logic intact.

**Resolution (applied 2026-07-23):** both copies normalized to the robust form — added `const path = require('path')` and a `suiteRoot = path.resolve(__dirname, '..','..','01_Source','wealth-suite')` base for both loads. Re-verified from the repository root: `06_Regression/Portfolio/Portfolio_regression_tests.js` and `05_Modules/Portfolio/Portfolio_regression_tests.js` both PASS. Full-suite re-run from repo root: **21 suites, 0 failures** — every committed regression suite is now cwd-independent, making the README's "runnable independently" description of `06_Regression` fully true again.

## Verification-governance note

Per the Charter's Golden Rule, a Confirmed Defect must be resolved before the affected work can be claimed verified. Delivery Screener and Intraday were frozen at v1.0 on 2026-07-12/13 when their harnesses did run; PROJ-D01 is a **post-freeze tooling regression**, not a defect in the frozen calculations. It does not reopen those modules' calculation-level verification, but it **does** block reproduction of the project-wide regression claim until the harness paths are fixed and all suites are re-run together.
