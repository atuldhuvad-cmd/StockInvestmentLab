@echo off
title Wealth Intelligence Suite — Desktop Only Mode
cls

echo ===============================================================================
echo   WEALTH INTELLIGENCE SUITE — DESKTOP ONLY MODE (127.0.0.1)
echo ===============================================================================
echo.
echo   1. Binds strictly to localhost (127.0.0.1:8000).
echo   2. Public Market Data Auto-Sync Enabled (Yahoo Finance).
echo   3. ZERO Broker Logins, ZERO API Keys, ZERO Secrets needed.
echo.
echo ===============================================================================

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python 3 is not installed or not in PATH.
    echo Please install Python 3 from https://www.python.org/
    pause
    exit /b 1
)

echo Starting Desktop-Only Server on http://127.0.0.1:8000 ...
start http://localhost:8000
python scripts\serve_wealth_suite.py --mode desktop-only --port 8000

pause
