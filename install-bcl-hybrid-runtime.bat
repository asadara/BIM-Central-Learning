@echo off
setlocal

cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Administrator privileges are required.
    echo [ACTION] Right-click this file and choose "Run as administrator".
    exit /b 1
)

echo [INFO] Installing BCL hybrid runtime tasks...
echo [INFO] Core BCL will start at boot. PC-BIM02 readiness will be checked from user context.
echo.

call "%~dp0install-bcl-autostart-task.bat"
if errorlevel 1 (
    echo [ERROR] Failed to install BCL autostart tasks.
    exit /b 1
)

echo.
call "%~dp0install-bcl-watchdog-task.bat"
if errorlevel 1 (
    echo [ERROR] Failed to install BCL watchdog tasks.
    exit /b 1
)

echo.
echo [SUCCESS] BCL hybrid runtime tasks installed.
echo [INFO] Restart the server PC to validate boot-time startup, or log off/on to validate PC-BIM02 readiness.
exit /b 0
