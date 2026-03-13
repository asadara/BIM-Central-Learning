@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

cd /d "%~dp0"
if not exist "logs" mkdir "logs"

set "TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"
set "LOGFILE=logs\stop-%TIMESTAMP%.log"
set "BACKEND_PORT=%BCL_BACKEND_PORT%"
if not defined BACKEND_PORT set "BACKEND_PORT=5052"

set "KEEP_OPEN=0"
for %%A in (%*) do (
    if /I "%%~A"=="--manual" set "KEEP_OPEN=1"
    if /I "%%~A"=="--keep-open" set "KEEP_OPEN=1"
)

call :log "================================================================================"
call :log "                   BCL PHASE 4 ENTERPRISE - STOP SERVER"
call :log "================================================================================"
call :log "[BOOT] Stop script initiated at %DATE% %TIME%"
call :log "[INFO] Working directory: %CD%"

set "STOP_ERRORS=0"

call :stop_nginx
call :stop_backend
call :stop_postgres

if exist "runlock" (
    rmdir "runlock" >nul 2>&1
    call :log "[INFO] Removed stale runlock directory"
)

call :log "[INFO] Final port verification..."
netstat -ano | findstr ":80.*LISTENING" >nul
if not errorlevel 1 (
    call :log "[WARNING] Port 80 still listening after stop attempt"
)
netstat -ano | findstr ":%BACKEND_PORT%.*LISTENING" >nul
if not errorlevel 1 (
    call :log "[WARNING] Port %BACKEND_PORT% still listening after stop attempt"
)

if "%STOP_ERRORS%"=="0" (
    call :log "[SUCCESS] Stop sequence completed"
) else (
    call :log "[WARNING] Stop sequence completed with %STOP_ERRORS% warning(s)"
)

if "%KEEP_OPEN%"=="1" (
    echo.
    pause
)

exit /b %STOP_ERRORS%

:stop_nginx
call :log "[STEP] Stopping Nginx..."
set "NGINX_DIR=%~dp0nginx\nginx-1.28.0"
set "NGINX_EXE=%NGINX_DIR%\nginx.exe"

if exist "%NGINX_EXE%" (
    "%NGINX_EXE%" -s quit -p "%NGINX_DIR%" -c "conf\nginx.conf" >nul 2>&1
)
call :sleep 2
taskkill /f /im nginx.exe /t >nul 2>&1
if errorlevel 1 (
    call :log "[INFO] No active nginx.exe process found"
) else (
    call :log "[OK] Nginx processes stopped"
)
exit /b 0

:stop_backend
call :log "[STEP] Stopping backend on port %BACKEND_PORT%..."
set "BACKEND_KILLED=0"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%BACKEND_PORT%.*LISTENING"') do (
    taskkill /PID %%p /F >nul 2>&1
    if not errorlevel 1 (
        set "BACKEND_KILLED=1"
        call :log "[OK] Killed backend listener PID %%p"
    ) else (
        wmic process where "ProcessId=%%p" call terminate >nul 2>&1
        if not errorlevel 1 (
            set "BACKEND_KILLED=1"
            call :log "[OK] Killed backend listener PID %%p via WMIC fallback"
        ) else (
            call :log "[WARNING] Failed to terminate backend listener PID %%p (access denied or already exited)"
        )
    )
)

for /f "tokens=2 delims== " %%p in ('wmic process where "name='node.exe' and CommandLine like '%%backend\\server.js%%'" get ProcessId /value 2^>nul ^| findstr /I "ProcessId="') do (
    if not "%%p"=="" (
        taskkill /PID %%p /F >nul 2>&1
        if not errorlevel 1 (
            set "BACKEND_KILLED=1"
            call :log "[OK] Killed backend Node.js PID %%p by command line match"
        ) else (
            wmic process where "ProcessId=%%p" call terminate >nul 2>&1
            if not errorlevel 1 (
                set "BACKEND_KILLED=1"
                call :log "[OK] Killed backend Node.js PID %%p by WMIC command line fallback"
            )
        )
    )
)

if "%BACKEND_KILLED%"=="0" (
    call :log "[INFO] No active backend process found"
)
exit /b 0

:stop_postgres
call :detect_native_postgres_service
if defined NATIVE_PG_SERVICE (
    call :log "[STEP] Native PostgreSQL service detected (%NATIVE_PG_SERVICE%) - leaving database service running"
    exit /b 0
)

call :log "[WARNING] Native PostgreSQL service not found; no database stop action was performed"
set /a STOP_ERRORS+=1
exit /b 0

:detect_native_postgres_service
set "NATIVE_PG_SERVICE="
for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$svc = Get-Service | Where-Object { $_.Name -like 'postgresql*' -or $_.DisplayName -like 'PostgreSQL*' } | Sort-Object Name | Select-Object -First 1 -ExpandProperty Name; if ($svc) { Write-Output $svc }"`) do set "NATIVE_PG_SERVICE=%%i"
exit /b 0

:sleep
set "SLEEP_SECS=%~1"
if not defined SLEEP_SECS set "SLEEP_SECS=1"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds %SLEEP_SECS%" >nul 2>&1
if errorlevel 1 (
    set /a SLEEP_PINGS=%SLEEP_SECS%+1
    ping 127.0.0.1 -n !SLEEP_PINGS! >nul
)
exit /b 0

:log
set "MSG=%~1"
echo %MSG%
>> "%LOGFILE%" echo [%DATE% %TIME%] %MSG%
exit /b 0
