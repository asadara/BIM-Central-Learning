@echo off
echo Testing Nginx Detection Logic...
echo ===============================

:: Initialize Nginx path variables (same logic as main script)
set "NGINX_FOUND=0"
set "NGINX_DIR="
set "NGINX_EXE="
set "NGINX_CONF="

:: Priority 1: Check NGINX_HOME environment variable
if defined NGINX_HOME (
    if exist "%NGINX_HOME%\nginx.exe" (
        set "NGINX_DIR=%NGINX_HOME%"
        set "NGINX_FOUND=1"
        echo [OK] Nginx found via NGINX_HOME: %NGINX_HOME%
    )
)

:: Priority 2: Check standard relative path (original location)
if %NGINX_FOUND% equ 0 (
    set "TEST_NGINX_DIR=%~dp0..\nginx\nginx-1.28.0"
    if exist "%TEST_NGINX_DIR%\nginx.exe" (
        set "NGINX_DIR=%TEST_NGINX_DIR%"
        set "NGINX_FOUND=1"
        echo [OK] Nginx found in standard location: %TEST_NGINX_DIR%
    )
)

:: Priority 3: Check common system locations
if %NGINX_FOUND% equ 0 (
    setlocal enabledelayedexpansion
    for %%d in ("C:\nginx" "C:\Program Files\nginx" "C:\Program Files (x86)\nginx") do (
        if exist "%%~d\nginx.exe" (
            set "NGINX_DIR=%%~d"
            set "NGINX_FOUND=1"
            echo [OK] Nginx found in system location: %%~d
            goto :nginx_found
        )
    )
    :nginx_found
    endlocal & set "NGINX_DIR=%NGINX_DIR%" & set "NGINX_FOUND=%NGINX_FOUND%"
)

:: Priority 4: Check if nginx is in PATH
if %NGINX_FOUND% equ 0 (
    where nginx >nul 2>&1
    if %errorlevel% equ 0 (
        set "NGINX_DIR=PATH"
        set "NGINX_FOUND=1"
        echo [OK] Nginx found in system PATH
    )
)

:: Final result
echo.
if %NGINX_FOUND% equ 0 (
    echo [RESULT] Nginx NOT found - system will work with direct backend access only
    echo [INFO] To add Nginx support:
    echo        1. Install Nginx from https://nginx.org
    echo        2. Set NGINX_HOME environment variable
    echo        3. Or place in standard location: %~dp0..\nginx\nginx-1.28.0
) else (
    echo [RESULT] Nginx FOUND - full reverse proxy support available
    echo [INFO] Location: %NGINX_DIR%
    if not "%NGINX_DIR%"=="PATH" (
        echo [INFO] Executable: %NGINX_DIR%\nginx.exe
        echo [INFO] Config: %NGINX_DIR%\conf\nginx.conf
    )
)

echo.
echo Test completed.
pause
