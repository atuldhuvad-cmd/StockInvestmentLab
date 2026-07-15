# Wealth Intelligence Suite v1.2 Technical Release Verification

**Date:** 2026-07-15

**Branch:** `master`

**Baseline:** `13d3459b174de455e23c98c7dca3ac40bcfec579` (`wealth-suite-v1.1`)

**Existing tags preserved:** `wealth-suite-v1.0`, `wealth-suite-v1.1`

**Initial Git status:** clean

## Result

**PASS — offline Price History import and Technical Trend are ready for `wealth-suite-v1.2`.**

No API, package manager, framework, server, cloud service, or generated market data was added. Business Quality, Financial Strength, Valuation, and Risk formulas are unchanged.

## Offline CSV import

- Added a browser file control in Delivery Screener for local OHLCV CSV files.
- Required fields: Date, Open, High, Low, Close, Volume.
- Header matching is case-insensitive and accepts common spacing/punctuation variations.
- Supports ordinary yfinance CSV output and yfinance multi-row Price/Ticker headers.
- Normalizes lookup symbols such as `TCS.NS` and `NSE:TCS.NS` to `TCS` without changing existing company tickers.
- Rejects invalid dates, blank/non-finite numbers, Infinity, NaN, and negative OHLCV values.
- Sorts rows oldest to newest.
- De-duplicates dates and keeps the latest valid source row for a duplicate date.
- Stores validated rows in IndexedDB through the existing full-state persistence mechanism.
- Adds price history to normal JSON backup export/import without changing the existing storage key, database, object store, record key, or backup workflow.
- Older backups receive an empty `priceHistory` object and are not migrated or populated with invented rows.

## Technical calculations

Calculated locally from imported rows:

- Latest close and price date
- 50-day and 200-day simple moving averages
- Price above each moving average
- 50 DMA above 200 DMA
- Wilder RSI 14
- Rolling 252-row high and distance from that high
- 20-day average volume and latest-volume ratio

Scoring is exactly the requested 25/20/20/15/10/10 model. Coverage rules are:

- 200 or more valid rows: Complete, scored, 5 of 5 pillars
- 50–199 rows: Limited Technical Data, Not Evaluated
- Fewer than 50 rows: Missing, Not Evaluated

Missing/Limited history retains four-pillar re-weighting and marks the assessment Partial. A partial candidate that would otherwise be Strong Buy is capped at Buy. With Complete history, all five original pillar weights participate and normal classification applies. Strong Trend is explicitly described as entry guidance, not an automatic buy signal.

## Real StockScreener file verification

The requested example `D:\StockScreener\data\raw\prices\TCS_5Y.csv` was not present. The available real file was used instead:

`D:\StockScreener\data\raw\prices\RELIANCE_5Y.csv`

- TCS imported rows: Not available — no TCS source file existed and no data was fabricated or relabeled
- RELIANCE valid rows: 1,238
- Rejected rows: 0
- Duplicate dates: 0
- Latest price date: 2026-07-07
- Technical Score: 25
- Technical status: Weak Trend
- Coverage: Complete
- Full-model Delivery overall: 59.4
- Full-model Delivery rating: Watch

The headless browser selected this file through the actual `<input type="file">` control. The production code contains no StockScreener path.

## Automated verification

### Syntax

- Active JavaScript files checked: 16
- Passed: 16
- Failed: 0

### Regression

- Runnable JavaScript files: 15
- Assertions passed: 460
- Assertions failed: 0
- Skipped: 0

The two new Price History suites contributed 55 assertions each. Coverage includes valid five-year CSV, exact 200-row boundary, Limited/Missing boundaries, missing columns, invalid dates, duplicate and unsorted dates, numeric strings, NaN/Infinity, symbol normalization, yfinance headers, RSI, both moving averages, 52-week high, volume comparison, score/status boundaries, legacy backup compatibility, and full price-history backup round-trip.

### Browser

- Full-suite checks passed: 61
- Real-file import checks passed: 11
- Total browser checks passed: 72
- Failed: 0
- Console/runtime/protocol errors: 0

Browser verification confirmed:

- Rendering Delivery with missing price data does not mutate shared state.
- Missing data shows Waiting for price history data and an Import CSV action.
- Missing data is Partial, 4 of 5 pillars, and cannot receive the highest recommendation.
- The real file is selected through the import control and stored with 1,238 rows.
- Complete data displays score, status, date, row count, coverage, 5-of-5 pillars, metrics, and passed/failed conditions.
- Price history survives actual JSON export/import exactly.
- All Portfolio ledger, Overview, Watchlist, Research, Fundamentals, Macro, Intraday, Settings, IndexedDB, and backup checks remain green.

## Frozen invariants

- Business Quality formula: unchanged
- Financial Strength formula: unchanged
- Valuation formula: unchanged
- Risk formula: unchanged
- Missing-technical overall score: unchanged four-pillar value
- Fundamentals latest ROE and historical outputs: unchanged
- Portfolio transaction ledger and calculations: unchanged
- Intraday capital-ceiling calculation: unchanged
- Watchlist and Research compatibility: unchanged
- Macro and Settings behavior: unchanged

## Intended release files

- `01_Source/wealth-suite/js/price-history.js`
- `01_Source/wealth-suite/js/data-model.js`
- `01_Source/wealth-suite/js/modules/delivery-screener.js`
- `01_Source/wealth-suite/index.html`
- `05_Modules/Delivery Screener/PriceHistory_regression_tests.js`
- `06_Regression/DeliveryScreener/PriceHistory_regression_tests.js`
- `05_Modules/Delivery Screener/DeliveryScreener_regression_tests.js`
- `06_Regression/DeliveryScreener/DeliveryScreener_regression_tests.js`
- `05_Modules/Delivery Screener/DeliveryScreener_Financial_Specification.md`
- `05_Modules/Portfolio/Portfolio_transaction_ledger_tests.js`
- `06_Regression/Portfolio/Portfolio_transaction_ledger_tests.js`
- `HOW_TO_USE.txt`
- `07_Session Reports/Wealth_Intelligence_Suite_v1.1_Technical_Release_Verification.md`

No private financial data, imported price CSV, browser-profile data, backup file, or temporary test artifact is included in the release commit.
