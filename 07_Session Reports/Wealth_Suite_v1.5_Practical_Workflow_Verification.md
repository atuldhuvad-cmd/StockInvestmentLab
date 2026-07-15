# Wealth Suite v1.5 — Practical Workflow Verification

Date: 2026-07-15
Baseline: `wealth-suite-v1.4` (`a8f485d8ac68b95566bedae2588be54b998e7c3b`)
Release target: `wealth-suite-v1.5`

## Final product scope

**Personal Delivery Investment and Portfolio Management Platform**

Active workflow:

1. Overview
2. Portfolio
3. Watchlist
4. Delivery
5. Fundamentals

Overview remains the default module. Macro is no longer loaded, registered, or
shown in Overview. Macro source and regressions remain in the repository.

## Practical Overview result

The developer-facing data-status card was replaced by **Data & Backup Health**.
It reports only existing data:

- Portfolio last updated
- Latest Portfolio transaction date
- Latest imported price-history date
- Delivery companies with complete Technical Trend coverage
- Delivery companies waiting for price history
- Latest Fundamentals fiscal year
- Last successful backup date
- Backup status: Never created, Current, or Due

No timestamp is invented for old state. A successful explicit export adds the
optional `meta.lastBackupAt` timestamp to the downloaded backup and persists it
locally. Backups up to seven days old are Current; older backups are Due.

## Compatibility result

- Legacy `macroIndicators` records remain unchanged through rendering, save,
  export, reload, and import.
- Macro, Research, Intraday, and legacy Settings data remain present in normal
  JSON backups.
- Older state without `meta.lastBackupAt` loads normally and displays Never
  recorded / Never created.
- IndexedDB name, version, object store, record key, schema version, storage
  keys, and import structure are unchanged.
- Portfolio transactions, Watchlist compatibility, Delivery Technical Trend,
  Fundamentals calculations, and all financial formulas remain unchanged.

Compatibility note: **Legacy Macro data remains preserved in backups but is no
longer part of the active workflow.**

## Validation results

| Validation | Result |
|---|---:|
| Active JavaScript syntax | 12 / 12 passed |
| Retained inactive Macro syntax | Passed |
| Focused workflow regression syntax | Passed |
| Regression suites | 16 / 16 passed |
| Regression assertions | 483 passed, 0 failed |
| Isolated headless-browser checks | 45 / 45 passed |
| Console, runtime, or protocol errors | 0 |
| `git diff --check` | Passed |

Six historical suites use repository-relative source paths from their former
locations. They were executed with a temporary read-only path adapter, as in
prior release verification; the adapter was removed immediately afterward.

The browser fixture contained only synthetic compatibility records and ran in
a disposable isolated Chrome profile. No private financial data was used or
written to this report.

## Browser verification

- Exactly five navigation modules render in the required order.
- Overview opens by default; Macro is absent from navigation, script loading,
  registration, and Overview.
- All five active modules open successfully.
- Empty and seeded Overview states render the required direct messages and
  health values without mutating state.
- A real backup export records `lastBackupAt`, includes the same timestamp in
  the downloaded JSON, and survives IndexedDB reload.
- Backup export/import preserves synthetic legacy Macro, Research, Intraday,
  Settings, Portfolio, price-history, and Fundamentals state.
- No console, runtime, or protocol errors occurred.

## Financial and workflow invariants

- Portfolio BUY ledger output remains quantity 10 and weighted cost 100 for the
  established fixture; new holdings still omit the legacy `active` field.
- Legacy `active:false` holdings remain excluded.
- Delivery ranking, scores, and ratings remain byte-for-byte equal to the v1.4
  ten-company browser baseline.
- Technical Trend remains Complete / 85 / Strong Trend for the established
  250-row synthetic fixture.
- Latest TCS ROE remains `46.115255501678476`.
- Watchlist stored `Research` category still displays as `Needs Study`.
- No formula, threshold, score, rating, ranking, schema version, IndexedDB key,
  or backup import behavior changed.

## Release conclusion

The focused five-module practical workflow passes the complete regression and
isolated browser suites. Legacy Macro data remains compatible and the optional
backup timestamp is recorded only by successful explicit export. The release
is ready for the single requested commit and `wealth-suite-v1.5` tag.
