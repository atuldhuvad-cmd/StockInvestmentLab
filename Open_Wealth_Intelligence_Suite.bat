@echo off
setlocal
set "APP=%~dp001_Source\wealth-suite\index.html"

if not exist "%APP%" (
  echo Wealth Intelligence Suite was not found:
  echo %APP%
  pause
  exit /b 1
)

start "" "%APP%"
endlocal
