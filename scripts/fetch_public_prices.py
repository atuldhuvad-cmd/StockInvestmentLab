#!/usr/bin/env python3
"""
===============================================================================
Public Market Price Downloader
===============================================================================
Downloads public daily OHLCV historical price data using Python and yfinance
(with standard library urllib fallback) under an abstract provider boundary.

Features:
- Abstract `MarketDataProvider` class & `YFinanceProvider` adapter.
- Symbol mapping via `config/public_symbol_map.json` (.NS for Indian equities, ^NSEI for Nifty 50).
- Targets 250+ usable completed daily candles (~300+ calendar days).
- Filters out incomplete intraday candles.
- Preserves last-known-good dataset on failure.
- Supports bounded multi-symbol sync jobs and retrying failed symbols only.
===============================================================================
"""

import os
import sys
import json
import math
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, date

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_DIR = os.path.join(PROJECT_ROOT, "config")
SYMBOL_MAP_PATH = os.path.join(CONFIG_DIR, "public_symbol_map.json")
NIFTY500_SYMBOLS_PATH = os.path.join(CONFIG_DIR, "nifty500_symbols.txt")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from validate_market_data import (
    validate_ohlcv_rows, check_stale_date, load_current_snapshot,
    atomic_save_snapshot, update_sync_status
)

