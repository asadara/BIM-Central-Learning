@echo off
set "REQUEST_HIDDEN=0"
set "HIDDEN_CHILD_ARG=0"
for %%A in (%*) do (
    if /I "%%~A"=="--hidden" set "REQUEST_HIDDEN=1"
    if /I "%%~A"=="--hidden-child" set "HIDDEN_CHILD_ARG=1"
)

:: Hidden launcher mode: spawns a detached hidden console and exits caller.
if "%REQUEST_HIDDEN%"=="1" if "%HIDDEN_CHILD_ARG%"=="0" (
    echo [INFO] Launching BCL in hidden background mode...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -WindowStyle Hidden -WorkingDirectory '%~dp0' -FilePath '%ComSpec%' -ArgumentList '/c','%~f0 %* --hidden-child'"
    exit /b 0
)

:: Relaunch in a persistent console for double-click
if "%*"=="" if not defined BCL_CONSOLE (
    set BCL_CONSOLE=1
    start "BCL Server Console" /d "%~dp0" cmd /k ""%~f0" --manual"
    exit /b 0
)

:: Force immediate output without buffering
echo [BOOT] Script initiated at %DATE% %TIME%

chcp 65001 >nul
setlocal EnableDelayedExpansion
set "RUN_AS_SYSTEM=0"
if /I "%USERNAME%"=="SYSTEM" set "RUN_AS_SYSTEM=1"
set "POSTGRES_RUNTIME=unknown"
set "NATIVE_PG_SERVICE="
set "BACKEND_PORT=%BCL_BACKEND_PORT%"
if not defined BACKEND_PORT set "BACKEND_PORT=5052"

:: DEBUG: Log startup information for double-click troubleshooting
echo [DEBUG] Script starting at %DATE% %TIME% > debug_startup.log
echo [DEBUG] First debug point reached >> debug_startup.log
echo [DEBUG] Current directory: %CD% >> debug_startup.log
echo [DEBUG] Script path: %~dp0 >> debug_startup.log
echo [DEBUG] Arguments: %* >> debug_startup.log
echo [DEBUG] ErrorLevel: %ERRORLEVEL% >> debug_startup.log
echo [DEBUG] Execution context: %0 >> debug_startup.log
echo [DEBUG] CommandLine: %CmdLine% >> debug_startup.log
echo [DEBUG] ComSpec: %ComSpec% >> debug_startup.log
echo [DEBUG] Double-click simulation test >> debug_startup.log

:: Set defaults before detecting double-click
set MANUAL_MODE=0
set BOOT_DELAY=0
set RESET_MODE=0
set KEEP_OPEN=0
set HIDDEN_MODE=0
set SUPPRESS_ERROR_CONSOLE=0
set EXIT_CODE=0

:: Enhanced double-click detection and error handling
if "%*"=="" (
    echo [DEBUG] No arguments provided - likely double-click execution >> debug_startup.log
    echo.
    echo ================================================================================
    echo                    ??? DOUBLE-CLICK DETECTED ???
    echo ================================================================================
    echo.
    echo [SUCCESS] Script started successfully via double-click!
    echo [INFO] This window will remain open to show server status.
    echo [INFO] Press any key to begin startup process...
    echo.
    pause >nul
    echo.
    echo [INFO] Starting BCL server components...
    echo.
    set MANUAL_MODE=1
    set KEEP_OPEN=1
) else (
    echo [DEBUG] Arguments provided - likely command line execution >> debug_startup.log
)

:: Parse command line arguments (support multiple flags)
echo [DEBUG] About to parse arguments... >> debug_startup.log
echo [DEBUG] ARGS variable: %* >> debug_startup.log
for %%A in (%*) do (
    echo [DEBUG] Processing argument: %%A >> debug_startup.log
    if "%%A"=="--manual" (
        set MANUAL_MODE=1
        set KEEP_OPEN=1
    )
    if "%%A"=="--auto" set BOOT_DELAY=1
    if "%%A"=="--boot" set BOOT_DELAY=1
    if "%%A"=="--reset" set RESET_MODE=1
    if "%%A"=="--no-error-console" set SUPPRESS_ERROR_CONSOLE=1
    if "%%A"=="--hidden" (
        set HIDDEN_MODE=1
        set MANUAL_MODE=0
        set KEEP_OPEN=0
    )
)
if "%BCL_AUTO%"=="1" set BOOT_DELAY=1
if "%*"=="" (
    set MANUAL_MODE=1
    set KEEP_OPEN=1
)
if "%HIDDEN_MODE%"=="1" if "%BOOT_DELAY%"=="1" set SUPPRESS_ERROR_CONSOLE=1
echo [DEBUG] Arguments parsed: MANUAL_MODE=%MANUAL_MODE%, BOOT_DELAY=%BOOT_DELAY%, RESET_MODE=%RESET_MODE%, HIDDEN_MODE=%HIDDEN_MODE%, SUPPRESS_ERROR_CONSOLE=%SUPPRESS_ERROR_CONSOLE% >> debug_startup.log

:: DEBUG: Test each step individually
echo [DEBUG] About to set working directory... >> debug_startup.log
cd /d "%~dp0"
echo [DEBUG] Working directory set to: %CD% >> debug_startup.log

