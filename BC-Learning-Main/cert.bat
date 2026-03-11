@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "DOMAIN=bcl.nke.net"
set "SERVER_IP=10.0.0.90"
set "CA_FILE=bcl-lan-root-ca.crt"
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_CA_PATH=%SCRIPT_DIR%%CA_FILE%"
set "CA_PATH=%TEMP%\%CA_FILE%"
set "CA_URL_HTTP_DOMAIN=http://%DOMAIN%/certs/%CA_FILE%"
set "CA_URL_HTTP_IP=http://%SERVER_IP%/certs/%CA_FILE%"
set "CA_URL_HTTPS_DOMAIN=https://%DOMAIN%/certs/%CA_FILE%"
set "HOSTS_FILE=%SystemRoot%\System32\drivers\etc\hosts"
set "HOSTS_TMP=%TEMP%\bcl-hosts-%RANDOM%.tmp"
set "SKIP_ELEVATE=0"
set "INSTALL_MODE=full"
set "OPEN_URL=https://%DOMAIN%/?cert=installed"
if /I "%~1"=="--skip-elevate" set "SKIP_ELEVATE=1"

title BCL LAN Root CA Installer
color 0A
echo ================================================================
echo               BCL LAN HTTPS Trusted Installer
echo ================================================================
echo Domain   : %DOMAIN%
echo Server IP: %SERVER_IP%
echo.

set "IS_ADMIN=0"
net session >nul 2>&1
if %errorlevel% equ 0 set "IS_ADMIN=1"

if "%IS_ADMIN%"=="1" (
  echo [OK] Running as Administrator
) else (
  if "%SKIP_ELEVATE%"=="0" (
    echo [INFO] Requesting Administrator privileges...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -ArgumentList '--skip-elevate' -Verb RunAs" >nul 2>&1
    if !errorlevel! equ 0 (
      echo [OK] Elevated installer launched.
      exit /b 0
    )
    echo [WARN] Elevation skipped or canceled.
  )
  set "INSTALL_MODE=partial"
  set "OPEN_URL=https://%SERVER_IP%/?cert=installed"
  echo [INFO] Continuing in Current User mode
  echo [INFO] Certificate will be installed to Current User trust store
  echo [INFO] Hosts update will be skipped without Administrator privileges
)
echo.

echo [1/3] Preparing Root CA certificate...
if exist "%CA_PATH%" del /q "%CA_PATH%" >nul 2>&1

call :download "%CA_URL_HTTP_DOMAIN%"
if not exist "%CA_PATH%" call :download "%CA_URL_HTTP_IP%"
if not exist "%CA_PATH%" call :download "%CA_URL_HTTPS_DOMAIN%"

if not exist "%CA_PATH%" if exist "%SCRIPT_CA_PATH%" (
  echo [WARN] Download failed. Trying local certificate copy next to installer...
  copy /Y "%SCRIPT_CA_PATH%" "%CA_PATH%" >nul
  call :validate_cert "%CA_PATH%"
  if !errorlevel! equ 0 (
    echo [OK] Local certificate copy is valid.
  ) else (
    echo [ERROR] Local certificate copy is invalid.
    del /q "%CA_PATH%" >nul 2>&1
  )
)

if not exist "%CA_PATH%" (
  echo [ERROR] Failed to obtain %CA_FILE%
  echo [INFO] Ensure server is online, then open:
  echo        %CA_URL_HTTP_IP%
  pause
  exit /b 1
)

echo [2/3] Installing Root CA to trusted store...
if "%IS_ADMIN%"=="1" (
  certutil -addstore -f Root "%CA_PATH%" >nul
) else (
  certutil -user -addstore -f Root "%CA_PATH%" >nul
)
if %errorlevel% neq 0 (
  echo [ERROR] Failed to import certificate into trust store.
  echo [INFO] Verify that %CA_PATH% is a valid certificate file.
  pause
  exit /b 1
)
echo [OK] Root CA installed.

