"""Read-only Angel One SmartAPI quote adapter. No trading methods are exposed."""

from datetime import datetime, time, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from instrument_mapping import normalize_symbol, select_nse_equity

IST = ZoneInfo("Asia/Kolkata")
SOURCE = "Angel One SmartAPI"


class PublicQuoteError(Exception):
    """An intentionally sanitized message safe to return to the local browser."""


def load_credentials(path):
    values = {}
    for raw_line in Path(path).read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    required = ("ANGEL_API_KEY", "ANGEL_CLIENT_CODE", "ANGEL_PIN", "ANGEL_TOTP_SECRET")
    if any(not values.get(key) for key in required):
        raise PublicQuoteError("Quote service credentials are not configured")
    return {key: values[key] for key in required}


def parse_quote_timestamp(value):
    if isinstance(value, (int, float)):
        seconds = value / 1000 if value > 10_000_000_000 else value
        return datetime.fromtimestamp(seconds, tz=timezone.utc).astimezone(IST)
    text = str(value or "").strip()
    if not text:
        raise PublicQuoteError("Quote did not include an exchange timestamp")
    if text.isdigit():
        return parse_quote_timestamp(int(text))
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as error:
        try:
            parsed = datetime.strptime(text, "%d-%b-%Y %H:%M:%S").replace(tzinfo=IST)
        except ValueError:
            raise PublicQuoteError("Quote did not include a valid exchange timestamp") from error
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=IST)
    return parsed.astimezone(IST)


def is_market_hours(moment):
    local = moment.astimezone(IST)
    return local.weekday() < 5 and time(9, 15) <= local.time().replace(tzinfo=None) <= time(15, 30)


def classify_quote(quote_timestamp, now=None):
    now = (now or datetime.now(IST)).astimezone(IST)
    timestamp = quote_timestamp.astimezone(IST)
    age = max(0, int((now - timestamp).total_seconds()))
    if is_market_hours(now):
        status = "Current" if age <= 300 else "Stale"
        market_status = "Open"
    else:
        status = "Market Closed"
        market_status = "Closed"
    return market_status, status, age


class AngelOneQuoteClient:
    def __init__(self, credential_path):
        self.credential_path = credential_path
        self._api = None
        self._symbol_cache = {}

    def _connect(self):
        if self._api is not None:
            return self._api
        try:
            import logging
            from logzero import logger
            from SmartApi import SmartConnect
            import pyotp
            credentials = load_credentials(self.credential_path)
            # The official SDK configures its own error file and can include
            # request headers in errors. Disable those handlers before any
            # authenticated call; this helper returns sanitized errors only.
            logger.handlers.clear()
            logger.addHandler(logging.NullHandler())
            api = SmartConnect(credentials["ANGEL_API_KEY"])
            logger.handlers.clear()
            logger.addHandler(logging.NullHandler())
            session = api.generateSession(
                credentials["ANGEL_CLIENT_CODE"], credentials["ANGEL_PIN"],
                pyotp.TOTP(credentials["ANGEL_TOTP_SECRET"]).now()
            )
            if not session or session.get("status") is False:
                raise PublicQuoteError("Angel One authentication is unavailable")
            self._api = api
            return api
        except PublicQuoteError:
            raise
        except (ImportError, ModuleNotFoundError) as error:
            raise PublicQuoteError("Quote service dependencies are not installed") from error
        except Exception as error:
            raise PublicQuoteError("Angel One authentication is unavailable") from error

    def _instrument(self, symbol):
        if symbol in self._symbol_cache:
            return self._symbol_cache[symbol]
        try:
            response = self._connect().searchScrip("NSE", symbol)
            records = response.get("data") if isinstance(response, dict) else None
            instrument = select_nse_equity(symbol, records)
        except (LookupError, ValueError) as error:
            raise PublicQuoteError("Quote unavailable for this symbol") from error
        except PublicQuoteError:
            raise
        except Exception as error:
            raise PublicQuoteError("Quote unavailable for this symbol") from error
        self._symbol_cache[symbol] = instrument
        return instrument

    def get_quote(self, raw_symbol, now=None):
        symbol = normalize_symbol(raw_symbol)
        instrument = self._instrument(symbol)
        try:
            response = self._connect().getMarketData("FULL", {"NSE": [instrument["token"]]})
            data = response.get("data") if isinstance(response, dict) else None
            fetched = data.get("fetched") if isinstance(data, dict) else None
            quote = fetched[0] if isinstance(fetched, list) and fetched else None
            if not isinstance(quote, dict):
                raise PublicQuoteError("Quote is temporarily unavailable")
            price = quote.get("ltp")
            if not isinstance(price, (int, float)) or price <= 0:
                raise PublicQuoteError("Quote is temporarily unavailable")
            timestamp = parse_quote_timestamp(
                quote.get("exchFeedTime") or quote.get("exchTradeTime")
            )
            market_status, status, age = classify_quote(timestamp, now)
            return {
                "symbol": symbol,
                "exchange": "NSE",
                "price": price,
                "quoteTimestamp": timestamp.isoformat(),
                "source": SOURCE,
                "marketStatus": market_status,
                "dataAgeSeconds": age,
                "status": status,
                "errorMessage": None,
            }
        except PublicQuoteError:
            raise
        except Exception as error:
            self._api = None
            raise PublicQuoteError("Angel One quote connection is unavailable") from error