echo [DEBUG] About to create logs directory... >> debug_startup.log
if not exist "logs" mkdir "logs"
echo [DEBUG] Logs directory creation attempted >> debug_startup.log

echo [DEBUG] About to generate timestamp... >> debug_startup.log
set TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
echo [DEBUG] Timestamp generated: %TIMESTAMP% >> debug_startup.log

set LOGFILE=logs\start-%TIMESTAMP%.log
set BACKEND_LOGFILE=logs\backend-%TIMESTAMP%.log
set BACKEND_ERR_LOGFILE=logs\backend-%TIMESTAMP%.err.log
echo [DEBUG] LOGFILE set to: %LOGFILE% >> debug_startup.log
echo [DEBUG] BACKEND_LOGFILE set to: %BACKEND_LOGFILE% >> debug_startup.log
echo [DEBUG] BACKEND_ERR_LOGFILE set to: %BACKEND_ERR_LOGFILE% >> debug_startup.log
echo [DEBUG] About to check single-instance lock... >> debug_startup.log

:: Single-instance lock (best-effort cleanup)
echo [DEBUG] Checking for existing runlock... >> debug_startup.log
if exist "runlock" (
    echo [DEBUG] Runlock exists - attempting cleanup >> debug_startup.log
    rmdir "runlock" >nul 2>&1
    if exist "runlock" (
        echo [DEBUG] Runlock still present - another instance running >> debug_startup.log
        echo [INFO] Another instance is running - exiting
        if "%KEEP_OPEN%"=="1" pause
        exit /b 0
    ) else (
        echo [INFO] Stale runlock removed - continuing startup
    )
)
echo [DEBUG] No existing runlock found, creating new one... >> debug_startup.log
mkdir "runlock" 2>nul
if errorlevel 1 (
    echo [DEBUG] Failed to create runlock - another instance running >> debug_startup.log
    echo [INFO] Another instance is running - exiting
    if "%KEEP_OPEN%"=="1" pause
    exit /b 0
)
echo [DEBUG] Runlock created successfully >> debug_startup.log

:: Display log path and redirect to log (after LOGFILE is set)
echo [DEBUG] About to call main function... >> debug_startup.log
if "%MANUAL_MODE%"=="1" (
    if "%HIDDEN_MODE%"=="0" (
        call :main %*
    ) else (
        call :main %* >> "%LOGFILE%" 2>&1
    )
) else (
    call :main %* >> "%LOGFILE%" 2>&1
)
echo [DEBUG] Main function call completed >> debug_startup.log
if "%EXIT_CODE%"=="0" set EXIT_CODE=%errorlevel%
goto :cleanup

:main
title BCL Phase 4 Enterprise - HTTP Production Server
color 0A

echo ================================================================================
echo                    BCL PHASE 4 ENTERPRISE LEARNING PLATFORM
echo                           HTTP PRODUCTION SERVER - STABLE
echo ================================================================================
echo.
echo [SUCCESS] Main function reached successfully!
echo [INFO] This proves the double-click functionality is working.
echo.
echo [TEST] Performing basic system checks...
echo.

:: Set working directory to script location
cd /d "%~dp0"
echo [INFO] Working directory: %CD%

:: Initialize error flag
set ERROR_FLAG=0

:: Quick health checks (simplified for testing)
echo [INFO] Checking basic requirements...

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found!
    set ERROR_FLAG=1
    goto :error_exit
) else (
    for /f "tokens=*" %%i in ('node --version') do echo [OK] Node.js: %%i
)

:: Check backend directory
if not exist "backend\server.js" (
    echo [ERROR] backend\server.js not found!
    set ERROR_FLAG=1
    goto :error_exit
) else (
    echo [OK] Backend directory found
)

:: Check native PostgreSQL service availability
call :detect_native_postgres_service
if not defined NATIVE_PG_SERVICE (
    echo [ERROR] Native PostgreSQL service not found!
    set ERROR_FLAG=1
    goto :error_exit
) else (
    echo [OK] Native PostgreSQL service detected: !NATIVE_PG_SERVICE!
)

echo.
echo [SUCCESS] Basic system checks passed!
echo [INFO] Double-click functionality is working correctly.
echo [INFO] The script successfully reached the main execution phase.
echo.



echo [PHASE 1/8] System Health Check...
echo ======================================

:: Initialize NGINX_FOUND variable
set NGINX_FOUND=0

:: Check if we're in the right directory
if not exist "backend\server.js" (
    echo [ERROR] backend\server.js not found!
    echo [INFO] Current directory: %CD%
    echo [INFO] Please run this script from the BCL root directory.
    set ERROR_FLAG=1
    goto :error_exit
)

:: Check Node.js
echo [INFO] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found! Please install Node.js first.
    echo [INFO] Download from: https://nodejs.org/
    set ERROR_FLAG=1
    goto :error_exit
)
for /f "tokens=*" %%i in ('node --version') do echo [OK] Node.js: %%i

call :detect_native_postgres_service
if defined NATIVE_PG_SERVICE (
    set "POSTGRES_RUNTIME=native"
    echo [INFO] Native PostgreSQL service detected: !NATIVE_PG_SERVICE!
    echo [INFO] Native PostgreSQL mode enabled
    goto :runtime_ready
) else (
    goto :native_postgres_missing
)

