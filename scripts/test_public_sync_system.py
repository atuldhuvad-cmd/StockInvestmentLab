#!/usr/bin/env python3
"""Deterministic tests for the personal Public Market Data Sync subsystem."""

import json
import math
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from datetime import date, timedelta
from unittest.mock import patch

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(PROJECT_ROOT, "scripts"))

import fetch_public_prices as fetcher
import serve_wealth_suite as server
import validate_market_data as validator


def valid_rows(count=220, end=None):
    end = end or date.today()
    days = []
    cursor = end
    while len(days) < count:
        if cursor.weekday() < 5:
            days.append(cursor)
        cursor -= timedelta(days=1)
    return [
        {
            "date": str(day),
            "open": 100 + idx / 10,
            "high": 102 + idx / 10,
            "low": 99 + idx / 10,
            "close": 101 + idx / 10,
            "volume": 1000 + idx,
        }
        for idx, day in enumerate(reversed(days))
    ]


class FakeProvider:
    def __init__(self, results):
        self.results = results
        self.symbol_map = {symbol: f"{symbol}.NS" for symbol in results}

    def download_daily(self, symbols, period="1y"):
        return {symbol: self.results[symbol] for symbol in symbols}


class PublicSyncTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        validator.DATA_DIR = self.temp.name
        validator.SNAPSHOT_PATH = os.path.join(self.temp.name, "public_market_data.json")
        validator.PREVIOUS_SNAPSHOT_PATH = os.path.join(self.temp.name, "public_market_data_previous.json")
        validator.SYNC_STATUS_PATH = os.path.join(self.temp.name, "public_sync_status.json")
        fetcher.SYMBOL_MAP_PATH = os.path.join(PROJECT_ROOT, "config", "public_symbol_map.json")

    def tearDown(self):
        self.temp.cleanup()

    def test_symbol_mapping(self):
        provider = fetcher.YFinanceProvider()
        self.assertEqual(provider.resolve_provider_symbol("TCS"), "TCS.NS")
        self.assertEqual(provider.resolve_provider_symbol("NIFTY"), "^NSEI")
        self.assertEqual(provider.resolve_provider_symbol("TCS.NS"), "TCS.NS")

    def test_validation_requires_200_rows_and_rejects_non_finite(self):
        ok, error, _, _ = validator.validate_ohlcv_rows(valid_rows(199))
        self.assertFalse(ok)
        self.assertIn("minimum 200", error)
        rows = valid_rows()
        rows[5]["close"] = math.nan
        ok, error, _, _ = validator.validate_ohlcv_rows(rows)
        self.assertFalse(ok)
        self.assertIn("non-finite", error)

    def test_duplicate_and_price_boundaries_are_rejected(self):
        rows = valid_rows()
        rows.append(dict(rows[-1]))
        self.assertIn("Duplicate date", validator.validate_ohlcv_rows(rows)[1])
        rows = valid_rows()
        rows[0]["high"] = rows[0]["low"] - 1
        self.assertFalse(validator.validate_ohlcv_rows(rows)[0])

    def test_stale_date_uses_weekdays(self):
        recent = date.today()
        while recent.weekday() >= 5:
            recent -= timedelta(days=1)
        self.assertFalse(validator.check_stale_date(recent)[0])
        self.assertTrue(validator.check_stale_date(date.today() - timedelta(days=14))[0])

    def test_atomic_snapshot_keeps_previous_copy(self):
        first = {"version": "1", "tickers": {"TCS": {"valid": True}}}
        second = {"version": "2", "tickers": {"INFY": {"valid": True}}}
        validator.atomic_save_snapshot(first)
        validator.atomic_save_snapshot(second)
        with open(validator.SNAPSHOT_PATH, encoding="utf-8") as handle:
            self.assertEqual(json.load(handle), second)
        with open(validator.PREVIOUS_SNAPSHOT_PATH, encoding="utf-8") as handle:
            self.assertEqual(json.load(handle), first)

    def test_partial_failure_preserves_last_known_good(self):
        old_tcs = {
            "ticker": "TCS", "valid": True, "validation_status": "VALID",
            "rows": valid_rows(), "latest_date": str(date.today()),
        }
        validator.atomic_save_snapshot({"version": "1", "tickers": {"TCS": old_tcs}})
        fake = FakeProvider({
            "TCS": {"ok": False, "error": "offline", "rows": [], "provider_symbol": "TCS.NS"},
            "INFY": {"ok": True, "error": None, "rows": valid_rows(), "provider_symbol": "INFY.NS"},
        })
        with patch.object(fetcher, "YFinanceProvider", return_value=fake):
            result = fetcher.sync_public_prices(["TCS", "INFY"])
        self.assertEqual(result["failed"], 1)
        self.assertEqual(result["successful"], 1)
        preserved = result["snapshot"]["tickers"]["TCS"]
        self.assertTrue(preserved["valid"])
        self.assertEqual(preserved["validation_status"], "PRESERVED_ON_FAILURE")
        self.assertEqual(len(preserved["rows"]), 220)

    def test_retry_includes_preserved_failure(self):
        record = {"ticker": "TCS", "valid": True, "validation_status": "PRESERVED_ON_FAILURE", "rows": valid_rows()}
        validator.atomic_save_snapshot({"version": "1", "tickers": {"TCS": record}})
        fake = FakeProvider({"TCS": {"ok": True, "error": None, "rows": valid_rows(), "provider_symbol": "TCS.NS"}})
        with patch.object(fetcher, "YFinanceProvider", return_value=fake):
            result = fetcher.sync_public_prices(["TCS"], retry_failed_only=True)
        self.assertEqual(result["successful"], 1)
        self.assertEqual(result["snapshot"]["tickers"]["TCS"]["validation_status"], "VALID")

    def test_server_read_endpoints_and_write_guard(self):
        server.SYNC_STATUS_PATH = validator.SYNC_STATUS_PATH
        if server.HAS_FLASK:
            client = server.app.test_client()
            self.assertEqual(client.get("/api/public-prices").status_code, 200)
            self.assertEqual(client.get("/api/public-sync-status").status_code, 200)
            self.assertEqual(client.post("/api/sync-public-prices", data="{}").status_code, 415)
            response = client.post(
                "/api/sync-public-prices", json={},
                headers={"Origin": "https://untrusted.example"},
            )
            self.assertEqual(response.status_code, 403)
            return

        from http.server import ThreadingHTTPServer
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.build_fallback_handler())
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{httpd.server_port}"
        try:
            self.assertEqual(urllib.request.urlopen(base + "/api/public-prices").status, 200)
            self.assertEqual(urllib.request.urlopen(base + "/api/public-sync-status").status, 200)
            request = urllib.request.Request(base + "/api/sync-public-prices", data=b"{}", method="POST")
            with self.assertRaises(urllib.error.HTTPError) as rejected:
                urllib.request.urlopen(request)
            self.assertEqual(rejected.exception.code, 415)
            rejected.exception.close()
            request = urllib.request.Request(
                base + "/api/sync-public-prices", data=b"{}", method="POST",
                headers={"Content-Type": "application/json", "Origin": "https://untrusted.example"},
            )
            with self.assertRaises(urllib.error.HTTPError) as rejected:
                urllib.request.urlopen(request)
            self.assertEqual(rejected.exception.code, 403)
            rejected.exception.close()
        finally:
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    result = unittest.main(verbosity=2, exit=False)
    guide_updated = False
    if result.result.wasSuccessful():
        try:
            import generate_pdf_user_guide
            generate_pdf_user_guide.generate_markdown_and_html_guide()
            guide_updated = True
        except Exception as e:
            print(f"User guide update failed: {e}", file=sys.stderr)
    sys.exit(0 if result.result.wasSuccessful() and guide_updated else 1)
