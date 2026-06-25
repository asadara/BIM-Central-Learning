@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"
if not exist "logs" mkdir "logs"

set "BACKEND_PORT=%BCL_BACKEND_PORT%"
if not defined BACKEND_PORT set "BACKEND_PORT=5052"
for /f "usebackq delims=" %%t in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Date -Format yyyyMMdd-HHmmss-fff"`) do set "BACKEND_LOGSTAMP=%%t"
if not defined BACKEND_LOGSTAMP set "BACKEND_LOGSTAMP=%RANDOM%"
set "BACKEND_LOGFILE=logs\backend-public-%BACKEND_PORT%-%BACKEND_LOGSTAMP%.log"
set "BACKEND_ERR_LOGFILE=logs\backend-public-%BACKEND_PORT%-%BACKEND_LOGSTAMP%.err.log"
set "BACKEND_RECYCLED=0"

if not exist "backend\server.js" exit /b 1

curl.exe -s http://127.0.0.1:%BACKEND_PORT%/ping -m 5 >nul 2>&1
if not errorlevel 1 (
    if /I not "%USERNAME%"=="SYSTEM" call :recycle_stale_audit_backend
    if "!BACKEND_RECYCLED!"=="0" goto ensure_legacy_proxy
)

netstat -ano | findstr ":%BACKEND_PORT%.*LISTENING" >nul
if not errorlevel 1 (
    if /I not "%USERNAME%"=="SYSTEM" call :recycle_stale_audit_backend
    if "!BACKEND_RECYCLED!"=="0" goto ensure_legacy_proxy
)

if /I not "%USERNAME%"=="SYSTEM" (
    call :wait_for_pc_bim02_audit_unc
)

:start_backend
powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:HTTP_PORT='%BACKEND_PORT%'; Start-Process -WindowStyle Hidden -WorkingDirectory '%~dp0backend' -FilePath 'node.exe' -ArgumentList 'server.js' -RedirectStandardOutput '%~dp0%BACKEND_LOGFILE%' -RedirectStandardError '%~dp0%BACKEND_ERR_LOGFILE%'"
if errorlevel 1 exit /b 1

:ensure_legacy_proxy
call "%~dp0start-legacy-5051-proxy.bat" >nul 2>&1

exit /b 0

:wait_for_pc_bim02_audit_unc
for /l %%i in (1,1,24) do (
    node -e "process.exit(require('fs').existsSync('\\\\pc-bim02\\Dokumen Audit 2026') ? 0 : 1)" >nul 2>nul
    if not errorlevel 1 exit /b 0
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 5" >nul 2>&1
)
exit /b 0

:recycle_stale_audit_backend
node -e "process.exit(require('fs').existsSync('\\\\pc-bim02\\Dokumen Audit 2026') ? 0 : 1)" >nul 2>nul
if errorlevel 1 exit /b 0

node -e "fetch('http://127.0.0.1:%BACKEND_PORT%/api/audit-2026/status').then(r=>r.json()).then(j=>process.exit(j && j.rootExists ? 0 : 1)).catch(()=>process.exit(1))" >nul 2>nul
if not errorlevel 1 exit /b 0

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%BACKEND_PORT%.*LISTENING"') do (
    taskkill /PID %%p /F >nul 2>&1
    if errorlevel 1 (
        wmic process where "ProcessId=%%p" call terminate >nul 2>&1
    )
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 3" >nul 2>&1
set "BACKEND_RECYCLED=1"
exit /b 0