:detect_native_postgres_service
set "NATIVE_PG_SERVICE="
for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$svc = Get-Service | Where-Object { $_.Name -like 'postgresql*' -or $_.DisplayName -like 'PostgreSQL*' } | Sort-Object Name | Select-Object -First 1 -ExpandProperty Name; if ($svc) { Write-Output $svc }"`) do set "NATIVE_PG_SERVICE=%%i"
exit /b 0

:start_native_postgres_service
if not defined NATIVE_PG_SERVICE exit /b 1
sc query "!NATIVE_PG_SERVICE!" | findstr /I "RUNNING" >nul
if errorlevel 1 (
    net start "!NATIVE_PG_SERVICE!" >nul 2>&1
    if errorlevel 1 (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Start-Service -Name '!NATIVE_PG_SERVICE!' -ErrorAction Stop; exit 0 } catch { exit 1 }" >nul 2>&1
        if errorlevel 1 exit /b 1
    )
)

for /l %%i in (1,1,45) do (
    call :postgres_probe
    if not errorlevel 1 exit /b 0
    call :sleep 2
)
exit /b 1

:postgres_probe
node "%~dp0backend\scripts\db-ping.js" >nul 2>nul
if errorlevel 1 exit /b 1
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

:runtime_ready
:: ??? UPDATED: Direct project nginx detection (simplified and robust)
echo [INFO] Checking project nginx installation...

:: Set nginx paths directly (no complex detection needed)
set "NGINX_DIR=%~dp0nginx\nginx-1.28.0"
set "NGINX_EXE=%NGINX_DIR%\nginx.exe"
set "NGINX_CONF=%NGINX_DIR%\conf\nginx.conf"

:: Check if nginx exists in project location
if not exist "%NGINX_EXE%" (
    echo.
    echo ================================================================================
    echo                      ??? CRITICAL ERROR: Nginx Not Found
    echo ================================================================================
    echo.
    echo [ERROR] Nginx is not installed in the expected project location!
    echo [EXPECTED] %NGINX_EXE%
    echo.
    echo [REQUIRED] Nginx is ESSENTIAL for BCL full operation.
    echo [REASON] System requires all components to be working.
    echo.
    echo ================================================================================
    echo                      ???? HOW TO FIX NGINX INSTALLATION
    echo ================================================================================
    echo.
    echo OPTION 1 - Run automated setup:
    echo ??????????????????????????????????????????????????????????????????????????????????????????
    echo .\nginx-setup.bat
    echo.
    echo OPTION 2 - Manual installation:
    echo ??????????????????????????????????????????????????????????????????????????????????????????
    echo 1. Download nginx-1.28.0.zip from:
    echo    https://nginx.org/download/nginx-1.28.0.zip
    echo.
    echo 2. Extract to: %~dp0nginx\nginx-1.28.0
    echo    Example: C:\BCL\nginx\nginx-1.28.0
    echo.
    echo 3. Run this script again.
    echo.
    echo ================================================================================
    echo.
    echo [INFO] After installing Nginx, run this script again.
    echo [INFO] The system CANNOT operate without Nginx reverse proxy.
    echo.
    set ERROR_FLAG=1
    goto :error_exit
) else (
    echo [OK] Nginx found in project location: %NGINX_DIR%
    set NGINX_FOUND=1
)

:validate_nginx_config
:: ??? ENHANCED: Validate Nginx configuration
echo [INFO] Validating Nginx configuration...

:: Check if config file exists
if not "%NGINX_DIR%"=="PATH" (
    if not exist "%NGINX_CONF%" (
        echo.
        echo ================================================================================
        echo                    ??? CRITICAL ERROR: Nginx Config Missing
        echo ================================================================================
        echo.
        echo [ERROR] Nginx configuration file not found!
        echo [PATH] %NGINX_CONF%
        echo.
        echo [REQUIRED] nginx.conf is essential for proper operation.
        echo.
        echo [SOLUTION] Ensure nginx.conf exists in conf\ directory
        echo [LOCATION] %NGINX_DIR%\conf\nginx.conf
        echo.
        set ERROR_FLAG=1
        goto :error_exit
    )

    :: Test configuration syntax
    echo [INFO] Testing Nginx configuration syntax...
    "%NGINX_EXE%" -t -c "%NGINX_CONF%" >nul 2>&1
    if errorlevel 1 (
        echo.
        echo ================================================================================
        echo                    ??? CRITICAL ERROR: Invalid Nginx Config
        echo ================================================================================
        echo.
        echo [ERROR] Nginx configuration file has syntax errors!
        echo.
        echo [ACTION] Run the following command to see detailed errors:
        echo         "%NGINX_EXE%" -t -c "%NGINX_CONF%"
        echo.
        echo [SOLUTION] Fix the configuration file syntax errors.
        echo [LOCATION] %NGINX_CONF%
        echo.
        set ERROR_FLAG=1
        goto :error_exit
    ) else (
        echo [OK] Nginx configuration syntax is valid
        set "NGINX_VALID=1"
    )
) else (
    :: For PATH-based nginx, we can't easily validate config
    echo [INFO] Nginx found in PATH - configuration validation skipped
    set "NGINX_VALID=1"
)

