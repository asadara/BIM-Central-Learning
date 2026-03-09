@echo off
setlocal

set "TASK_NAME=BCL Auto Start (Startup Hidden)"
set "LEGACY_TASK_NAME=BCL Auto Start (Logon)"
set "FALLBACK_TASK_NAME=BCL Auto Start (Logon Hidden Fallback)"
set "REMOVED=0"

net session >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Administrator privileges are required.
    echo [ACTION] Right-click this file and choose "Run as administrator".
    exit /b 1
)

for %%T in ("%TASK_NAME%" "%LEGACY_TASK_NAME%" "%FALLBACK_TASK_NAME%") do (
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
    echo [INFO] No autostart task found.
    exit /b 0
)

echo [SUCCESS] Autostart task removed.
exit /b 0
