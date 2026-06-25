@echo off
setlocal

set "TASK_NAME=BCL Auto Start (Startup Hidden)"
set "LEGACY_TASK_NAME=BCL Auto Start (Logon)"
set "TASK_SCRIPT=C:\BCL\start-bcl-http-hidden.bat"
set "TASK_CMD=cmd.exe /c \"C:\BCL\start-bcl-http-hidden.bat\""
set "FALLBACK_TASK_NAME=BCL Auto Start (Logon Hidden Fallback)"
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
    echo [ERROR] Target script not found: %FALLBACK_SCRIPT%
    exit /b 1
)

for %%T in ("%LEGACY_TASK_NAME%") do (
    schtasks /Query /TN %%~T >nul 2>&1
    if not errorlevel 1 (
        echo [INFO] Removing legacy task: %%~T
        schtasks /Delete /TN %%~T /F >nul 2>&1
    )
)

echo [INFO] Creating/updating scheduled task: %TASK_NAME%
schtasks /Create /TN "%TASK_NAME%" /SC ONSTART /RU "SYSTEM" /RL HIGHEST /DELAY 0001:00 /TR "%TASK_CMD%" /F
if errorlevel 1 (
    echo [ERROR] Failed to create scheduled task.
    exit /b 1
)

echo [INFO] Creating/updating user logon readiness task: %FALLBACK_TASK_NAME%
schtasks /Create /TN "%FALLBACK_TASK_NAME%" /SC ONLOGON /RU "%TASK_USER%" /IT /RL HIGHEST /DELAY 0000:30 /TR "%FALLBACK_CMD%" /F
if errorlevel 1 (
    echo [WARNING] Failed to create delayed logon readiness task; retrying without /DELAY.
    schtasks /Create /TN "%FALLBACK_TASK_NAME%" /SC ONLOGON /RU "%TASK_USER%" /IT /RL HIGHEST /TR "%FALLBACK_CMD%" /F
    if errorlevel 1 (
        echo [ERROR] Failed to create user logon readiness task.
        exit /b 1
    )
)

echo [SUCCESS] Scheduled tasks created.
echo [INFO] Startup trigger: At system startup, delay 60 seconds, highest privileges.
echo [INFO] Run as: SYSTEM
echo [INFO] Command: %TASK_CMD%
echo [INFO] Logon readiness trigger: At user logon, highest privileges.
echo [INFO] Run as: %TASK_USER%
echo [INFO] Command: %FALLBACK_CMD%
echo [INFO] Note: core BCL starts at boot; PC-BIM02 readiness is repaired from user context after login.
echo.
echo [INFO] Verifying task details...
schtasks /Query /TN "%TASK_NAME%" /FO LIST /V
echo.
schtasks /Query /TN "%FALLBACK_TASK_NAME%" /FO LIST /V
exit /b 0
