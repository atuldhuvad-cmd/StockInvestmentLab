# Portfolio Transaction Ledger v1.1 Verification

**Date:** 2026-07-15

**Branch:** `master`

**Baseline:** `f1ec490ed121bb7386efd96e084535dc56b5b3f6` (`wealth-suite-v1.0`)

**Initial Git status:** clean

## Result

**PASS — the Portfolio Transaction Ledger is backward-compatible and ready for `wealth-suite-v1.1`.**

## Implemented behavior

- Manual BUY and SELL transactions require a positive quantity, positive price, and valid non-future `transactionDate`.
- BUY represents a purchase and recalculates the current holding with weighted-average cost.
- An optional current snapshot price is retained separately from transaction price for unrealised gain/loss.
- SELL represents a sale, uses the pre-sale weighted-average cost basis, and records realised gain/loss.
- Partial SELL reduces quantity without changing remaining average cost.
- Full SELL closes the current holding while retaining transaction history.
- SELL greater than available quantity is rejected without state mutation.
- Sell is the primary holding action.
- Delete holding is a secondary, confirmed data-correction action. It permanently removes only the holding snapshot and never creates a SELL or realised-gain record.
- Existing holdings-only records remain valid and are not assigned transaction dates.
- Imported or legacy transaction records without dates remain unchanged and display `Date unavailable`.
- Full-state backup export/import preserves transaction dates, realised gain, and missing legacy dates exactly.

## Data compatibility

- Added `portfolioTransactions` to the shared state with schema version 3.
- The existing shallow default merge supplies an empty ledger when an older backup has no transaction collection.
- Existing `holdings`, storage key, IndexedDB database/store/key, and full-state JSON persistence mechanism are unchanged.
- No record is rewritten on load. Schema version is advanced for current empty state and when a manual ledger transaction is committed.
- Legacy `active:false` filtering remains unchanged in Portfolio and Intraday.

## Automated verification

### Syntax

- Active JavaScript files checked: 15
- Passed: 15
- Failed: 0

### Regression

- Logical suites: 10
- Runnable JavaScript files: 13
- Assertions passed: 350
- Assertions failed: 0
- Skipped: 0

Focused ledger coverage was executed in both the module and central regression locations: 40 assertions each, covering date validation, BUY aggregation, partial/full SELL, cost basis, realised/unrealised separation, oversell rejection, legacy duplicate holdings, inactive holdings, correction-only deletion, schema version, and backup preservation.

### Isolated browser

- Checks passed: 61
- Checks failed: 0
- Console errors: 0
- Runtime exceptions: 0
- Unhandled promise rejections: 0
- Browser-protocol errors: 0

Browser coverage included:

- Overview default and all nine navigation destinations
- Portfolio blank/future date rejection
- Dated BUY creation and visible history
- Second BUY weighted-average cost
- Sell primary action
- Partial SELL and realised gain
- Full SELL and retained history
- Legacy missing-date display
- Delete holding without a SELL record
- Legacy `active:false` exclusion
- Overview read-only behavior and realised/unrealised presentation
- Watchlist and Research compatibility
- Fundamentals latest and historical outputs
- Delivery scores, ratings, and ranking order
- Macro JSON import
- Intraday allocation calculation
- Settings persistence
- IndexedDB no-rewrite load behavior
- Full JSON backup export/import round-trip

## Frozen invariants

- Existing Portfolio `computeRow()` and `computeSummary()` formulas are unchanged.
- Fundamentals latest ROE and historical output baselines are unchanged.
- Delivery scores, ratings, and rankings are unchanged.
- Intraday capital-ceiling calculations are unchanged and continue to consume the holdings snapshot.
- Watchlist and Research legacy mappings are unchanged.
- Macro import, Settings persistence, IndexedDB identifiers, and backup mechanism are unchanged.

## Intended release files

- `01_Source/wealth-suite/js/data-model.js`
- `01_Source/wealth-suite/js/modules/portfolio.js`
- `01_Source/wealth-suite/js/modules/overview.js`
- `01_Source/wealth-suite/css/main.css`
- `05_Modules/Portfolio/Portfolio_Financial_Specification.md`
- `05_Modules/Portfolio/Portfolio_Integrity_Checklist.md`
- `05_Modules/Portfolio/Portfolio_transaction_ledger_tests.js`
- `06_Regression/Portfolio/Portfolio_transaction_ledger_tests.js`
- `HOW_TO_USE.txt`
- `07_Session Reports/Portfolio_Transaction_Ledger_v1.1_Verification.md`

No private financial data, browser-profile data, backup file, or temporary test artifact is included.
