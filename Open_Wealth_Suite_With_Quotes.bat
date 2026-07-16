@echo off
setlocal
set "ROOT=%~dp0"
set "SERVICE=%ROOT%10_Integrations\AngelOneQuotes\Start_Quote_Service.bat"
set "APP=%ROOT%Open_Wealth_Intelligence_Suite.bat"

call "%SERVICE%"
if errorlevel 1 (
  echo Quote service startup failed. The normal offline suite can still be opened.
  pause
  exit /b 1
)

set "READY="
for /l %%I in (1,1,15) do (
  powershell -NoProfile -Command "try {(Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8765/health' -TimeoutSec 1).StatusCode -eq 200 | Out-Null; exit 0} catch {exit 1}"
  if not errorlevel 1 set "READY=1"
  if defined READY goto :OPEN
  timeout /t 1 /nobreak >nul
)

echo Quote service did not become ready within 15 seconds.
echo You may use the normal offline launcher and Manual Price fallback.
pause
exit /b 1

:OPEN
call "%APP%"
endlocal
