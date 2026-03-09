@echo off
setlocal

set "TASK_NAME=BCL Stop On Shutdown"
set "TASK_CMD=C:\BCL\stop-bcl-http.bat"
set "EVENT_QUERY=*[System[(EventID=1074 and Provider[@Name='USER32'])]]"

net session >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Administrator privileges are required.
    echo [ACTION] Right-click this file and choose "Run as administrator".
    exit /b 1
)

if not exist "%TASK_CMD%" (
    echo [ERROR] Target script not found: %TASK_CMD%
    exit /b 1
)

echo [INFO] Creating/updating scheduled task: %TASK_NAME%
schtasks /Create /TN "%TASK_NAME%" /SC ONEVENT /EC System /MO "%EVENT_QUERY%" /TR "%TASK_CMD%" /RU "SYSTEM" /RL HIGHEST /F
if errorlevel 1 (
    echo [ERROR] Failed to create shutdown task.
    exit /b 1
)

echo [SUCCESS] Shutdown task created.
echo [INFO] Trigger: System event USER32/1074 (shutdown or restart request)
echo [INFO] Command: %TASK_CMD%
echo.
schtasks /Query /TN "%TASK_NAME%" /FO LIST /V
exit /b 0
