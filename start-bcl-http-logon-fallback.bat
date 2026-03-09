@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"

if not exist "%~dp0start-bcl-http-hidden.bat" exit /b 1

curl.exe -s http://127.0.0.1/api/server/status -m 5 >nul 2>&1
if not errorlevel 1 exit /b 0

set "NATIVE_PG_SERVICE="
for /f "usebackq delims=" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$svc = Get-Service | Where-Object { $_.Name -like 'postgresql*' -or $_.DisplayName -like 'PostgreSQL*' } | Sort-Object Name | Select-Object -First 1 -ExpandProperty Name; if ($svc) { Write-Output $svc }"`) do set "NATIVE_PG_SERVICE=%%i"

if not defined NATIVE_PG_SERVICE (
    set "DOCKER_DESKTOP_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    if not exist "%DOCKER_DESKTOP_EXE%" set "DOCKER_DESKTOP_EXE=%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe"
    if exist "%DOCKER_DESKTOP_EXE%" (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "if (-not (Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue)) { Start-Process -WindowStyle Hidden -FilePath '%DOCKER_DESKTOP_EXE%' }" >nul 2>&1
        powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 20" >nul 2>&1
    )
)

for /l %%i in (1,1,120) do (
    if not exist "runlock" goto :start_now

    curl.exe -s http://127.0.0.1/api/server/status -m 5 >nul 2>&1
    if not errorlevel 1 exit /b 0

    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 2" >nul 2>&1
)

if exist "runlock" rmdir /s /q "runlock" >nul 2>&1

:start_now
call "%~dp0start-bcl-http-hidden.bat"
exit /b %errorlevel%
