@echo off
title Stop Wealth Intelligence Suite Server
cls

echo Stopping the Wealth Intelligence Suite server...
if not exist data\wealth_suite_server.pid (
    echo No server PID file found. The server may already be stopped.
    goto done
)

set /p WEALTH_SERVER_PID=<data\wealth_suite_server.pid
taskkill /PID %WEALTH_SERVER_PID% /F >nul 2>&1
if errorlevel 1 (
    echo Server process %WEALTH_SERVER_PID% was not running.
) else (
    echo Server process %WEALTH_SERVER_PID% stopped.
)
del /q data\wealth_suite_server.pid >nul 2>&1

:done
echo.
echo Server stop check complete.
echo.
pause
