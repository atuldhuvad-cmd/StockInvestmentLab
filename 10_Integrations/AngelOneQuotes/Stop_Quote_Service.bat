@echo off
setlocal
set "PIDFILE=%~dp0.quote_service.pid"
if not exist "%PIDFILE%" (
  echo Quote service PID file was not found.
  exit /b 0
)
for /f "usebackq delims=" %%P in ("%PIDFILE%") do set "SERVICE_PID=%%P"
powershell -NoProfile -Command "$p=Get-Process -Id %SERVICE_PID% -ErrorAction SilentlyContinue; if($p){Stop-Process -Id $p.Id}"
del /q "%PIDFILE%"
echo Quote service stopped.
endlocal
