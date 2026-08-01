#!/usr/bin/env python3
"""
===============================================================================
Personal Wealth Suite Local Application Server
===============================================================================
Lightweight Python local application server (Flask based) for single-user personal use.

Modes:
- Desktop Only: Binds to 127.0.0.1:8000 (localhost only)
- Home Wi-Fi: Binds to 0.0.0.0:8000 (Accessible to desktop & phone on home Wi-Fi)

REST API Endpoints:
- GET  /api/public-prices         -> Returns current validated local market data snapshot
- GET  /api/public-sync-status    -> Returns sync metadata, health status, and failure lists
- POST /api/sync-public-prices    -> Triggers full or targeted public price batch sync
- POST /api/retry-failed-prices   -> Triggers retry for failed tickers only
===============================================================================
"""

import os
import sys
import json
import socket
import argparse
from datetime import datetime

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEALTH_SUITE_DIR = os.path.join(PROJECT_ROOT, "01_Source", "wealth-suite")
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
SNAPSHOT_PATH = os.path.join(DATA_DIR, "public_market_data.json")
SYNC_STATUS_PATH = os.path.join(DATA_DIR, "public_sync_status.json")
PID_PATH = os.path.join(DATA_DIR, "wealth_suite_server.pid")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from validate_market_data import load_current_snapshot
from fetch_public_prices import sync_public_prices

def get_local_ip():
    """Retrieve local LAN IP address for home Wi-Fi access."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

# Import Flask
try:
    from flask import Flask, send_from_directory, request, jsonify
    HAS_FLASK = True
except ImportError:
    HAS_FLASK = False

if HAS_FLASK:
    app = Flask(__name__, static_folder=WEALTH_SUITE_DIR, static_url_path="")

    @app.before_request
    def protect_local_write_endpoints():
        if request.method == "POST" and request.path.startswith("/api/"):
            if not request.is_json:
                return jsonify({"ok": False, "error": "application/json required"}), 415
            origin = request.headers.get("Origin")
            if origin and origin.rstrip("/") != request.host_url.rstrip("/"):
                return jsonify({"ok": False, "error": "cross-origin request rejected"}), 403

    @app.route("/")
    def serve_index():
        return send_from_directory(WEALTH_SUITE_DIR, "index.html")

    @app.route("/<path:path>")
    def serve_static(path):
        return send_from_directory(WEALTH_SUITE_DIR, path)

    @app.route("/api/public-prices", methods=["GET"])
    def get_public_prices():
        snapshot = load_current_snapshot()
        return jsonify({"ok": True, "snapshot": snapshot})

    @app.route("/api/public-sync-status", methods=["GET"])
    def get_public_sync_status():
        status_data = {}
        if os.path.exists(SYNC_STATUS_PATH):
            try:
                with open(SYNC_STATUS_PATH, "r", encoding="utf-8") as f:
                    status_data = json.load(f)
            except Exception:
                pass
        return jsonify({"ok": True, "status": status_data})

    @app.route("/api/sync-public-prices", methods=["POST"])
    def post_sync_public_prices():
        payload = request.get_json(silent=True) or {}
        target_tickers = payload.get("tickers", None)
        try:
            return jsonify(sync_public_prices(target_symbols=target_tickers, retry_failed_only=False))
        except Exception as exc:
            return jsonify({"ok": False, "error": str(exc)}), 500

    @app.route("/api/retry-failed-prices", methods=["POST"])
    def post_retry_failed_prices():
        payload = request.get_json(silent=True) or {}
        target_tickers = payload.get("tickers", None)
        try:
            return jsonify(sync_public_prices(target_symbols=target_tickers, retry_failed_only=True))
        except Exception as exc:
            return jsonify({"ok": False, "error": str(exc)}), 500

def run_flask_server(host, port):
    local_ip = get_local_ip()
    print("=" * 75)
    print("🚀 WEALTH INTELLIGENCE SUITE — PERSONAL APPLICATION SERVER")
    print("=" * 75)
    print(f"💻 Desktop URL:        http://localhost:{port}")
    if host == "0.0.0.0":
        print(f"📱 Mobile Private LAN: http://{local_ip}:{port}")
        print("⚠️ WARNING: Mobile access is intended strictly for your private home Wi-Fi network.")
        print("   Never expose this port to the public internet.")
    else:
        print("🔒 Mode:                Desktop Only (127.0.0.1)")
    print("=" * 75)
    print("✨ 100% Broker-Free Public Data Auto-Sync Enabled")
    print("✨ Zero CSV handling on both Desktop & Mobile\n")
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(PID_PATH, "w", encoding="ascii") as handle:
        handle.write(str(os.getpid()))
    try:
        app.run(host=host, port=port, debug=False)
    finally:
        if os.path.exists(PID_PATH):
            os.remove(PID_PATH)

def build_fallback_handler():
    from http.server import SimpleHTTPRequestHandler
    class FallbackHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=WEALTH_SUITE_DIR, **kwargs)
        def send_json(self, status, payload):
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path == "/api/public-prices":
                self.send_json(200, {"ok": True, "snapshot": load_current_snapshot()})
                return
            if self.path == "/api/public-sync-status":
                try:
                    with open(SYNC_STATUS_PATH, "r", encoding="utf-8") as handle:
                        status_data = json.load(handle)
                except Exception:
                    status_data = {}
                self.send_json(200, {"ok": True, "status": status_data})
                return
            super().do_GET()

        def do_POST(self):
            if self.path in ("/api/sync-public-prices", "/api/retry-failed-prices"):
                if self.headers.get_content_type() != "application/json":
                    self.send_json(415, {"ok": False, "error": "application/json required"})
                    return
                origin = self.headers.get("Origin")
                expected_origin = f"http://{self.headers.get('Host')}"
                if origin and origin.rstrip("/") != expected_origin.rstrip("/"):
                    self.send_json(403, {"ok": False, "error": "cross-origin request rejected"})
                    return
                try:
                    length = int(self.headers.get("Content-Length", "0"))
                    payload = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
                    tickers = payload.get("tickers")
                    result = sync_public_prices(
                        target_symbols=tickers,
                        retry_failed_only=self.path.endswith("retry-failed-prices"),
                    )
                    self.send_json(200, result)
                except Exception as exc:
                    self.send_json(500, {"ok": False, "error": str(exc)})
                return
            self.send_json(404, {"ok": False, "error": "not found"})

    return FallbackHandler

def run_fallback_http_server(host, port):
    from http.server import ThreadingHTTPServer

    os.chdir(WEALTH_SUITE_DIR)
    local_ip = get_local_ip()
    server_address = (host, port)
    httpd = ThreadingHTTPServer(server_address, build_fallback_handler())
    print(f"Server running on {host}:{port}...")
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(PID_PATH, "w", encoding="ascii") as handle:
        handle.write(str(os.getpid()))
    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()
        if os.path.exists(PID_PATH):
            os.remove(PID_PATH)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Wealth Suite Personal Application Server")
    parser.add_argument("--mode", choices=["desktop-only", "home-wifi"], default="desktop-only", help="Server mode")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on")
    args = parser.parse_args()

    host = "127.0.0.1" if args.mode == "desktop-only" else "0.0.0.0"
    if HAS_FLASK:
        run_flask_server(host, args.port)
    else:
        run_fallback_http_server(host, args.port)
