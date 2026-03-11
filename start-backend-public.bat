@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"
if not exist "logs" mkdir "logs"

set "BACKEND_PORT=%BCL_BACKEND_PORT%"
if not defined BACKEND_PORT set "BACKEND_PORT=5052"
set "BACKEND_LOGFILE=logs\backend-public-%BACKEND_PORT%.log"
set "BACKEND_ERR_LOGFILE=logs\backend-public-%BACKEND_PORT%.err.log"

if not exist "backend\server.js" exit /b 1

curl.exe -s http://127.0.0.1:%BACKEND_PORT%/ping -m 5 >nul 2>&1
if not errorlevel 1 goto ensure_legacy_proxy

netstat -ano | findstr ":%BACKEND_PORT%.*LISTENING" >nul
if not errorlevel 1 goto ensure_legacy_proxy

powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:HTTP_PORT='%BACKEND_PORT%'; Start-Process -WindowStyle Hidden -WorkingDirectory '%~dp0backend' -FilePath 'node.exe' -ArgumentList 'server.js' -RedirectStandardOutput '%~dp0%BACKEND_LOGFILE%' -RedirectStandardError '%~dp0%BACKEND_ERR_LOGFILE%'"
if errorlevel 1 exit /b 1

:ensure_legacy_proxy
call "%~dp0start-legacy-5051-proxy.bat" >nul 2>&1

exit /b 0