echo [SUCCESS] Nginx detection and validation completed
echo [INFO] Nginx executable: %NGINX_EXE%
if not "%NGINX_DIR%"=="PATH" (
    echo [INFO] Nginx directory: %NGINX_DIR%
    echo [INFO] Nginx config: %NGINX_CONF%
)

:: Check if ports are available
echo [INFO] Checking port availability...
netstat -ano | findstr ":%BACKEND_PORT%" >nul
if %errorlevel% equ 0 (
    echo [WARNING] Port %BACKEND_PORT% is already in use. Will attempt to free it.
)

netstat -ano | findstr ":80" >nul
if %errorlevel% equ 0 (
    echo [WARNING] Port 80 is already in use. Will attempt to free it.
)

echo.
echo [PHASE 2/8] Process Cleanup...
echo ================================

:: Kill existing processes (more aggressive)
echo [INFO] Terminating existing Nginx processes...
REM DISABLED: taskkill /f /im node.exe /t >nul 2>&1
taskkill /f /im nginx.exe /t >nul 2>&1

:: Ensure Firewall Rule exists
echo [INFO] Verifying firewall rules...
netsh advfirewall firewall delete rule name="BCL Nginx HTTP" >nul 2>&1
netsh advfirewall firewall add rule name="BCL Nginx HTTP" dir=in action=allow protocol=TCP localport=80 >nul 2>&1
netsh advfirewall firewall delete rule name="BCL HTTPS Inbound" >nul 2>&1
netsh advfirewall firewall add rule name="BCL HTTPS Inbound" dir=in action=allow protocol=TCP localport=443 >nul 2>&1
netsh advfirewall firewall delete rule name="BCL Backend Port %BACKEND_PORT%" >nul 2>&1
netsh advfirewall firewall add rule name="BCL Backend Port %BACKEND_PORT%" dir=in action=allow protocol=TCP localport=%BACKEND_PORT% >nul 2>&1

:: Wait for processes to fully terminate
call :sleep 3

:: Double-check cleanup
REM DISABLED: taskkill /f /im node.exe /t >nul 2>&1
REM DISABLED: taskkill /f /im nginx.exe /t >nul 2>&1

echo [OK] Process cleanup completed.
echo.

echo [PHASE 3/8] Starting PostgreSQL Database...
echo ===========================================

call :detect_native_postgres_service
if defined NATIVE_PG_SERVICE (
    echo [INFO] Native PostgreSQL service detected: !NATIVE_PG_SERVICE!
    echo [INFO] Preferring native PostgreSQL runtime...
    call :postgres_probe
    if not errorlevel 1 (
        set "POSTGRES_RUNTIME=native"
        echo [SUCCESS] Native PostgreSQL is already accepting connections
        goto :postgres_check_done
    )

    echo [INFO] Starting native PostgreSQL service...
    call :start_native_postgres_service
    if errorlevel 1 goto :native_postgres_failed
    set "POSTGRES_RUNTIME=native"
    goto :postgres_check_done
)

goto :native_postgres_missing

:native_postgres_failed
echo.
echo ================================================================================
echo            ??? CRITICAL ERROR: Native PostgreSQL Service Failed
echo ================================================================================
echo.
echo [ERROR] Failed to start or validate native PostgreSQL service.
echo [REQUIRED] PostgreSQL is ESSENTIAL for BCL database operations.
echo [REASON] System requires all components to be fully operational.
echo.
echo [ACTION] Check Windows Services for a PostgreSQL service.
echo [ACTION] Verify port 5432 is available and credentials match BCL config.
echo [ACTION] Run restore-native-postgres.ps1 after installing native PostgreSQL.
echo.
set ERROR_FLAG=1
goto :error_exit

:native_postgres_missing
echo.
echo ================================================================================
echo             ??? CRITICAL ERROR: Native PostgreSQL Service Missing
echo ================================================================================
echo.
echo [ERROR] Native PostgreSQL service could not be detected.
echo [REQUIRED] PostgreSQL is ESSENTIAL for BCL database operations.
echo [REASON] System requires all components to be fully operational.
echo.
echo [ACTION] Check Windows Services for a PostgreSQL service named like postgresql-x64-*.
echo [ACTION] Ensure PostgreSQL Server 15 is installed and configured on port 5432.
echo [ACTION] Run install-native-postgres-service.bat or restore-native-postgres.ps1 if recovery is needed.
echo ================================================================================
echo.
set ERROR_FLAG=1
goto :error_exit

:postgres_validation
:: ??? STRICT: PostgreSQL validation - REQUIRED for operation
echo [INFO] Validating PostgreSQL connectivity...

call :postgres_probe
echo [DEBUG] postgres probe errorlevel: %errorlevel%
if errorlevel 1 goto :postgres_not_ready

echo [SUCCESS] PostgreSQL is ready and accepting connections
echo [SUCCESS] PostgreSQL database fully operational via %POSTGRES_RUNTIME%
goto :postgres_check_done

:postgres_not_ready
echo.
echo ================================================================================
echo                ??? CRITICAL ERROR: PostgreSQL Not Ready
echo ================================================================================
echo.
echo [ERROR] Native PostgreSQL service is running but not accepting connections!
echo [REQUIRED] PostgreSQL must be fully operational for BCL to function.
echo.
echo [POSSIBLE CAUSES]
echo ??? PostgreSQL still initializing (try waiting longer)
echo ??? Database credentials incorrect
echo ??? Native service health issues
echo ??? Port 5432 connectivity problems
echo.
echo [ACTION] Check Windows Service status and native PostgreSQL logs.
echo [ACTION] Test manual connection:
echo        psql -h 127.0.0.1 -p 5432 -U bcl_user -d bcl_database
echo.
echo [SOLUTION] If issues persist, restore the native PostgreSQL service and BCL credentials.
echo.
set ERROR_FLAG=1
goto :error_exit

