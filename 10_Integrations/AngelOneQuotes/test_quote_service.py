import json
import sys
import threading
import unittest
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from angelone_quote_client import IST, PublicQuoteError, classify_quote, load_credentials, parse_quote_timestamp
from instrument_mapping import normalize_symbol, select_nse_equity
from quote_server import ALLOWED_FIELDS, HOST, create_server


class FakeClient:
    def get_quote(self, symbol):
        if symbol == "FAIL":
            raise PublicQuoteError("private broker failure 123")
        if symbol == "UNKNOWN":
            raise PublicQuoteError("Quote unavailable for this symbol")
        return {
            "symbol": normalize_symbol(symbol), "exchange": "NSE", "price": 100.5,
            "quoteTimestamp": "2026-07-16T12:00:00+05:30", "source": "Angel One SmartAPI",
            "marketStatus": "Open", "dataAgeSeconds": 30, "status": "Current",
            "errorMessage": None, "secret": "must-not-leak"
        }


class QuoteServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = create_server(FakeClient(), port=0)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def get(self, path):
        with urlopen(f"http://127.0.0.1:{self.port}{path}", timeout=2) as response:
            return response.status, json.loads(response.read())

    def test_health(self):
        status, payload = self.get("/health")
        self.assertEqual(status, 200)
        self.assertEqual(payload["status"], "ok")

    def test_sanitized_quote(self):
        status, payload = self.get("/quote?symbol=TCS.NS")
        self.assertEqual(status, 200)
        self.assertEqual(payload["symbol"], "TCS")
        self.assertTrue(set(payload).issubset(ALLOWED_FIELDS))
        self.assertNotIn("secret", payload)

    def test_authentication_failure_is_generic(self):
        status, payload = self.get("/quote?symbol=FAIL")
        self.assertEqual(status, 200)
        self.assertEqual(payload["errorMessage"], "Angel One quote connection is unavailable")
        self.assertNotIn("123", json.dumps(payload))

    def test_mapping_failure(self):
        status, payload = self.get("/quote?symbol=UNKNOWN")
        self.assertEqual(status, 200)
        self.assertEqual(payload["errorMessage"], "Quote unavailable for this symbol")

    def test_post_is_rejected(self):
        request = Request(f"http://127.0.0.1:{self.port}/quote", data=b"{}", method="POST")
        with self.assertRaises(HTTPError) as raised:
            urlopen(request, timeout=2)
        self.assertEqual(raised.exception.code, 405)

    def test_market_freshness(self):
        now = datetime(2026, 7, 16, 12, 0, tzinfo=IST)
        current = datetime(2026, 7, 16, 11, 55, tzinfo=IST)
        stale = datetime(2026, 7, 16, 11, 54, 59, tzinfo=IST)
        self.assertEqual(classify_quote(current, now), ("Open", "Current", 300))
        self.assertEqual(classify_quote(stale, now)[1], "Stale")

    def test_official_exchange_timestamp_format(self):
        parsed = parse_quote_timestamp("21-Jun-2023 10:46:10")
        self.assertEqual(parsed.isoformat(), "2023-06-21T10:46:10+05:30")

    def test_market_closed(self):
        now = datetime(2026, 7, 18, 12, 0, tzinfo=IST)
        quote = datetime(2026, 7, 17, 15, 30, tzinfo=IST)
        self.assertEqual(classify_quote(quote, now)[0:2], ("Closed", "Market Closed"))

    def test_symbol_mapping(self):
        item = select_nse_equity("TCS.NS", [{"tradingsymbol": "TCS-EQ", "symboltoken": "11536", "exchange": "NSE"}])
        self.assertEqual(item["token"], "11536")

    def test_credentials_never_in_code_response(self):
        code = (HERE / "angelone_quote_client.py").read_text(encoding="utf-8")
        server = (HERE / "quote_server.py").read_text(encoding="utf-8")
        frontend_root = HERE.parent.parent / "01_Source" / "wealth-suite"
        frontend = "\n".join(
            path.read_text(encoding="utf-8")
            for path in frontend_root.rglob("*") if path.suffix in {".html", ".js"}
        )
        self.assertNotIn("placeOrder", code + server)
        self.assertNotIn("0.0.0.0", code + server)
        self.assertNotIn("ANGEL_API_KEY", frontend)
        self.assertNotIn("ANGEL_TOTP_SECRET", frontend)
        self.assertNotIn("generateSession", frontend)
        self.assertIn("logger.handlers.clear()", code)
        self.assertEqual(HOST, "127.0.0.1")

    def test_incomplete_credentials_rejected(self):
        path = HERE / ".test_credentials.env"
        try:
            path.write_text("ANGEL_" + "API_KEY=only-one-value\n", encoding="utf-8")
            with self.assertRaises(PublicQuoteError):
                load_credentials(path)
        finally:
            path.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
