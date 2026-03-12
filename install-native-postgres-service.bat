@echo off
setlocal

if exist "%~dp0.env" (
    for /f "usebackq tokens=1* delims==" %%A in (`findstr /R "^[A-Za-z_][A-Za-z0-9_]*=" "%~dp0.env"`) do (
        if /I "%%A"=="DB_PASSWORD" if not defined DB_PASSWORD set "DB_PASSWORD=%%B"
        if /I "%%A"=="POSTGRES_ADMIN_PASSWORD" if not defined POSTGRES_ADMIN_PASSWORD set "POSTGRES_ADMIN_PASSWORD=%%B"
    )
)

set "POSTGRES_PASSWORD=%POSTGRES_ADMIN_PASSWORD%"
if not defined POSTGRES_PASSWORD set "POSTGRES_PASSWORD=%DB_PASSWORD%"
if not defined POSTGRES_PASSWORD (
    echo [ERROR] DB_PASSWORD or POSTGRES_ADMIN_PASSWORD must be set before installation.
    echo [ACTION] Define the value in .env or current shell environment and rerun this script.
    exit /b 1
)

set "CHOCOPKG=postgresql15"
set "NATIVE_SERVICE="

net session >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Administrator privileges are required.
    echo [ACTION] Right-click this file and choose "Run as administrator".
    exit /b 1
)

for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$svc = Get-Service | Where-Object { $_.Name -like 'postgresql*' -or $_.DisplayName -like 'PostgreSQL*' } | Sort-Object Name | Select-Object -First 1 -ExpandProperty Name; if ($svc) { Write-Output $svc }"`) do set "NATIVE_SERVICE=%%i"

if not defined NATIVE_SERVICE (
    docker inspect bcl-postgres >nul 2>&1
    if not errorlevel 1 (
        echo [INFO] Creating Docker PostgreSQL backup before cutover...
        powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup-bcl-postgres-docker.ps1"
        if errorlevel 1 (
            echo [ERROR] Docker PostgreSQL backup failed.
            exit /b 1
        )

        echo [INFO] Stopping Docker PostgreSQL stack to free port 5432...
        docker compose -f "%~dp0docker-compose.postgres.yml" down
        if errorlevel 1 (
            echo [WARNING] docker compose down reported an error. Continuing with install attempt...
        )
    ) else (
        echo [INFO] Docker PostgreSQL container not found. Skipping Docker backup/cutover stage.
    )

    echo [INFO] Installing PostgreSQL Windows service via Chocolatey...
    choco install %CHOCOPKG% -y --params "'/Password:%POSTGRES_PASSWORD% /Port:5432'" --ia "'--enable-components server,commandlinetools'"
    if errorlevel 1 (
        echo [ERROR] PostgreSQL installation failed.
        exit /b 1
    )
) else (
    echo [INFO] Native PostgreSQL service already detected: %NATIVE_SERVICE%
    echo [INFO] Skipping package installation and continuing with restore/task setup.
)

echo [INFO] Restoring BCL database backup into native PostgreSQL...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0restore-native-postgres.ps1" -AdminPassword "%POSTGRES_PASSWORD%" -AppPassword "%DB_PASSWORD%"
if errorlevel 1 (
    echo [ERROR] Native PostgreSQL restore failed.
    exit /b 1
)

echo [INFO] Reinstalling BCL startup and watchdog tasks for native PostgreSQL mode...
call "%~dp0install-bcl-autostart-task.bat"
if errorlevel 1 (
    echo [ERROR] Failed to install BCL autostart task.
    exit /b 1
)

call "%~dp0install-bcl-watchdog-task.bat"
if errorlevel 1 (
    echo [ERROR] Failed to install BCL watchdog task.
    exit /b 1
)

echo [SUCCESS] Native PostgreSQL service installed and restored.
echo [INFO] Next step: reboot once and verify BCL starts before user login.
exit /b 0