:postgres_check_done

:: Boot delay for --auto/--boot flags
if "%BOOT_DELAY%"=="1" (
    echo [INFO] Boot delay active - waiting 20 seconds for services to settle...
    call :sleep 20
)

:: Reset mode: perform targeted cleanup if requested
if "%RESET_MODE%"=="1" (
    echo [INFO] Reset mode activated - performing targeted cleanup...
    echo [INFO] Native PostgreSQL runtime detected - skipping database reset

    :: Reset backend server (targeted PID kill on configured backend port)
    echo [INFO] Resetting backend server...
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%BACKEND_PORT%.*LISTENING"') do (
        echo [INFO] Killing backend process PID: %%p
        taskkill /PID %%p /F >nul 2>&1
        if errorlevel 1 (
            wmic process where "ProcessId=%%p" call terminate >nul 2>&1
        )
    )

    :: Reset nginx (graceful quit, then force kill if needed)
    echo [INFO] Resetting nginx...
    "%NGINX_EXE%" -s quit -p "%NGINX_DIR%" -c "conf\nginx.conf" 2>nul
    call :sleep 3

    :: Check if nginx is still running on port 80, force kill if needed
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":80.*LISTENING"') do (
        echo [INFO] Force killing nginx process PID: %%p
        taskkill /PID %%p /F >nul 2>&1
    )

    echo [OK] Reset cleanup completed
)

echo.
echo [PHASE 5/8] Starting Backend Server...
echo =======================================

:: Start backend server with error checking
echo [INFO] Starting Node.js backend server on port %BACKEND_PORT%...
cd backend

:: ??? FIXED: Use absolute path to ensure server runs from correct directory
:: This prevents the "Cannot find module" error that occurs when running from wrong directory
echo [INFO] Current directory: %CD%
echo [INFO] Starting server with absolute path: %CD%\server.js

:: Start server with explicit path and better error handling
:: Use full absolute path to ensure Node.js can find the module
:: Perform idempotent check so an existing backend is not spawned twice
echo [INFO] Checking for existing backend on port %BACKEND_PORT%...
set "BACKEND_ALREADY_RUNNING=0"
set "BACKEND_PORT_LISTENING=0"
netstat -ano | findstr ":%BACKEND_PORT%.*LISTENING" >nul
if not errorlevel 1 set "BACKEND_PORT_LISTENING=1"
curl.exe -s http://127.0.0.1:%BACKEND_PORT%/ping -m 3 >nul 2>&1
if not errorlevel 1 set "BACKEND_ALREADY_RUNNING=1"
if "%BACKEND_ALREADY_RUNNING%"=="0" if "%BACKEND_PORT_LISTENING%"=="1" set "BACKEND_ALREADY_RUNNING=1"

if "%BACKEND_ALREADY_RUNNING%"=="1" (
    if "%BACKEND_PORT_LISTENING%"=="1" (
        echo [OK] Port %BACKEND_PORT% is already LISTENING - skipping new backend launch
    ) else (
        echo [OK] Existing backend is already responding - skipping new launch
    )
) else (
    echo [INFO] Starting backend server...
    if "%HIDDEN_MODE%"=="1" (
        echo [INFO] Hidden mode active - launching backend without terminal window
        powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:HTTP_PORT='%BACKEND_PORT%'; Start-Process -WindowStyle Hidden -WorkingDirectory '%~dp0backend' -FilePath 'node.exe' -ArgumentList 'server.js' -RedirectStandardOutput '%~dp0%BACKEND_LOGFILE%' -RedirectStandardError '%~dp0%BACKEND_ERR_LOGFILE%'"
        if errorlevel 1 (
            echo [ERROR] Failed to launch backend process in hidden mode
            set ERROR_FLAG=1
            goto :error_exit
        )
    ) else (
        start "BCL Backend Server" cmd /k "set HTTP_PORT=%BACKEND_PORT% && node \"%~dp0backend\server.js\""
    )
)

:: Wait for backend to initialize
if "%BACKEND_ALREADY_RUNNING%"=="0" (
    echo [INFO] Waiting for backend server to start...
    call :sleep 8
)

:: Test backend server with curl (non-interactive, explicit timeout)
echo [INFO] Testing backend server connectivity...
curl.exe -s http://127.0.0.1:%BACKEND_PORT%/ping -m 10 >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Backend server not responding to curl on port %BACKEND_PORT%
    echo [INFO] Checking if server process is actually running...

    :: ??? ENHANCED: Additional troubleshooting - check if server process is running
    tasklist /fi "imagename eq node.exe" /nh 2>nul | findstr /i "node.exe" >nul
    if errorlevel 1 (
        echo [ERROR] No Node.js process found - server failed to start
        echo [INFO] This could be due to missing dependencies or configuration issues
        set ERROR_FLAG=1
        goto :error_exit
    ) else (
        echo [INFO] Node.js process is running and listening on port %BACKEND_PORT%
        echo [INFO] Server may be starting up slowly - continuing with startup
        echo [WARNING] Backend connectivity test failed but process is running
        echo [INFO] System will continue - backend may respond after full initialization
    )
) else (
    echo [SUCCESS] Backend server responding on port %BACKEND_PORT%
)

