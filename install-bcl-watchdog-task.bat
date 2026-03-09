@echo off
setlocal

set "TASK_NAME=BCL Watchdog (5m)"
set "TASK_SCRIPT=C:\BCL\watchdog-bcl.bat"
set "TASK_CMD=cmd.exe /c \"C:\BCL\watchdog-bcl.bat\""
set "TASK_USER=%USERDOMAIN%\%USERNAME%"
set "TASK_RUN_AS=%TASK_USER%"
set "TASK_MODE_NOTE=Interactive only"

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
if defined NATIVE_PG_SERVICE (
    set "TASK_RUN_AS=SYSTEM"
    set "TASK_MODE_NOTE=SYSTEM / boot-capable"
)

echo [INFO] Creating/updating scheduled task: %TASK_NAME%
schtasks /Create /TN "%TASK_NAME%" /SC MINUTE /MO 5 /TR "%TASK_CMD%" /RU "%TASK_RUN_AS%" /RL HIGHEST /F
if errorlevel 1 (
    echo [ERROR] Failed to create watchdog task.
    exit /b 1
)

echo [SUCCESS] Watchdog task created.
echo [INFO] Trigger: every 5 minutes, highest privileges.
echo [INFO] Run as: %TASK_RUN_AS%
echo [INFO] Mode: %TASK_MODE_NOTE%
echo [INFO] Command: %TASK_CMD%
echo.
schtasks /Query /TN "%TASK_NAME%" /FO LIST /V
exit /b 0
