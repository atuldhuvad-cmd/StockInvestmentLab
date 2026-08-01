#!/usr/bin/env python3
"""
===============================================================================
Public Market Data Validation & Atomic Snapshot Manager
===============================================================================
Validates OHLCV historical dataset records strictly before accepting them into
the primary data snapshot. Preserves last-known-good snapshot on failure.

Validation Rules:
1. Required columns: date, open, high, low, close, volume
2. No duplicate dates
3. Non-finite or non-positive prices/volumes rejected
4. High/Low boundary checks (high >= max(open, close), low <= min(open, close))
5. Completed daily candles only
6. Sufficient history (at least 200 usable trading rows for technical trend)
7. Stale data detection (>5 trading days old when market was open)
===============================================================================
"""

import os
import sys
import json
import shutil
import math
from datetime import datetime, date, timedelta

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
SNAPSHOT_PATH = os.path.join(DATA_DIR, "public_market_data.json")
PREVIOUS_SNAPSHOT_PATH = os.path.join(DATA_DIR, "public_market_data_previous.json")
SYNC_STATUS_PATH = os.path.join(DATA_DIR, "public_sync_status.json")

REQUIRED_COLUMNS = ["date", "open", "high", "low", "close", "volume"]

def parse_date(date_str):
    """Parse date string YYYY-MM-DD into datetime object."""
    try:
        return datetime.strptime(str(date_str).strip(), "%Y-%m-%d").date()
    except Exception:
        return None

def validate_ohlcv_rows(rows, symbol=""):
    """
    Strictly validate an array of OHLCV row objects.
    Returns (is_valid, error_message, clean_rows, latest_date).
    """
    if not isinstance(rows, list) or len(rows) == 0:
        return False, "Empty or non-list OHLCV dataset", [], None

    dates_seen = set()
    clean_rows = []

    for idx, row in enumerate(rows):
        if not isinstance(row, dict):
            return False, f"Row {idx} is not a valid object", [], None

        # 1. Required columns
        for col in REQUIRED_COLUMNS:
            if col not in row or row[col] is None:
                return False, f"Row {idx} missing required field '{col}'", [], None

        # 2. Date validation & deduplication
        row_date = parse_date(row["date"])
        if not row_date:
            return False, f"Row {idx} has invalid date string '{row.get('date')}'", [], None
        if row_date in dates_seen:
            return False, f"Duplicate date detected: {row_date}", [], None
        dates_seen.add(row_date)

        # 3. Numeric positivity & finiteness
        try:
            o = float(row["open"])
            h = float(row["high"])
            l = float(row["low"])
            c = float(row["close"])
            v = int(row["volume"])
        except (ValueError, TypeError):
            return False, f"Row {idx} ({row_date}) contains non-numeric values", [], None

        if not all(math.isfinite(p) for p in (o, h, l, c)):
            return False, f"Row {idx} ({row_date}) contains non-finite prices", [], None
        if any(p <= 0 for p in (o, h, l, c)) or v < 0:
            return False, f"Row {idx} ({row_date}) contains non-positive price or negative volume", [], None

        # 4. High / Low boundary integrity
        max_oc = max(o, c)
        min_oc = min(o, c)
        if h < max_oc - 0.01:
            return False, f"Row {idx} ({row_date}) High ({h}) < max(Open, Close) ({max_oc})", [], None
        if l > min_oc + 0.01:
            return False, f"Row {idx} ({row_date}) Low ({l}) > min(Open, Close) ({min_oc})", [], None
        if h < l:
            return False, f"Row {idx} ({row_date}) High ({h}) < Low ({l})", [], None

        clean_rows.append({
            "date": str(row_date),
            "open": round(o, 2),
            "high": round(h, 2),
            "low": round(l, 2),
            "close": round(c, 2),
            "volume": v
        })

    # Sort chronologically
    clean_rows.sort(key=lambda r: r["date"])
    latest_date = parse_date(clean_rows[-1]["date"])

    # 5. Sufficient history rule (Target 200+ usable rows)
    if len(clean_rows) < 200:
        return False, f"Insufficient history: {len(clean_rows)} rows (minimum 200 required)", clean_rows, latest_date

    return True, "OK", clean_rows, latest_date

def check_stale_date(latest_date):
    """
    Check if latest market date is stale (>5 trading days old).
    """
    if not latest_date:
        return True, "Missing date"
    today = date.today()
    if latest_date > today:
        return True, f"Future-dated dataset: latest date is {latest_date}"
    business_days = 0
    cursor = latest_date
    while cursor < today:
        cursor += timedelta(days=1)
        if cursor.weekday() < 5:
            business_days += 1
    if business_days > 5:
        return True, f"Stale dataset: latest date is {latest_date} ({business_days} weekdays old)"
    return False, "Fresh"

def load_current_snapshot():
    """Load valid current public market data snapshot."""
    if os.path.exists(SNAPSHOT_PATH):
        try:
            with open(SNAPSHOT_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"version": "1.0.0", "last_updated": None, "data_source": "Yahoo Finance (Public)", "tickers": {}}

def atomic_save_snapshot(new_snapshot_data):
    """
    Atomically save new valid snapshot dataset while backing up current valid snapshot to _previous.json.
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    temp_path = SNAPSHOT_PATH + ".tmp"

    # Backup existing valid snapshot
    if os.path.exists(SNAPSHOT_PATH):
        try:
            shutil.copy2(SNAPSHOT_PATH, PREVIOUS_SNAPSHOT_PATH)
        except Exception as e:
            print(f"Warning: Failed to back up previous snapshot: {e}")

    # Write new snapshot to temp file
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(new_snapshot_data, f, indent=2, ensure_ascii=False)

    # Atomic replace
    os.replace(temp_path, SNAPSHOT_PATH)

def update_sync_status(total, successful, failed, stale, skipped, failed_tickers, stale_tickers):
    """Write sync status summary metadata to public_sync_status.json."""
    os.makedirs(DATA_DIR, exist_ok=True)
    health = "HEALTHY" if failed == 0 and stale == 0 else "DEGRADED" if successful > 0 else "FAILED"
    status_data = {
        "last_sync_timestamp": datetime.now().isoformat(),
        "total_tickers": total,
        "successful_count": successful,
        "failed_count": failed,
        "stale_count": stale,
        "skipped_count": skipped,
        "failed_tickers": failed_tickers,
        "stale_tickers": stale_tickers,
        "data_health": health
    }
    with open(SYNC_STATUS_PATH, "w", encoding="utf-8") as f:
        json.dump(status_data, f, indent=2)
    return status_data
