@echo off
setlocal
set "TARGET=%~dp0BC-Learning-Main\bcl-install-cert.bat"
if not exist "%TARGET%" (
  echo [ERROR] File not found: %TARGET%
  pause
  exit /b 1
)
call "%TARGET%"
endlocal
