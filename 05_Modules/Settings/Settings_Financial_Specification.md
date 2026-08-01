# Settings Specification

## Components

`data-model.js` owns the compatibility settings object. `settings.js` owns an inactive informational renderer. No Settings navigation route or editing form is active.

## Responsibilities

| ID | Rule | Expected behavior |
|---|---|---|
| SET-01 | Default compatibility values | A reset creates `intradaySatelliteAllocationPct = 15` and `minRiskRewardRatio = 2.0`. |
| SET-02 | Read access | `getSetting(key)` returns one value; `getAllSettings()` returns the settings object. Unknown keys return `undefined`. |
| SET-03 | Backup compatibility | `replaceAll()` preserves a supplied settings object; reset restores defaults. Persistence owns backup validation. |
| SET-04 | Inactive shell | `render()` displays the inactive status and explains that legacy Intraday data remains preserved. It does not edit state. |

## Interfaces/Dependencies

The hidden Intraday module reads both values through `WealthData`. Persistence serializes and restores the settings object as part of whole-state backups. The active six-module shell does not register `SettingsModule` or `IntradayModule`.

## Constraints

These are non-financial compatibility rules, not calculations. Seven unused settings were removed in the Product Simplification Audit and must not be reintroduced without a live consumer. Inner-shape validation remains governed by the recorded Persistence potential defect PER-D02. No Settings write API exists.
