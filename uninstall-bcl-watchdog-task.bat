@echo off
setlocal

set "TASK_NAME=BCL Watchdog (5m)"
set "USER_TASK_NAME=BCL PC-BIM02 Watchdog (User 5m)"
set "REMOVED=0"

net session >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Administrator privileges are required.
    echo [ACTION] Right-click this file and choose "Run as administrator".
    exit /b 1
)

for %%T in ("%TASK_NAME%" "%USER_TASK_NAME%") do (
    schtasks /Query /TN %%~T >nul 2>&1
    if not errorlevel 1 (
        echo [INFO] Removing scheduled task: %%~T
        schtasks /Delete /TN %%~T /F >nul 2>&1
        if errorlevel 1 (
            echo [ERROR] Failed to remove task: %%~T
            exit /b 1
        )
        set "REMOVED=1"
    )
)

if "%REMOVED%"=="0" (
    echo [INFO] No watchdog task found.
    exit /b 0
)

echo [SUCCESS] Watchdog tasks removed.
exit /b 0
