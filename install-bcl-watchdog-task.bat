@echo off
setlocal

set "TASK_NAME=BCL Watchdog (5m)"
set "USER_TASK_NAME=BCL PC-BIM02 Watchdog (User 5m)"
set "TASK_SCRIPT=C:\BCL\watchdog-bcl.bat"
set "TASK_CMD=cmd.exe /c \"C:\BCL\watchdog-bcl.bat\""
set "TASK_USER=%USERDOMAIN%\%USERNAME%"
set "TASK_RUN_AS=SYSTEM"
set "TASK_MODE_NOTE=SYSTEM / core boot recovery"

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

for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$svc = Get-Service | Where-Object { $_.Name -like 'postgresql*' -or $_.DisplayName -like 'PostgreSQL*' } | Sort-Object Name | Select-Object -First 1 -ExpandProperty Name; if ($svc) { Write-Output $svc }"`) do set "NATIVE_PG_SERVICE=%%i"

if not defined NATIVE_PG_SERVICE (
    echo [WARNING] Native PostgreSQL service was not detected. Core watchdog will still be created.
)

echo [INFO] Creating/updating core scheduled task: %TASK_NAME%
schtasks /Create /TN "%TASK_NAME%" /SC MINUTE /MO 5 /TR "%TASK_CMD%" /RU "%TASK_RUN_AS%" /RL HIGHEST /F
if errorlevel 1 (
    echo [ERROR] Failed to create core watchdog task.
    exit /b 1
)

echo [INFO] Creating/updating user PC-BIM02 scheduled task: %USER_TASK_NAME%
schtasks /Create /TN "%USER_TASK_NAME%" /SC MINUTE /MO 5 /TR "%TASK_CMD%" /RU "%TASK_USER%" /IT /RL HIGHEST /F
if errorlevel 1 (
    echo [ERROR] Failed to create user PC-BIM02 watchdog task.
    exit /b 1
)

echo [SUCCESS] Watchdog tasks created.
echo [INFO] Core trigger: every 5 minutes, highest privileges.
echo [INFO] Run as: %TASK_RUN_AS%
echo [INFO] Mode: %TASK_MODE_NOTE%
echo [INFO] Command: %TASK_CMD%
echo [INFO] PC-BIM02 trigger: every 5 minutes while user is logged on.
echo [INFO] Run as: %TASK_USER%
echo [INFO] Mode: interactive user context for UNC recovery.
echo.
schtasks /Query /TN "%TASK_NAME%" /FO LIST /V
echo.
schtasks /Query /TN "%USER_TASK_NAME%" /FO LIST /V
exit /b 0