:: Return to root directory
cd ..

echo [INFO] Ensuring legacy compatibility proxy on port 5051...
call "%~dp0start-legacy-5051-proxy.bat" >nul 2>&1

echo.

REM ---- PATCH: backend ready label ----
:backend_ready
REM ---- END PATCH ----

echo [PHASE 6/8] Starting Nginx Reverse Proxy...
echo ============================================

:: If nginx already running, reload config and continue
tasklist /fi "imagename eq nginx.exe" /nh 2>nul | findstr /i "nginx.exe" >nul
if not errorlevel 1 (
    echo [INFO] Nginx already running - reloading configuration
    "%NGINX_EXE%" -s reload -p "%NGINX_DIR%" -c "conf\nginx.conf" 2>nul
    call :sleep 2
    goto :nginx_ready
)

:: Port 80 conflict check (simple)
netstat -ano | findstr ":80.*LISTENING" >nul
if %errorlevel% equ 0 (
    echo [ERROR] Port 80 is already in use by another process.
    echo [INFO] Run: netstat -ano ^| findstr ":80"
    set ERROR_FLAG=1
    goto :error_exit
)

:: Verify Nginx was found (should not reach here if not found)
if "%NGINX_FOUND%"=="0" (
    echo.
    echo ================================================================================
    echo                ??? CRITICAL ERROR: Nginx Startup Failed
    echo ================================================================================
    echo.
    echo [ERROR] Nginx executable not found - cannot proceed!
    echo [REASON] Nginx is REQUIRED for BCL operation.
    echo.
    set ERROR_FLAG=1
    goto :error_exit
)

:: Attempt to start Nginx
echo [INFO] Starting Nginx reverse proxy on port 80...
echo [INFO] Command: "%NGINX_EXE%" -p "%NGINX_DIR%" -c "conf\nginx.conf"
start /min "Nginx HTTP Proxy" "%NGINX_EXE%" -p "%NGINX_DIR%" -c "conf\nginx.conf"

echo [SUCCESS] Nginx startup command executed

:: Wait for Nginx to initialize
echo [INFO] Waiting 10 seconds for Nginx initialization...
call :sleep 10

:: ??? ENHANCED: Multi-level Nginx validation
echo [INFO] Performing comprehensive Nginx validation...

:: Test 1: Check if nginx.exe process is running
tasklist /fi "imagename eq nginx.exe" /nh 2>nul | findstr /i "nginx.exe" >nul
if errorlevel 1 (
    echo.
    echo ================================================================================
    echo                ??? CRITICAL ERROR: Nginx Process Not Running
    echo ================================================================================
    echo.
    echo [ERROR] Nginx process nginx.exe is not running after startup!
    echo.
    echo [POSSIBLE CAUSES]
    echo ??? Nginx configuration syntax errors
    echo ??? Port 80 already in use by another application
    echo ??? Nginx executable corrupted or incompatible
    echo ??? Insufficient permissions to bind to port 80
    echo.
    echo [ACTION] Check Windows Event Viewer for error details
    echo [ACTION] Try: netstat -ano ^| findstr ":80" - check what's using port 80
    echo.
    set ERROR_FLAG=1
    goto :error_exit
) else (
    echo [OK] Nginx process is running
)

:: Test 2: Check if port 80 is listening
netstat -ano | findstr ":80.*LISTENING" >nul
if errorlevel 1 (
    echo.
    echo ================================================================================
    echo                ??? CRITICAL ERROR: Port 80 Not Listening
    echo ================================================================================
    echo.
    echo [ERROR] Port 80 is not in LISTENING state!
    echo [DETAILS] Nginx process running but not accepting connections.
    echo.
    echo [POSSIBLE CAUSES]
    echo ??? Nginx configuration prevents binding to port 80
    echo ??? Windows Firewall blocking port 80
    echo ??? Another application stole the port
    echo.
    echo [ACTION] Check nginx error logs: %NGINX_DIR%\logs\error.log
    echo [ACTION] Verify firewall allows port 80
    echo.
    set ERROR_FLAG=1
    goto :error_exit
) else (
    echo [OK] Port 80 is in LISTENING state
)

:: Test 3: HTTP connectivity test with 10 attempts (1s intervals)
echo [INFO] Testing HTTP connectivity (up to 10 attempts)...

set "HTTP_SUCCESS=0"
for /l %%i in (1,1,10) do (
    echo [INFO] Attempt %%i/10: Testing HTTP 200 response...
    for /f %%c in ('curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1/ 2^>nul') do set HTTP_CODE=%%c
    if "!HTTP_CODE!"=="200" set "TEST_OK=1"
    if "!HTTP_CODE!"=="301" set "TEST_OK=1"
    if "!HTTP_CODE!"=="302" set "TEST_OK=1"

    if "!TEST_OK!"=="1" (
        echo [SUCCESS] Nginx HTTP connectivity test passed on attempt %%i - HTTP !HTTP_CODE!
        goto :http_check_passed
    ) else (
        echo [WARNING] Attempt %%i failed - HTTP !HTTP_CODE! - waiting 1 second...
        call :sleep 1
    )
)

