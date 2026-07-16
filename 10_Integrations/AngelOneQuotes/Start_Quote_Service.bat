@echo off
setlocal
set "HERE=%~dp0"
set "PYTHON=%HERE%.venv\Scripts\python.exe"
if not exist "%PYTHON%" set "PYTHON=python"

if not exist "%HERE%angelone_credentials.env" (
  echo Missing local credentials: %HERE%angelone_credentials.env
  echo Copy angelone_credentials.example.env and fill it locally.
  exit /b 1
)

powershell -NoProfile -Command "$p=Start-Process -FilePath '%PYTHON%' -ArgumentList 'quote_server.py' -WorkingDirectory '%HERE%' -WindowStyle Hidden -PassThru; Set-Content -LiteralPath '%HERE%.quote_service.pid' -Value $p.Id"
if errorlevel 1 exit /b 1
echo Read-only quote service started on 127.0.0.1:8765
endlocal