# Load Symbol Map
def load_symbol_map():
    if os.path.exists(SYMBOL_MAP_PATH):
        try:
            with open(SYMBOL_MAP_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def load_default_universe():
    """Return the frozen official Nifty 500 universe plus benchmark indices."""
    symbols = []
    if os.path.exists(NIFTY500_SYMBOLS_PATH):
        with open(NIFTY500_SYMBOLS_PATH, "r", encoding="utf-8") as source:
            symbols = [
                line.strip().upper() for line in source
                if line.strip() and not line.lstrip().startswith("#")
            ]
    benchmarks = ["NIFTY", "BANKNIFTY"]
    return list(dict.fromkeys(symbols + benchmarks))

class MarketDataProvider:
    """Abstract base class for public market data providers."""
    def download_daily(self, symbols, period="1y"):
        raise NotImplementedError("Subclasses must implement download_daily")

class YFinanceProvider(MarketDataProvider):
    """
    Public market data provider implementation using yfinance with urllib HTTP fallback.
    Does NOT require broker credentials, accounts, or API keys.
    """
    def __init__(self):
        self.symbol_map = load_symbol_map()

    def resolve_provider_symbol(self, app_symbol):
        clean = str(app_symbol or "").strip().upper()
        if clean in self.symbol_map:
            return self.symbol_map[clean]
        if clean.endswith(".NS") or clean.endswith(".BO") or clean.startswith("^"):
            return clean
        return f"{clean}.NS"

    def _fetch_urllib(self, symbol):
        provider_symbol = self.resolve_provider_symbol(symbol)
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{provider_symbol}?range=1y&interval=1d"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=12) as response:
                if response.status != 200:
                    return False, f"HTTP {response.status}", [], provider_symbol
                payload = json.loads(response.read().decode("utf-8"))

            chart = payload.get("chart", {})
            result_list = chart.get("result")
            if not result_list:
                err = chart.get("error", {}).get("description", "No chart data returned")
                return False, err, [], provider_symbol

            result = result_list[0]
            timestamps = result.get("timestamp", [])
            quote = result.get("indicators", {}).get("quote", [{}])[0]

            opens = quote.get("open", [])
            highs = quote.get("high", [])
            lows = quote.get("low", [])
            closes = quote.get("close", [])
            volumes = quote.get("volume", [])

            rows = []
            today_str = date.today().strftime("%Y-%m-%d")

            for idx in range(len(timestamps)):
                ts = timestamps[idx]
                o = opens[idx] if idx < len(opens) else None
                h = highs[idx] if idx < len(highs) else None
                l = lows[idx] if idx < len(lows) else None
                c = closes[idx] if idx < len(closes) else None
                v = volumes[idx] if idx < len(volumes) else None

                if any(val is None for val in (ts, o, h, l, c, v)):
                    continue
                if not all(math.isfinite(float(val)) for val in (o, h, l, c, v)):
                    continue

                dt_str = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
                # Exclude incomplete current intraday candle if timestamp is today and market is live
                if dt_str == today_str and datetime.now().hour < 16:
                    continue

                rows.append({
                    "date": dt_str,
                    "open": round(float(o), 2),
                    "high": round(float(h), 2),
                    "low": round(float(l), 2),
                    "close": round(float(c), 2),
                    "volume": int(v)
                })

            return True, "OK", rows, provider_symbol

        except Exception as e:
            return False, str(e), [], provider_symbol

    def download_single(self, symbol):
        # Try yfinance library if installed
        provider_symbol = self.resolve_provider_symbol(symbol)
        try:
            import yfinance as yf
            ticker = yf.Ticker(provider_symbol)
            df = ticker.history(period="1y", interval="1d")
            if df is not None and not df.empty and len(df) > 0:
                rows = []
                today_str = date.today().strftime("%Y-%m-%d")
                for index, row in df.iterrows():
                    dt_str = index.strftime("%Y-%m-%d")
                    if dt_str == today_str and datetime.now().hour < 16:
                        continue
                    values = [row["Open"], row["High"], row["Low"], row["Close"], row["Volume"]]
                    if not all(math.isfinite(float(value)) for value in values):
                        continue
                    rows.append({
                        "date": dt_str,
                        "open": round(float(row["Open"]), 2),
                        "high": round(float(row["High"]), 2),
                        "low": round(float(row["Low"]), 2),
                        "close": round(float(row["Close"]), 2),
                        "volume": int(row["Volume"])
                    })
                if len(rows) > 0:
                    return True, "OK", rows, provider_symbol
        except Exception:
            pass # Fall back to urllib HTTP fetcher below

        return self._fetch_urllib(symbol)

    def download_daily(self, symbols, period="1y"):
        results = {}
        clean_symbols = list(dict.fromkeys(
            str(sym).strip().upper() for sym in symbols if str(sym).strip()
        ))
        # A bounded worker pool keeps a 500-stock personal sync practical without
        # flooding the free public provider or requiring enterprise job services.
        with ThreadPoolExecutor(max_workers=min(8, len(clean_symbols) or 1)) as executor:
            jobs = {executor.submit(self.download_single, sym): sym for sym in clean_symbols}
            for job in as_completed(jobs):
                clean_sym = jobs[job]
                try:
                    ok, err, rows, provider_sym = job.result()
                except Exception as exc:
                    ok, err, rows = False, str(exc), []
                    provider_sym = self.resolve_provider_symbol(clean_sym)
                results[clean_sym] = {
                    "ok": ok,
                    "error": err if not ok else None,
                    "rows": rows,
                    "provider_symbol": provider_sym
                }
        return results

def sync_public_prices(target_symbols=None, retry_failed_only=False):
    """
    Main sync job runner.
    Batch downloads OHLCV historical candles, validates dataset, and performs atomic snapshot save.
    """
    current_snapshot = load_current_snapshot()
    current_tickers = current_snapshot.get("tickers", {})
    provider = YFinanceProvider()

    if target_symbols is None:
        target_symbols = load_default_universe()

    if retry_failed_only:
        # Filter symbols that failed or are missing in current snapshot
        target_symbols = [
            sym for sym in target_symbols
            if sym not in current_tickers
            or current_tickers[sym].get("validation_status") != "VALID"
        ]

    if not target_symbols:
        return {
            "ok": True,
            "message": "No tickers required sync",
            "snapshot": current_snapshot
        }

    raw_results = provider.download_daily(target_symbols)
    updated_tickers = dict(current_tickers) # Clone current tickers to preserve valid prior data

    successful_count = 0
    failed_count = 0
    stale_count = 0
    skipped_count = 0
    failed_list = []
    stale_list = []

    for app_sym, res in raw_results.items():
        provider_sym = res.get("provider_symbol", app_sym)
        if not res["ok"]:
            failed_count += 1
            failed_list.append(app_sym)
            # If previous valid record exists, preserve it!
            if app_sym in current_tickers:
                updated_tickers[app_sym]["validation_status"] = "PRESERVED_ON_FAILURE"
                updated_tickers[app_sym]["error_message"] = res["error"]
            else:
                updated_tickers[app_sym] = {
                    "ticker": app_sym,
                    "provider_ticker": provider_sym,
                    "exchange": "NSE",
                    "currency": "INR",
                    "rows": [],
                    "latest_date": None,
                    "fetch_timestamp": datetime.now().isoformat(),
                    "row_count": 0,
                    "valid": False,
                    "validation_status": "FAILED",
                    "error_message": res["error"],
                    "data_source": "Yahoo Finance (Public)"
                }
            continue

        # Validate downloaded rows strictly
        is_valid, err_msg, clean_rows, latest_date = validate_ohlcv_rows(res["rows"], symbol=app_sym)
        if not is_valid:
            failed_count += 1
            failed_list.append(app_sym)
            if app_sym in current_tickers:
                updated_tickers[app_sym]["validation_status"] = "PRESERVED_ON_INVALID"
                updated_tickers[app_sym]["error_message"] = err_msg
            else:
                updated_tickers[app_sym] = {
                    "ticker": app_sym,
                    "provider_ticker": provider_sym,
                    "exchange": "NSE",
                    "currency": "INR",
                    "rows": [],
                    "latest_date": None,
                    "fetch_timestamp": datetime.now().isoformat(),
                    "row_count": 0,
                    "valid": False,
                    "validation_status": "INVALID",
                    "error_message": err_msg,
                    "data_source": "Yahoo Finance (Public)"
                }
            continue

        # Check for stale date
        is_stale, stale_msg = check_stale_date(latest_date)
        status_label = "STALE" if is_stale else "VALID"
        if is_stale:
            stale_count += 1
            stale_list.append(app_sym)
        else:
            successful_count += 1

        updated_tickers[app_sym] = {
            "ticker": app_sym,
            "provider_ticker": provider_sym,
            "exchange": "NSE",
            "currency": "INR",
            "rows": clean_rows,
            "latest_date": str(latest_date) if latest_date else None,
            "fetch_timestamp": datetime.now().isoformat(),
            "row_count": len(clean_rows),
            "valid": True,
            "validation_status": status_label,
            "error_message": stale_msg if is_stale else None,
            "data_source": "Yahoo Finance (Public)"
        }

    # Atomic Save Snapshot
    new_snapshot = {
        "version": "1.0.0",
        "last_updated": datetime.now().isoformat(),
        "data_source": "Yahoo Finance (Public)",
        "tickers": updated_tickers
    }
    atomic_save_snapshot(new_snapshot)

    # Write status metadata
    total = len(target_symbols)
    update_sync_status(total, successful_count, failed_count, stale_count, skipped_count, failed_list, stale_list)

    return {
        "ok": True,
        "total": total,
        "successful": successful_count,
        "failed": failed_count,
        "stale": stale_count,
        "failed_tickers": failed_list,
        "stale_tickers": stale_list,
        "snapshot": new_snapshot
    }

if __name__ == "__main__":
    print("Starting public price sync job...")
    res = sync_public_prices()
    print(f"Sync Result: Success={res['successful']}, Failed={res['failed']}, Stale={res['stale']}")