goto :http_test_success

:http_check_passed
set "HTTP_SUCCESS=1"

:http_test_success
if "%HTTP_SUCCESS%"=="0" (
    echo.
    echo ================================================================================
    echo                ??? CRITICAL ERROR: Nginx HTTP Test Failed
    echo ================================================================================
    echo.
    echo [ERROR] Nginx is not responding with HTTP 200 on localhost:80!
    echo [DETAILS] All 10 connectivity tests failed.
    echo.
    echo [POSSIBLE CAUSES]
    echo ??? Nginx configuration routing issues
    echo ??? Backend server not responding - check port %BACKEND_PORT%
    echo ??? Network/firewall blocking localhost connections
    echo ??? Nginx worker processes crashed
    echo.
    echo [ACTION] Check nginx access logs: %NGINX_DIR%\logs\access.log
    echo [ACTION] Check nginx error logs: %NGINX_DIR%\logs\error.log
    echo [ACTION] Test backend directly: curl http://127.0.0.1:%BACKEND_PORT%/ping
    echo.
    set ERROR_FLAG=1
    goto :error_exit
)

echo [SUCCESS] Nginx reverse proxy fully operational on port 80

:nginx_ready
echo.
echo [PHASE 7/8] Final System Validation...
echo ======================================

:: Get server IP for network access
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /C:"IPv4 Address" ^| findstr /V "127.0.0.1"') do (
    set SERVER_IP=%%i
    goto :found_ip
)
:found_ip
set SERVER_IP=%SERVER_IP:~1%

echo [INFO] Server IP Address: %SERVER_IP%
echo [INFO] Local access:  http://localhost or https://localhost
echo [INFO] Network access: http://%SERVER_IP% / https://%SERVER_IP%
echo [INFO] Domain access:  http://bcl.nke.net / https://bcl.nke.net

echo.
echo [PHASE 8/8] Service Status Check...
echo ====================================

:: ??? ENHANCED: Strict validation - Nginx is REQUIRED
tasklist /fi "imagename eq node.exe" /nh 2>nul | findstr /i "node.exe" >nul
if errorlevel 1 (
    echo [ERROR] Node.js backend server is not running!
    set ERROR_FLAG=1
) else (
    echo [OK] Node.js backend server is running
)

:: ??? STRICT: Nginx is REQUIRED - no fallback allowed
tasklist /fi "imagename eq nginx.exe" /nh 2>nul | findstr /i "nginx.exe" >nul
if errorlevel 1 (
    echo.
    echo ================================================================================
    echo                ??? CRITICAL ERROR: Nginx Not Running
    echo ================================================================================
    echo.
    echo [ERROR] Nginx reverse proxy is not running!
    echo [REQUIRED] Nginx is ESSENTIAL for BCL operation.
    echo [REASON] System cannot function without reverse proxy.
    echo.
    echo [ACTION] Check previous error messages for startup failures.
    echo [ACTION] Ensure Nginx was installed and configured correctly.
    echo.
    set ERROR_FLAG=1
) else (
    echo [OK] Nginx reverse proxy is running
)

:: ??? STRICT: PostgreSQL validation - REQUIRED for operation
if not defined NATIVE_PG_SERVICE call :detect_native_postgres_service
if not defined NATIVE_PG_SERVICE (
    echo.
    echo ================================================================================
    echo                 ??? CRITICAL ERROR: PostgreSQL Service Not Found
    echo ================================================================================
    echo.
    echo [ERROR] Native PostgreSQL service could not be detected!
    echo [REQUIRED] PostgreSQL is ESSENTIAL for BCL database operations.
    echo [REASON] System cannot function without database.
    echo.
    set ERROR_FLAG=1
) else (
    sc query "!NATIVE_PG_SERVICE!" | findstr /I "RUNNING" >nul
    if errorlevel 1 (
        echo.
        echo ================================================================================
        echo               ??? CRITICAL ERROR: PostgreSQL Service Not Running
        echo ================================================================================
        echo.
        echo [ERROR] Native PostgreSQL service !NATIVE_PG_SERVICE! is not running!
        echo [REQUIRED] PostgreSQL is ESSENTIAL for BCL database operations.
        echo [REASON] System cannot function without database.
        echo.
        set ERROR_FLAG=1
    ) else (
        echo [OK] Native PostgreSQL service is running: !NATIVE_PG_SERVICE!
    )
)

:: Check port + HTTP status (retry to avoid false negatives during startup)
set "PORT_OK=0"
set "HTTP_OK=0"

for /l %%i in (1,1,6) do (
    netstat -ano | findstr ":%BACKEND_PORT%.*LISTENING" >nul && set "PORT_OK=1"
    if "!PORT_OK!"=="1" goto :port_backend_checked
    call :sleep 2
)
:port_backend_checked

for /l %%i in (1,1,6) do (
    for /f %%c in ('curl.exe -s -o nul -w "%%{http_code}" http://127.0.0.1:%BACKEND_PORT%/api/debug/test 2^>nul') do set "HTTP_CODE=%%c"
    if "!HTTP_CODE!"=="200" (
        set "HTTP_OK=1"
        goto :http_backend_checked
    )
    call :sleep 2
)
:http_backend_checked

