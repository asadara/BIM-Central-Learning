@echo off
title BCL Load Testing - 20 Concurrent Users
color 0A

echo ================================================================
echo                BCL SERVER LOAD TESTING
echo ================================================================
echo.

cd /d "%~dp0backend"

if not exist "load-test.js" (
    echo [ERROR] load-test.js not found in backend directory
    echo [INFO] Current directory: %CD%
    pause
    exit /b 1
)

echo [INFO] Starting load test with 20 concurrent connections...
echo [INFO] Target: http://localhost:5051
echo [INFO] Duration: 30 seconds
echo [INFO] Max requests: 1000
echo.

node load-test.js 20 30 1000

echo.
echo [INFO] Load test completed. Check results above.
echo.

pause
