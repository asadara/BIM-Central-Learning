@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"
if not exist "logs" mkdir "logs"

set "LEGACY_PROXY_PORT=5051"
set "LEGACY_PROXY_TARGET_PORT=%BCL_BACKEND_PORT%"
if not defined LEGACY_PROXY_TARGET_PORT set "LEGACY_PROXY_TARGET_PORT=5052"
for /f "usebackq delims=" %%t in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Date -Format yyyyMMdd-HHmmss-fff"`) do set "LEGACY_PROXY_LOGSTAMP=%%t"
if not defined LEGACY_PROXY_LOGSTAMP set "LEGACY_PROXY_LOGSTAMP=%RANDOM%"
set "LEGACY_PROXY_LOGFILE=logs\legacy-5051-proxy-%LEGACY_PROXY_LOGSTAMP%.log"
set "LEGACY_PROXY_ERR_LOGFILE=logs\legacy-5051-proxy-%LEGACY_PROXY_LOGSTAMP%.err.log"

curl.exe -s http://127.0.0.1:%LEGACY_PROXY_PORT%/ping -m 3 >nul 2>&1
if not errorlevel 1 exit /b 0

netstat -ano | findstr ":%LEGACY_PROXY_PORT%.*LISTENING" >nul
if not errorlevel 1 exit /b 0

powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:LEGACY_PROXY_PORT='%LEGACY_PROXY_PORT%'; $env:LEGACY_PROXY_TARGET_PORT='%LEGACY_PROXY_TARGET_PORT%'; Start-Process -WindowStyle Hidden -WorkingDirectory '%~dp0backend' -FilePath 'node.exe' -ArgumentList 'legacy-port-proxy.js' -RedirectStandardOutput '%~dp0%LEGACY_PROXY_LOGFILE%' -RedirectStandardError '%~dp0%LEGACY_PROXY_ERR_LOGFILE%'"
if errorlevel 1 exit /b 1

exit /b 0
