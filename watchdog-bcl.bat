@echo off
setlocal EnableDelayedExpansion
set "RUN_AS_SYSTEM=0"
if /I "%USERNAME%"=="SYSTEM" set "RUN_AS_SYSTEM=1"
set "NATIVE_PG_SERVICE="
set "BACKEND_PORT=%BCL_BACKEND_PORT%"
if not defined BACKEND_PORT set "BACKEND_PORT=5052"

cd /d "%~dp0"
if not exist "logs" mkdir "logs"

set "DATESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%"
set "LOGFILE=logs\watchdog-%DATESTAMP%.log"
set "LOCKDIR=watchdog.lock"
set "FORCE_BACKEND_RELOAD_FLAG=force-backend-reload.flag"

if exist "%LOCKDIR%" rmdir "%LOCKDIR%" >nul 2>&1
if exist "%LOCKDIR%" del /f /q "%LOCKDIR%" >nul 2>&1
mkdir "%LOCKDIR%" 2>nul
if errorlevel 1 exit /b 0

if exist "%FORCE_BACKEND_RELOAD_FLAG%" (
    call :log "[WARNING] Forced backend recycle requested via %FORCE_BACKEND_RELOAD_FLAG%"
    del /f /q "%FORCE_BACKEND_RELOAD_FLAG%" >nul 2>&1
    call :recycle_backend
    goto :end
)

set "HTTP_OK=0"
set "BACKEND_OK=0"
set "DB_OK=0"
set "HTTP_CODE=000"
set "BACKEND_CODE=000"

for /f %%c in ('curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1/ 2^>nul') do set "HTTP_CODE=%%c"
if "%HTTP_CODE%"=="200" set "HTTP_OK=1"
if "%HTTP_CODE%"=="301" set "HTTP_OK=1"
if "%HTTP_CODE%"=="302" set "HTTP_OK=1"

for /f %%c in ('curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:%BACKEND_PORT%/ping -m 5 2^>nul') do set "BACKEND_CODE=%%c"
if "%BACKEND_CODE%"=="200" set "BACKEND_OK=1"

node "%~dp0backend\scripts\db-ping.js" >nul 2>nul
if not errorlevel 1 set "DB_OK=1"

if "%HTTP_OK%"=="1" if "%BACKEND_OK%"=="1" if "%DB_OK%"=="1" goto :healthy

set "REASON="
if not "%HTTP_OK%"=="1" set "REASON=!REASON! http=!HTTP_CODE!"
if not "%BACKEND_OK%"=="1" set "REASON=!REASON! backend=!BACKEND_CODE!"
if not "%DB_OK%"=="1" set "REASON=!REASON! postgres=down"

if exist "runlock" (
    call :log "[INFO] Watchdog detected degraded state but startup already in progress:%REASON%"
    goto :end
)

if "%HTTP_OK%"=="1" if "%DB_OK%"=="1" if not "%BACKEND_OK%"=="1" (
    call :log "[WARNING] Backend-only recovery triggered for port %BACKEND_PORT%:%REASON%"
    call "%~dp0start-backend-public.bat" >> "%LOGFILE%" 2>&1
    if errorlevel 1 (
        call :log "[ERROR] Backend-only recovery failed on port %BACKEND_PORT%"
    ) else (
        call :log "[INFO] Backend-only recovery invoked successfully on port %BACKEND_PORT%"
    )
    goto :end
)

for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$svc = Get-Service | Where-Object { $_.Name -like 'postgresql*' -or $_.DisplayName -like 'PostgreSQL*' } | Sort-Object Name | Select-Object -First 1 -ExpandProperty Name; if ($svc) { Write-Output $svc }"`) do set "NATIVE_PG_SERVICE=%%i"

if "%RUN_AS_SYSTEM%"=="1" (
    if defined NATIVE_PG_SERVICE (
        call :log "[WARNING] SYSTEM watchdog recovery triggered using native PostgreSQL:%REASON%"
        call "%~dp0start-bcl-http.bat" --hidden --auto >> "%LOGFILE%" 2>&1
        if errorlevel 1 (
            call :log "[ERROR] SYSTEM watchdog failed to invoke startup command"
        ) else (
            call :log "[INFO] SYSTEM watchdog invoked startup command successfully"
        )
    ) else (
        call :log "[ERROR] Native PostgreSQL service is missing; watchdog cannot recover database runtime:%REASON%"
    )
    goto :end
)

if defined NATIVE_PG_SERVICE (
    call :log "[WARNING] User watchdog recovery triggered with native PostgreSQL present:%REASON%"
    call "%~dp0start-bcl-http.bat" --hidden --auto >> "%LOGFILE%" 2>&1
    if errorlevel 1 (
        call :log "[ERROR] Watchdog failed to invoke startup command"
    ) else (
        call :log "[INFO] Watchdog invoked startup command successfully"
    )
    goto :end
)

call :log "[ERROR] Native PostgreSQL service is missing; watchdog startup recovery cannot proceed safely:%REASON%"
call "%~dp0start-bcl-http.bat" --hidden --auto >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :log "[ERROR] Watchdog failed to invoke startup command"
) else (
    call :log "[INFO] Watchdog invoked startup command successfully"
)
goto :end

:healthy
call "%~dp0start-legacy-5051-proxy.bat" >nul 2>&1
:: Keep healthy runs silent to avoid log bloat.
goto :end

:end
rmdir "%LOCKDIR%" >nul 2>&1
exit /b 0

:recycle_backend
set "RECYCLE_OK=0"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%BACKEND_PORT%.*LISTENING"') do (
    taskkill /PID %%p /F >nul 2>&1
    if not errorlevel 1 (
        set "RECYCLE_OK=1"
        call :log "[INFO] Forced recycle terminated backend listener PID %%p"
    ) else (
        wmic process where "ProcessId=%%p" call terminate >nul 2>&1
        if not errorlevel 1 (
            set "RECYCLE_OK=1"
            call :log "[INFO] Forced recycle terminated backend listener PID %%p via WMIC fallback"
        ) else (
            call :log "[WARNING] Forced recycle could not terminate backend listener PID %%p"
        )
    )
)

if "%RECYCLE_OK%"=="0" (
    call :log "[INFO] Forced recycle did not find an active backend listener on port %BACKEND_PORT%"
)

call :sleep 3
call "%~dp0start-backend-public.bat" >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    call :log "[ERROR] Forced backend recycle failed to invoke start-backend-public.bat"
    exit /b 1
)

set "BACKEND_CODE=000"
for /f %%c in ('curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:%BACKEND_PORT%/ping -m 15 2^>nul') do set "BACKEND_CODE=%%c"
if "%BACKEND_CODE%"=="200" (
    call :log "[SUCCESS] Forced backend recycle completed successfully on port %BACKEND_PORT%"
    exit /b 0
)

call :log "[WARNING] Forced backend recycle completed but /ping returned %BACKEND_CODE%"
exit /b 0

:log
set "MSG=%~1"
>> "%LOGFILE%" echo [%DATE% %TIME%] %MSG%
exit /b 0