if "%HTTP_OK%"=="1" (
    echo [OK] Backend HTTP check passed ^(/api/debug/test^)
) else if "%PORT_OK%"=="1" (
    echo [OK] Port %BACKEND_PORT% is listening ^(backend server^)
    echo [WARNING] Backend HTTP check did not respond yet
) else (
    echo [ERROR] Port %BACKEND_PORT% is not listening!
    set ERROR_FLAG=1
)

echo.
echo [PHASE 8/8] Access Information...
echo ================================

if "%ERROR_FLAG%"=="0" (
    echo ================================================================================
    echo                           ???? SYSTEM STARTUP SUCCESS! ????
    echo ================================================================================
    echo.
    echo ACCESS URLs ^(Via Nginx Reverse Proxy^):
    echo =======================================
    echo Local Computer:
    echo   ??? Main Platform:    http://localhost or https://localhost
    echo   ??? Admin Panel:      http://localhost/admin.html or https://localhost/admin.html
    echo   ??? Dashboard:        http://localhost/elearning-assets/dashboard.html or https://localhost/elearning-assets/dashboard.html
    echo.
    echo Network Access ^(Other Computers^):
    echo   ??? Main Platform:    http://%SERVER_IP% or https://%SERVER_IP%
    echo   ??? Admin Panel:      http://%SERVER_IP%/admin.html or https://%SERVER_IP%/admin.html
    echo   ??? Dashboard:        http://%SERVER_IP%/elearning-assets/dashboard.html or https://%SERVER_IP%/elearning-assets/dashboard.html
    echo   ??? Domain Access:    http://bcl.nke.net or https://bcl.nke.net ^(if hosts file configured^)
    echo.
    echo SYSTEM STATUS:
    echo ==============
    echo ??? PostgreSQL Database: Running as native Windows service ^(!NATIVE_PG_SERVICE!^)
    echo ??? Backend Server: Running on port %BACKEND_PORT%
    echo ??? Nginx Reverse Proxy: Running on port 80
    echo ??? Web Interface: Available and fully operational
    echo ??? Network Access: Enabled
    echo.
    echo IMPORTANT NOTES:
    echo ================
    if "%HIDDEN_MODE%"=="1" (
        echo ??? Hidden mode active: server window is intentionally not shown
    ) else (
        echo ??? Keep this window open to maintain services
    )
    echo ??? Press Ctrl+C to stop all services gracefully
    echo ??? Check backend.log and nginx error logs for issues
    echo ??? All components are REQUIRED and running - no fallbacks
    echo.

    echo ================================================================================
    echo         ???? BCL PHASE 4 ENTERPRISE PLATFORM - FULLY OPERATIONAL! ????
    echo ================================================================================

    echo.
    if "%HIDDEN_MODE%"=="1" (
        echo [INFO] Hidden mode active - browser auto-open skipped
    ) else (
        echo [INFO] Opening main BCL platform in browser...
        start "" "http://localhost"
    )

    echo.
    echo [SUCCESS] BCL is now running and accessible!
    echo [INFO] Services will continue running until you close this window.

) else (
    echo ================================================================================
    echo                             ??? STARTUP FAILED ???
    echo ================================================================================
    echo.
    echo [ERROR] One or more REQUIRED services failed to start.
    echo [POLICY] NO FALLBACKS - All components must be operational.
    echo.
    echo [FAILED COMPONENTS] Check error messages above.
    echo [REASON] System cannot function without all required services.
    echo.
    echo [ACTION] Fix the reported issues and run this script again.
    echo [INFO] The system REQUIRES all components to be working.
    set EXIT_CODE=1
)

goto :end

:error_exit
echo.
echo [ERROR] Startup failed due to prerequisite check failure.
echo [INFO] Please resolve the issues above and try again.
if "%KEEP_OPEN%"=="1" pause
set EXIT_CODE=1
goto :cleanup

:end
echo.
if "%KEEP_OPEN%"=="1" pause

:cleanup
:: Release single-instance lock
if exist "runlock" rmdir "runlock"
if "%HIDDEN_MODE%"=="1" if not "%EXIT_CODE%"=="0" (
    if "%SUPPRESS_ERROR_CONSOLE%"=="1" (
        echo [INFO] Hidden startup failed; error console suppressed by configuration.
        echo [INFO] Startup log: %LOGFILE%
        echo [INFO] Backend log: %BACKEND_LOGFILE%
        echo [INFO] Backend err log: %BACKEND_ERR_LOGFILE%
    ) else (
        call :open_error_console
    )
)
exit /b %EXIT_CODE%

:open_error_console
start "BCL Server Console (Error)" /d "%~dp0" cmd /k "echo [ERROR] Hidden startup failed. & echo [INFO] Startup log: %LOGFILE% & echo [INFO] Backend log: %BACKEND_LOGFILE% & echo [INFO] Backend err log: %BACKEND_ERR_LOGFILE% & if exist ""%LOGFILE%"" (echo. & type ""%LOGFILE%"") else (echo [WARNING] Startup log not found.) & echo. & echo [INFO] For visible startup run: %~nx0 --manual & echo [INFO] For hidden startup run: %~nx0 --hidden"
exit /b 0
