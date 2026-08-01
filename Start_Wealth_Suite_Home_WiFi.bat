@echo off
title Wealth Intelligence Suite — Home Wi-Fi Desktop & Mobile Server
cls

echo ===============================================================================
echo   WEALTH INTELLIGENCE SUITE — HOME WI-FI DESKTOP & MOBILE SERVER
echo ===============================================================================
echo.
echo   💻 Desktop URL:        http://localhost:8000
echo   📱 Mobile Private LAN: http://[Your-Home-Wi-Fi-IP]:8000
echo.
echo   ⚠️ WARNING: Access is intended ONLY for your trusted private home Wi-Fi.
echo      Never expose this server port to the public internet.
echo.
echo   1. 100% Broker-Free Public Data Auto-Sync (Yahoo Finance).
echo   2. Zero CSV downloads or uploads on Mobile or Desktop!
echo.
echo ===============================================================================

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python 3 is not installed or not in PATH.
    echo Please install Python 3 from https://www.python.org/
    pause
    exit /b 1
)

echo Starting Home Wi-Fi Server on port 8000 ...
start http://localhost:8000
python scripts\serve_wealth_suite.py --mode home-wifi --port 8000

pause
