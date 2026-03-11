@echo off
chcp 65001 >nul
title BCL Backend Server Only
color 0A
set "BACKEND_PORT=%BCL_BACKEND_PORT%"
if not defined BACKEND_PORT set "BACKEND_PORT=5052"

echo ================================================================================
echo                      BCL BACKEND SERVER ONLY
echo                    Minimal Startup - Direct Access
echo ================================================================================
echo.

:: Set working directory to script location
cd /d "%~dp0"
echo [INFO] Working directory: %CD%
echo.

:: Check prerequisites
if not exist "backend\server.js" (
    echo [ERROR] backend\server.js not found!
    echo [INFO] Please run this script from the BCL root directory.
    pause
    exit /b 1
)

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found! Please install Node.js first.
    pause
    exit /b 1
)

:: Kill existing node processes
echo [INFO] Cleaning up existing Node.js processes...
taskkill /f /im node.exe /t >nul 2>&1
timeout /t 2 /nobreak >nul

:: Get server IP
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /C:"IPv4 Address" ^| findstr /V "127.0.0.1"') do (
    set SERVER_IP=%%i
    goto :found_ip
)
:found_ip
set SERVER_IP=%SERVER_IP:~1%

echo [INFO] Starting BCL Backend Server...
echo [INFO] Server will be accessible at:
echo [INFO]   Local:   http://localhost:%BACKEND_PORT%
echo [INFO]   Network: http://%SERVER_IP%:%BACKEND_PORT%
echo.

cd backend
echo [INFO] Backend server starting... (window will stay open to show any errors)
echo [INFO] Press Ctrl+C in this window to stop the server
echo.
start "BCL Backend Server" /wait cmd /c "set HTTP_PORT=%BACKEND_PORT% && node server.js"

echo.
echo [INFO] Backend server stopped.
pause
