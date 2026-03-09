@echo off
setlocal

set "TASK_NAME=BCL Stop On Shutdown"

net session >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Administrator privileges are required.
    echo [ACTION] Right-click this file and choose "Run as administrator".
    exit /b 1
)

echo [INFO] Removing scheduled task: %TASK_NAME%
schtasks /Delete /TN "%TASK_NAME%" /F
if errorlevel 1 (
    echo [ERROR] Failed to remove scheduled task, or task does not exist.
    exit /b 1
)

echo [SUCCESS] Scheduled task removed.
exit /b 0
