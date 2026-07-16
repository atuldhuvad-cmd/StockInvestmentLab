# Delivery Paper Trading v1.6 Verification

Date: 2026-07-16
Baseline: `wealth-suite-v1.5` (`5f9a4340a5fe79e8b7b592d72d96d7a1e01adb47`)
Release target: `wealth-suite-v1.6`

## Scope delivered

Delivery now contains four sub-tabs without adding a main navigation module:

1. Screener
2. Paper Portfolio
3. Paper Transactions
4. Performance Review

The main workflow remains Overview, Portfolio, Watchlist, Delivery, and
Fundamentals.

## Isolated paper data

Two backward-compatible fields were added to the existing state document:

- `paperDeliveryTransactions`
- `paperDeliveryConfig`

Paper transactions contain dated BUY/SELL details, charges, notes, timestamps,
and frozen BUY-entry snapshots. Snapshots preserve Business Quality, Financial
Strength, Valuation, Technical Trend, Risk, overall Delivery score, rating,
technical-data date, price coverage, and the paper-buy reason.

Paper holdings are reconstructed from the paper ledger. BUY charges enter
weighted-average cost; SELL charges reduce proceeds. Partial and complete sales
retain realised results and transaction history. Correction deletion is
explicitly distinguished from Paper Sell and is blocked when later SELL records
depend on the record.

The real `holdings` and `portfolioTransactions` collections are not read or
written by paper transaction operations.

## Capital and prices

- Starting Paper Capital defaults to zero and blocks Paper Buy until configured.
- Maximum allocation per stock and maximum open holding limits are enforced.
- Available cash includes BUY/SELL amounts and charges.
- Imported OHLCV closes are selected locally and displayed with their dates.
- Stale imported values are labelled Historical, not live.
- When imported history is unavailable, a positive manual paper price and valid
  non-future date are mandatory.
- No price, date, capital, trade, or return is fabricated.

## Performance review

The review reports total transactions, open/closed positions, wins/losses, win
rate, average realised return, best/worst trade, maximum drawdown, average
holding days, current unrealised return, and total realised gain/loss. Closed
results are grouped by entry rating, entry Technical status, and entry valuation
band. Dated OHLCV history supplies 30/60/90-day observations where available.

The UI states that small samples are descriptive only and that paper results do
not guarantee future returns.

## Validation results

| Validation | Result |
|---|---:|
| Active JavaScript syntax | 13 / 13 passed |
| Retained inactive Macro syntax | Passed |
| Regression suites | 17 / 17 passed |
| Regression assertions | 531 passed, 0 failed |
| Focused paper-delivery assertions | 45 passed, 0 failed |
| Isolated browser checks | 53 / 53 passed |
| Console/runtime errors | 0 |
| `git diff --check` | Passed |

Six historical suites were executed through the same temporary read-only source
path adapter used by prior releases. The adapter was removed after execution.

The browser used a disposable isolated Chrome profile and synthetic fixtures.
No private portfolio or paper-trading data appears in this report.

## Browser verification

- Delivery and all four sub-tabs open correctly.
- Paper Buy from Screener works after capital configuration.
- Zero capital blocks BUY.
- The imported close and its historical date label are visible.
- Partial and full Paper Sell work and preserve all three synthetic transactions.
- BUY entry scores remain frozen after current model inputs change.
- Paper Portfolio, Paper Transactions, and Performance Review render on desktop.
- Paper transaction cards and all sub-tabs render at a 390-pixel mobile width
  without page-level horizontal overflow.
- The real Portfolio fixture remains byte-identical throughout paper operations.
- Overview shows Paper Delivery Portfolio separately and excludes its value from
  real Portfolio wealth.
- Backup export/import restores paper capital, transactions, entry snapshots,
  and real Portfolio data separately.
- Legacy Macro, Research, Intraday, and Settings fixtures survive unchanged.

## Financial invariants

- Delivery baseline scores, ratings, and ten-company ranking are unchanged.
- Delivery Technical Trend formulas and thresholds are unchanged.
- Fundamentals and Watchlist code are unchanged.
- Real Portfolio transaction calculations and storage are unchanged.
- IndexedDB database identifiers, object store, record key, and schema version
  are unchanged.
- Existing v1.5 backups load with zero paper capital and no paper transactions;
  opening old state creates no fake records.

## Release conclusion

Delivery Paper Trading is isolated, backward-compatible, responsive, and fully
covered by calculation and browser regression tests. It is ready for the single
requested commit and `wealth-suite-v1.6` tag.
