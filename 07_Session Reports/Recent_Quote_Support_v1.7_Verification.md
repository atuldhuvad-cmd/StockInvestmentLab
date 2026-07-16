# Recent Quote Support v1.7 Verification

Date: 2026-07-16
Baseline: `151e1aac6e5ab2e2840034a9751520fc6f8a195b` (`wealth-suite-v1.6`)
Target: `wealth-suite-v1.7`

## Scope delivered

- Preserved and completed the unfinished `paper-quotes.js` and `index.html` work.
- Added an optional Python Angel One SmartAPI quote helper bound only to
  `127.0.0.1:8765`.
- Exposed only read-only `GET /health` and `GET /quote?symbol=...` behavior.
- Added Get Latest Price and Refresh Price to Paper Buy and Paper Sell.
- Added visible price, timestamp, source, age, and freshness/status evidence.
- Added mandatory date, time, price, and source/note validation for Manual Price.
- Stored `priceSource`, `priceTimestamp`, `priceStatus`, `quoteAgeSeconds`, and
  `manualPriceNote` on every new paper BUY/SELL.
- Preserved legacy v1.6 paper records without inventing missing evidence.
- Kept imported daily CSV closes explicitly historical and never live.

## Freshness and selection policy

1. Current Angel One quote.
2. Market Closed — Latest Available Price.
3. Explicit Manual Price with observation date, time, and source/note.
4. Explicitly selected imported historical daily close.

During the weekday NSE session (09:15–15:30 IST), a quote is Current through
exactly 300 seconds and Stale after 300 seconds. A Stale quote cannot be saved.
Outside those hours, the latest available broker price is allowed with the
market-closed label. Browser validation recomputes age at confirmation time.

## Security result

- Frontend credential/authentication reference scan: PASS.
- Tracked credential assignment scan: PASS.
- Localhost-only binding check: PASS.
- No order, modification, cancellation, GTT, WebSocket trading, or automated
  execution endpoint in the helper: PASS.
- SmartAPI SDK file logging is disabled before authenticated calls; server logs
  only the HTTP method and route path: PASS.
- Responses are allowlisted to symbol, exchange, price, quote timestamp, source,
  market status, data age, status, and sanitized error message: PASS.
- Missing local credentials fail safely without starting the service: PASS.

The committed credential file is an empty placeholder only. Real credentials
must remain in the Git-ignored `angelone_credentials.env` file.

## Validation results

| Check | Result |
|---|---:|
| Active JavaScript syntax | 14/14 passed |
| Python syntax | 4/4 passed |
| JavaScript regression suites | 18/18 passed |
| JavaScript regression assertions | 548 passed, 0 failed |
| Python quote-helper tests | 11 passed, 0 failed |
| Isolated browser checks | 24 passed, 0 failed |
| `git diff --check` | Passed |

Browser coverage included application/default navigation, all five active
modules, mocked current quote retrieval, quote evidence display, quote-backed
paper BUY and SELL, unavailable-service handling, Manual Price fallback, backup
round-trip, and absence of console/runtime errors.

## Compatibility and financial invariants

- Delivery scores, ratings, rankings, and Technical Trend outputs: unchanged.
- Real Portfolio holdings, transaction ledger, and calculations: unchanged.
- Fundamentals: unchanged.
- Existing Paper Delivery cash flow, weighted average, realised/unrealised gain,
  allocation, holding-limit, and performance calculations: unchanged.
- IndexedDB keys, database version, state schema version, and backup envelope:
  unchanged.
- New optional transaction fields round-trip through existing JSON backup logic.
- Old backups and v1.6 paper transactions remain valid without migration.
- Existing release tags were not moved or recreated.

## Launchers

- Normal offline: `Open_Wealth_Intelligence_Suite.bat`
- Optional quotes: `Open_Wealth_Suite_With_Quotes.bat`

The optional launcher requires locally installed Python dependencies, a SmartAPI
application, and real credentials configured outside Git. No live credential or
account data was used in automated verification.
