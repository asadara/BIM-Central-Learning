@echo off
setlocal

set "TASK_NAME=BCL Auto Start (Startup Hidden)"
set "LEGACY_TASK_NAME=BCL Auto Start (Logon)"
set "TASK_SCRIPT=C:\BCL\start-bcl-http-hidden.bat"
set "TASK_CMD=cmd.exe /c \"C:\BCL\start-bcl-http-hidden.bat\""

net session >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Administrator privileges are required.
    echo [ACTION] Right-click this file and choose "Run as administrator".
    exit /b 1
)

if not exist "%TASK_SCRIPT%" (
    echo [ERROR] Target script not found: %TASK_SCRIPT%
    exit /b 1
)

for %%T in ("%LEGACY_TASK_NAME%" "BCL Auto Start (Logon Hidden Fallback)") do (
    schtasks /Query /TN %%~T >nul 2>&1
    if not errorlevel 1 (
        echo [INFO] Removing legacy task: %%~T
        schtasks /Delete /TN %%~T /F >nul 2>&1
    )
)

echo [INFO] Creating/updating scheduled task: %TASK_NAME%
schtasks /Create /TN "%TASK_NAME%" /SC ONSTART /RU "SYSTEM" /RL HIGHEST /DELAY 0003:00 /TR "%TASK_CMD%" /F
if errorlevel 1 (
    echo [ERROR] Failed to create scheduled task.
    exit /b 1
)

echo [SUCCESS] Scheduled task created.
echo [INFO] Trigger: At system startup, delay 180 seconds, highest privileges.
echo [INFO] Run as: SYSTEM
echo [INFO] Command: %TASK_CMD%
echo [INFO] Note: Native PostgreSQL runtime only; no separate logon fallback task is created.
echo.
echo [INFO] Verifying task details...
schtasks /Query /TN "%TASK_NAME%" /FO LIST /V
exit /b 0
