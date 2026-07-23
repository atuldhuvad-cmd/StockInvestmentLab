# Macro Intelligence — Recommendations

*Non-blocking follow-ups surfaced during verification. None blocked the v1.0 freeze. Ordered by value, per the Charter's three-question gate (better decisions? saves time? fits the frozen architecture?).*

## R-1 — (Optional) Add `WealthData.upsertMacroPoint()` and route the write through it (INV-M4)
- **What:** Macro currently writes `WealthData.get().macroIndicators` by direct mutation because no setter exists, deviating from the data model's "write through setters" rule.
- **Why:** Consistency and one-place-to-change discipline; makes a future schema change to macro storage safe.
- **Cost/risk:** Low. A thin setter mirroring `addResearchNote()` etc. Behaviour-preserving.
- **Gate:** Fits the architecture; marginal decision/time benefit. **Recommend when Persistence/Import/Export is verified** (that module owns the setter conventions) — not urgent enough to reopen a frozen Macro on its own.

## R-2 — (Optional) Normalize `Portfolio_regression_tests.js` loader (PROJ-D01b)
- **What:** `06_Regression/Portfolio/Portfolio_regression_tests.js` (and its `05_Modules` copy) loads source via a **cwd-relative** path, so it runs only when cwd is `01_Source/wealth-suite`.
- **Why:** Make every regression suite cwd-independent — matching the fix just applied to Delivery/Intraday under PROJ-D01 — so `06_Regression` is genuinely "runnable independently" as the README claims.
- **Fix:** Change `fs.readFileSync('js/data-model.js', …)` → `fs.readFileSync(path.join(__dirname, '..','..','01_Source','wealth-suite','js/data-model.js'), …)` (and the same for `js/modules/portfolio.js`).
- **Cost/risk:** Trivial and validated in principle by the identical PROJ-D01 fix. Held pending scope approval — the authorized fix covered the two `__dirname`-anchored suites only.

## R-3 — (Optional) Validate macro *value ranges* on import
- **What:** After MAC-D01, non-numeric input is rejected, but any finite number is accepted (e.g. a repo rate of 500, a negative CPI).
- **Why:** Catch fat-finger paste errors before they enter the readings.
- **Cost/risk:** Low, but adds domain assumptions (plausible ranges per indicator) that could go stale. **Recommend only if a real bad-paste incident occurs** — otherwise this is speculative validation the Charter warns against.

## R-4 — (Optional) Guard/normalize the `date` string
- **What:** `importSnapshot` accepts `json.date` verbatim; a malformed date would sort via `new Date(...)` as `Invalid Date`.
- **Why:** No current UI path supplies a bad date, but the import accepts arbitrary JSON.
- **Cost/risk:** Low. A simple ISO-format check with a clear rejection message. **Low priority** — theoretical, not observed.

## R-5 — (If MAC-03 ever needs execution-level coverage) Extract `computeReadings()`
- **What:** MAC-03's delta is verified by re-derivation, not the live render path, because it lives inline in the DOM-coupled `refresh()`.
- **Why:** If the change/colour/formatting logic ever grows more complex, extracting a pure `computeReadings()` (declined this pass to keep the source change minimal) would let the live path be tested directly.
- **Cost/risk:** Low, behaviour-preserving — but unnecessary while the delta stays a one-line subtraction. **Not recommended now**; recorded so the option isn't forgotten.

---

**Freeze disposition:** none of R-1…R-5 blocks Macro v1.0. R-2 (PROJ-D01b) is the only item touching currently-red-from-some-cwd behaviour, and it concerns a *test harness*, not product code.
