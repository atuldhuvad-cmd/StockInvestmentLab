"""NSE cash-equity symbol normalization and SmartAPI search-result selection."""

import re


def normalize_symbol(value):
    symbol = str(value or "").strip().upper()
    if symbol.startswith("NSE:"):
        symbol = symbol[4:]
    if symbol.endswith(".NS"):
        symbol = symbol[:-3]
    if not re.fullmatch(r"[A-Z0-9&.-]{1,30}", symbol):
        raise ValueError("Quote unavailable for this symbol")
    return symbol


def select_nse_equity(symbol, records):
    normalized = normalize_symbol(symbol)
    candidates = [item for item in (records or []) if isinstance(item, dict)]
    for expected in (normalized + "-EQ", normalized):
        for item in candidates:
            trading_symbol = str(item.get("tradingsymbol") or item.get("symbol") or "").upper()
            exchange = str(item.get("exchange") or item.get("exch_seg") or "NSE").upper()
            token = item.get("symboltoken") or item.get("token")
            if trading_symbol == expected and exchange in ("NSE", "NSE_CM") and token:
                return {"symbol": normalized, "tradingSymbol": trading_symbol, "token": str(token)}
    raise LookupError("Quote unavailable for this symbol")
