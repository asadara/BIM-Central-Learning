@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"

if not exist "%~dp0start-bcl-http-hidden.bat" exit /b 1

curl.exe -s http://127.0.0.1/api/server/status -m 5 >nul 2>&1
if not errorlevel 1 goto :user_readiness_check

set "NATIVE_PG_SERVICE="
for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$svc = Get-Service | Where-Object { $_.Name -like 'postgresql*' -or $_.DisplayName -like 'PostgreSQL*' } | Sort-Object Name | Select-Object -First 1 -ExpandProperty Name; if ($svc) { Write-Output $svc }"`) do set "NATIVE_PG_SERVICE=%%i"

if not defined NATIVE_PG_SERVICE (
    exit /b 1
)

for /l %%i in (1,1,120) do (
    if not exist "runlock" goto :start_now

    curl.exe -s http://127.0.0.1/api/server/status -m 5 >nul 2>&1
    if not errorlevel 1 goto :user_readiness_check

    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 2" >nul 2>&1
)

if exist "runlock" rmdir /s /q "runlock" >nul 2>&1

:start_now
call "%~dp0start-bcl-http-hidden.bat"
exit /b %errorlevel%

:user_readiness_check
call :wait_for_pc_bim02_audit_unc
if exist "%~dp0watchdog-bcl.bat" (
    call "%~dp0watchdog-bcl.bat" >nul 2>&1
)
exit /b 0

:wait_for_pc_bim02_audit_unc
for /l %%i in (1,1,24) do (
    node -e "process.exit(require('fs').existsSync('\\\\pc-bim02\\Dokumen Audit 2026') ? 0 : 1)" >nul 2>nul
    if not errorlevel 1 exit /b 0
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 5" >nul 2>&1
)
exit /b 0
