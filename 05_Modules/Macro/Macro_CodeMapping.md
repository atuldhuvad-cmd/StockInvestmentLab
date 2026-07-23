# Macro Intelligence — Code Mapping (Phase 2)

*Maps each specified calculation to the exact production code that implements it. No logic is described here that isn't in `js/modules/macro.js`; nothing is reimplemented.*

**Module shape:** `MacroModule = (function(){ … })()` — an IIFE returning a public interface. Public surface after this verification pass: `{ render, importSnapshot, latestTwo }`.

| Calc | Function | Location | Public? | Executed in Node tests? |
|---|---|---|---|---|
| MAC-01 | `importSnapshot(json)` | `macro.js` lines 40–56 | Yes (always was) | **Yes** — real function |
| MAC-02 | `latestTwo(key)` | `macro.js` lines ~58–61 | **Yes (exposed 2026-07-23)** | **Yes** — real function |
| MAC-03 | change delta, inline | inside `refresh(container)` (`const change = previous ? latest.value - previous.value : null;`) | No (DOM-coupled) | **No** — re-derived (see below) |

## The one source change made this pass

To let the regression suite exercise the **real** `latestTwo()` rather than a copy, its reference was added to the module's returned object:

```js
// before:  return { render, importSnapshot };
// after:   return { render, importSnapshot, latestTwo };
```

This is a **pure exposure change** — `latestTwo`'s body is untouched, `render`/`refresh`/`importSnapshot` are untouched, and adding a key to the returned object cannot affect the single existing caller (`MacroModule.render`, invoked by the router). Confirmed behaviour-preserving; the app's public entry point is unchanged.

A more thorough extraction — pulling the MAC-03 delta out of `refresh()` into a testable `computeReadings()` — was **considered and explicitly declined** in favour of the minimal change above (approved scope decision, 2026-07-23). Consequence: MAC-03 is verified by re-derivation, not by executing the live render path. Recorded honestly rather than quietly widening scope.

## MAC-01 defect fix applied this pass (Phase 6A)

`importSnapshot()` lines 43–50 gained a parse-then-guard step for MAC-D01:
```js
const num = parseFloat(value);
if (Number.isNaN(num)) return;     // skip non-numeric field
… const point = { date, value: num, source: "import" };
```
Behaviour change is confined to previously-broken input (non-numeric fields); valid numbers including `0` are unaffected. Full evidence in `Macro_Verification_Report.md`.

## Data-model touchpoints

- Reads/writes `WealthData.get().macroIndicators` (an object keyed by indicator `key` → array of `{date, value, source}`). Defined in `js/data-model.js` (line 97).
- **No dedicated setter exists** for macro data, so `importSnapshot()` mutates `macroIndicators` directly — a deviation from the data-model's "write through setters" rule, tracked as integrity observation INV-M4 (`Macro_Integrity_Checklist.md`), not a financial defect.
