"""Local, read-only HTTP bridge from the file-based UI to Angel One quotes."""

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from angelone_quote_client import AngelOneQuoteClient, PublicQuoteError

HOST = "127.0.0.1"
PORT = 8765
HERE = Path(__file__).resolve().parent
CREDENTIAL_FILE = HERE / "angelone_credentials.env"
ALLOWED_FIELDS = {
    "symbol", "exchange", "price", "quoteTimestamp", "source",
    "marketStatus", "dataAgeSeconds", "status", "errorMessage"
}


def sanitized(payload):
    return {key: payload.get(key) for key in ALLOWED_FIELDS if key in payload}


def make_handler(client):
    class QuoteHandler(BaseHTTPRequestHandler):
        server_version = "WealthQuoteHelper/1.0"

        def log_message(self, fmt, *args):
            # No query strings, credentials, tokens, or broker response bodies are logged.
            print("quote-helper:", self.command, urlparse(self.path).path)

        def _json(self, code, payload):
            body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "null")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            parsed = urlparse(self.path)
            if parsed.path == "/health":
                self._json(200, {"status": "ok", "source": "local-read-only-quote-helper"})
                return
            if parsed.path != "/quote":
                self._json(404, {"status": "Unavailable", "errorMessage": "Endpoint not found"})
                return
            symbol = parse_qs(parsed.query).get("symbol", [""])[0]
            try:
                self._json(200, sanitized(client.get_quote(symbol)))
            except (PublicQuoteError, ValueError) as error:
                if not symbol:
                    message = "Symbol is required"
                elif str(error) == "Quote unavailable for this symbol":
                    message = str(error)
                else:
                    message = "Angel One quote connection is unavailable"
                self._json(200 if symbol else 400, {
                    "symbol": str(symbol).upper(), "status": "Unavailable", "errorMessage": message
                })

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "null")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

        def do_POST(self):
            self._json(405, {"status": "Unavailable", "errorMessage": "Read-only service: GET only"})

    return QuoteHandler


def create_server(client=None, port=PORT):
    quote_client = client or AngelOneQuoteClient(CREDENTIAL_FILE)
    return ThreadingHTTPServer((HOST, port), make_handler(quote_client))


if __name__ == "__main__":
    selected_port = int(os.environ.get("ANGEL_QUOTE_PORT", PORT))
    server = create_server(port=selected_port)
    print(f"Read-only quote helper listening on http://{HOST}:{selected_port}")
    server.serve_forever()
