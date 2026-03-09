@echo off
chcp 65001 >nul
title BCL Nginx Setup

echo ================================================================================
echo                   BCL NGINX SETUP - PROJECT LOCATION
echo ================================================================================
echo.

:: Set paths
set "NGINX_VERSION=nginx-1.28.0"
set "NGINX_DIR=%~dp0nginx\%NGINX_VERSION%"
set "NGINX_ZIP=%NGINX_VERSION%.zip"
set "DOWNLOAD_URL=http://nginx.org/download/%NGINX_ZIP%"

echo [INFO] Target installation directory: %NGINX_DIR%
echo.

:: Check if already installed
if exist "%NGINX_DIR%\nginx.exe" (
    echo [OK] Nginx already installed at: %NGINX_DIR%
    goto :test_config
)

:: Create nginx directory
if not exist "%~dp0nginx" mkdir "%~dp0nginx"

:: Download nginx
echo [INFO] Downloading Nginx %NGINX_VERSION%...
powershell -Command "Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%NGINX_ZIP%'" 2>nul
if errorlevel 1 (
    echo [ERROR] Failed to download nginx
    goto :error
)

:: Extract nginx
echo [INFO] Extracting nginx...
powershell -Command "Expand-Archive -Path '%NGINX_ZIP%' -DestinationPath 'nginx-temp' -Force" 2>nul
if not exist "nginx-temp\%NGINX_VERSION%" (
    echo [ERROR] Extraction failed
    goto :error
)

:: Move to final location
move "nginx-temp\%NGINX_VERSION%" "nginx\%NGINX_VERSION%" >nul 2>&1

:: Cleanup
del "%NGINX_ZIP%" 2>nul
rmdir /s /q nginx-temp 2>nul

:: Create temp directories
mkdir "%NGINX_DIR%\temp\client_body_temp" 2>nul
mkdir "%NGINX_DIR%\temp\proxy_temp" 2>nul
mkdir "%NGINX_DIR%\temp\fastcgi_temp" 2>nul
mkdir "%NGINX_DIR%\temp\uwsgi_temp" 2>nul
mkdir "%NGINX_DIR%\temp\scgi_temp" 2>nul

:test_config
echo [INFO] Testing nginx configuration...
"%NGINX_DIR%\nginx.exe" -t -p "%NGINX_DIR%" -c "conf\nginx.conf" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Configuration test failed
    goto :error
)

echo.
echo ================================================================================
echo                         ✅ NGINX SETUP COMPLETE!
echo ================================================================================
echo.
echo [LOCATION] %NGINX_DIR%
echo [CONFIG]   %NGINX_DIR%\conf\nginx.conf
echo [STATUS]   Ready for use with BCL
echo.
pause
exit /b 0

:error
echo [ERROR] Nginx setup failed!
pause
exit /b 1
