@echo off
setlocal

set "TASK_NAME=BCL Auto Start (Startup Hidden)"
set "LEGACY_TASK_NAME=BCL Auto Start (Logon)"
set "FALLBACK_TASK_NAME=BCL Auto Start (Logon Hidden Fallback)"
set "TASK_SCRIPT=C:\BCL\start-bcl-http-hidden.bat"
set "TASK_CMD=cmd.exe /c \"C:\BCL\start-bcl-http-hidden.bat\""
set "FALLBACK_SCRIPT=C:\BCL\start-bcl-http-logon-fallback.bat"
set "FALLBACK_CMD=cmd.exe /c \"C:\BCL\start-bcl-http-logon-fallback.bat\""
set "TASK_USER=%USERDOMAIN%\%USERNAME%"

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
if not exist "%FALLBACK_SCRIPT%" (
    echo [ERROR] Fallback script not found: %FALLBACK_SCRIPT%
    exit /b 1
)

schtasks /Query /TN "%LEGACY_TASK_NAME%" >nul 2>&1
if not errorlevel 1 (
    echo [INFO] Removing legacy task: %LEGACY_TASK_NAME%
    schtasks /Delete /TN "%LEGACY_TASK_NAME%" /F >nul 2>&1
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
echo [INFO] Note: This is the primary path for native PostgreSQL runtime.
echo.
echo [INFO] Creating/updating fallback scheduled task: %FALLBACK_TASK_NAME%
schtasks /Create /TN "%FALLBACK_TASK_NAME%" /SC ONLOGON /RU "%TASK_USER%" /RL HIGHEST /DELAY 0001:00 /TR "%FALLBACK_CMD%" /F
if errorlevel 1 (
    echo [ERROR] Failed to create fallback scheduled task.
    exit /b 1
)

echo [SUCCESS] Fallback scheduled task created.
echo [INFO] Trigger: At user logon, delay 60 seconds, highest privileges.
echo [INFO] Run as: %TASK_USER%
echo [INFO] Command: %FALLBACK_CMD%
echo [INFO] Note: This is a safety net when user-session components are still needed.
echo.
echo [INFO] Verifying task details...
schtasks /Query /TN "%TASK_NAME%" /FO LIST /V
echo.
schtasks /Query /TN "%FALLBACK_TASK_NAME%" /FO LIST /V
exit /b 0