echo [3/3] Ensuring hosts mapping for %DOMAIN%...
if "%IS_ADMIN%"=="1" (
  findstr /I /V /C:"bcl.nke.net" "%HOSTS_FILE%" > "%HOSTS_TMP%"
  if %errorlevel% gtr 1 (
    echo [ERROR] Failed to read hosts file.
    pause
    exit /b 1
  )
  echo %SERVER_IP% %DOMAIN%>> "%HOSTS_TMP%"
  copy /Y "%HOSTS_TMP%" "%HOSTS_FILE%" >nul
  if %errorlevel% neq 0 (
    del /q "%HOSTS_TMP%" >nul 2>&1
    echo [ERROR] Failed to update hosts file.
    echo [INFO] Run this installer as Administrator.
    pause
    exit /b 1
  )
  del /q "%HOSTS_TMP%" >nul 2>&1
  ipconfig /flushdns >nul 2>&1
  echo [OK] Hosts file updated: %SERVER_IP% %DOMAIN%
) else (
  echo [WARN] Hosts file skipped because installer is not running as Administrator.
  echo [INFO] Add this line manually to hosts if needed:
  echo        %SERVER_IP% %DOMAIN%
  echo [INFO] If %DOMAIN% still shows warning, use https://%SERVER_IP% first after install.
)

echo.
echo ================================================================
if "%INSTALL_MODE%"=="full" (
  echo                     FULL INSTALL COMPLETE
) else (
  echo                   PARTIAL INSTALL COMPLETE
)
echo ================================================================
echo Trusted certificate installed from:
echo   %CA_PATH%
echo.
if "%INSTALL_MODE%"=="full" (
  echo Access URL:
  echo   https://%DOMAIN%
  echo   https://%SERVER_IP%
) else (
  echo Access URL for now:
  echo   https://%SERVER_IP%
  echo.
  echo To fully trust https://%DOMAIN%, rerun this installer as Administrator
  echo or add this hosts entry manually:
  echo   %SERVER_IP% %DOMAIN%
)
echo.
echo If this device used browser during install, close and reopen browser.
echo.
start "" "%OPEN_URL%"
pause
del /q "%CA_PATH%" >nul 2>&1
endlocal
exit /b 0

:download
set "TRY_URL=%~1"
echo [INFO] Downloading from %TRY_URL%
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; [Net.ServicePointManager]::ServerCertificateValidationCallback={ $true }; Invoke-WebRequest -UseBasicParsing -Uri '%TRY_URL%' -OutFile '%CA_PATH%'" >nul 2>&1
if exist "%CA_PATH%" (
  call :validate_cert "%CA_PATH%"
  if !errorlevel! equ 0 (
    echo [OK] Certificate downloaded and validated.
    exit /b 0
  )
  del /q "%CA_PATH%" >nul 2>&1
  echo [WARN] Downloaded file from %TRY_URL% is not a valid certificate.
)
where curl.exe >nul 2>&1
if !errorlevel! equ 0 (
  curl.exe -k -L --connect-timeout 8 -o "%CA_PATH%" "%TRY_URL%" >nul 2>&1
  if exist "%CA_PATH%" (
    call :validate_cert "%CA_PATH%"
    if !errorlevel! equ 0 (
      echo [OK] Certificate downloaded and validated via curl.
      exit /b 0
    )
    del /q "%CA_PATH%" >nul 2>&1
    echo [WARN] curl downloaded a non-certificate response from %TRY_URL%
  )
)
echo [WARN] Download failed from %TRY_URL%
exit /b 0

:validate_cert
set "CERT_TO_CHECK=%~1"
if not exist "%CERT_TO_CHECK%" exit /b 1
certutil -dump "%CERT_TO_CHECK%" >nul 2>&1
if %errorlevel% neq 0 exit /b 1
exit /b 0
