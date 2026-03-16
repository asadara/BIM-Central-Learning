@echo off
:: BCL Backend Server with Auto-Restart
:: This script runs the Node.js server and auto-restarts it when it exits
:: Use this instead of direct "node server.js" if you want restart via dashboard

title BCL Backend Server (Auto-Restart Enabled)
color 0A

cd /d "%~dp0"
chcp 65001 >nul

echo ================================================================================
echo           BCL Backend Server - Auto-Restart Mode Enabled
echo ================================================================================
echo.
echo [INFO] Server will automatically restart when it exits.
echo [INFO] Use the Dashboard "Restart Server" button to trigger restart.
echo [INFO] Press Ctrl+C to stop completely.
echo.

:start_server
echo.
echo ================================================================================
echo [%date% %time%] Starting Node.js server...
echo ================================================================================

:: Set environment variable to indicate auto-restart is available
set BCL_AUTO_RESTART=1

:: Run the server and wait for it to exit
node server.js

:: Server has exited - check exit code
set EXIT_CODE=%ERRORLEVEL%
echo.
echo ================================================================================
echo [%date% %time%] Server exited with code: %EXIT_CODE%
echo ================================================================================

:: Exit code 0 = normal restart request
:: Exit code 42 = restart request from dashboard
:: Other codes = error, still restart but with delay

if %EXIT_CODE%==0 (
    echo [INFO] Normal exit - restarting in 2 seconds...
    timeout /t 2 /nobreak >nul
    goto :start_server
)

if %EXIT_CODE%==42 (
    echo [INFO] Dashboard restart request - restarting immediately...
    timeout /t 1 /nobreak >nul
    goto :start_server
)

:: Error exit - wait longer before restart
echo [WARNING] Server crashed with error code %EXIT_CODE%
echo [INFO] Restarting in 5 seconds (press Ctrl+C to cancel)...
timeout /t 5
goto :start_server
