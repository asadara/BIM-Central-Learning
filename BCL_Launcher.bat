@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================
REM  BCL_Launcher.bat (Single Entry Point)
REM  - Start backend (if port not LISTENING)
REM  - Wait until /ping => HTTP 200
REM  - Open Enterprise Dashboard + Main page
REM  - Optional: --proxy to start nginx and open via bcl.nke.net
REM  - Optional: --no-pause to avoid blocking (for Cline/automation)
REM ============================================================

title BCL Launcher
color 0A

set "LASTSTEP=INIT"
set "ERRMSG="

REM ---- Args ----
set "NO_PAUSE=0"
set "USE_PROXY=0"

if /i "%~1"=="--no-pause" set "NO_PAUSE=1"
if /i "%~2"=="--no-pause" set "NO_PAUSE=1"
if /i "%BCL_NO_PAUSE%"=="1" set "NO_PAUSE=1"

if /i "%~1"=="--proxy" set "USE_PROXY=1"
if /i "%~2"=="--proxy" set "USE_PROXY=1"

REM ---- Config ----
set "HOST=127.0.0.1"
set "HTTP_PORT=5051"
set "BACKEND_URL=http://%HOST%:%HTTP_PORT%"
set "HEALTH_PATH=/ping"
set "DASHBOARD_PATH=/elearning-assets/phase4-dashboard.html"

set "MAX_TRIES=30"
set "SLEEP_SEC=1"

REM ---- Proxy/Nginx (only used if --proxy) ----
set "PROXY_BASE=http://bcl.nke.net"
set "NGINX_DIR=C:\nginx\nginx-1.28.0"
set "NGINX_EXE=%NGINX_DIR%\nginx.exe"
set "NGINX_CONF=%NGINX_DIR%\conf\nginx.conf"

echo ============================================================
echo  Starting BCL Server and Opening Dashboard and Main Page
echo ============================================================
echo  Mode: %USE_PROXY% (0=direct, 1=proxy)
echo.

REM ---- Preconditions ----
set "LASTSTEP=CHECK_NODE"
where node.exe >nul 2>&1
if errorlevel 1 (
  set "ERRMSG=node.exe not found in PATH"
  goto :error_exit
)

set "LASTSTEP=CHECK_CURL"
where curl.exe >nul 2>&1
if errorlevel 1 (
  set "ERRMSG=curl.exe not found in PATH (Windows 10/11 usually includes it)"
  goto :error_exit
)

REM ---- Resolve ROOT from script location ----
set "LASTSTEP=RESOLVE_ROOT"
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

REM ---- Detect server.js location ----
set "LASTSTEP=DETECT_SERVER_JS"
set "SERVER_JS="
if exist "%ROOT%\backend\server.js" set "SERVER_JS=%ROOT%\backend\server.js"
if not defined SERVER_JS if exist "%ROOT%\server.js" set "SERVER_JS=%ROOT%\server.js"

if not defined SERVER_JS (
  set "ERRMSG=server.js not found in %ROOT%\backend\server.js or %ROOT%\server.js"
  goto :error_exit
)

REM ---- Check if dependencies are installed ----
set "LASTSTEP=CHECK_NODE_MODULES"
if not exist "%ROOT%\backend\node_modules" (
  set "ERRMSG=node_modules not found in %ROOT%\backend. Please run 'npm install' in the backend directory first"
  goto :error_exit
)

echo [INFO] Project root : "%ROOT%"
echo [INFO] Server entry : "%SERVER_JS%"

REM ------------------------------------------------------------
REM Check if port already LISTENING (avoid EADDRINUSE)
REM ------------------------------------------------------------
set "LASTSTEP=CHECK_PORT_5051"
echo [INFO] Checking if backend already running on port %HTTP_PORT%...
set "BACKEND_ALREADY_RUNNING=0"
netstat -ano | findstr ":%HTTP_PORT% " | findstr "LISTENING" >nul
if not errorlevel 1 (
  set "BACKEND_ALREADY_RUNNING=1"
  echo [OK] Port %HTTP_PORT% is LISTENING. Will not start another backend.
) else (
  echo [INFO] Port %HTTP_PORT% not LISTENING. Will start backend.
)

REM ------------------------------------------------------------
REM Start backend only if needed (robust quoting)
REM ------------------------------------------------------------
set "LASTSTEP=START_BACKEND"
if "%BACKEND_ALREADY_RUNNING%"=="0" (
  echo [INFO] Starting backend in new window...
  REM Start backend with proper error handling
  start "BCL Backend" cmd /k "cd /d %ROOT% && node %SERVER_JS%"
  REM give it a short moment to begin binding the port
  timeout /t 2 >nul
) else (
  echo [INFO] Skipping backend start (already running).
)

REM ------------------------------------------------------------
REM Wait backend readiness (/ping must be HTTP 200)
REM ------------------------------------------------------------
set "LASTSTEP=WAIT_BACKEND_READY"
echo.
echo [INFO] Waiting backend ready at %BACKEND_URL%%HEALTH_PATH%

set "READY=0"
for /L %%i in (1,1,%MAX_TRIES%) do (
  set "CODE="
for /f %%H in ('curl.exe -s -o nul -m 2 -w %%{http_code} %BACKEND_URL%%HEALTH_PATH%') do set "CODE=%%H"

  if "!CODE!"=="200" (
    set "READY=1"
    echo [OK] Backend ready (HTTP 200) on attempt %%i/%MAX_TRIES%.
    goto :after_backend_ready
  )

  if "!CODE!"=="" (
    echo   ...attempt %%i/%MAX_TRIES% (connecting...)
  ) else (
    echo   ...attempt %%i/%MAX_TRIES% (http !CODE!)
  )
  timeout /t %SLEEP_SEC% >nul
)

set "ERRMSG=Backend did not become ready (ping never returned 200). Check the 'BCL Backend' window/logs."
goto :error_exit

:after_backend_ready
REM ------------------------------------------------------------
REM Optional proxy mode: start nginx then open via bcl.nke.net
REM ------------------------------------------------------------
if "%USE_PROXY%"=="1" goto :proxy_mode

REM ---- Direct mode: open via 5051 ----
set "LASTSTEP=OPEN_DIRECT"
echo.
echo [INFO] Opening Enterprise Dashboard (direct):
echo        %BACKEND_URL%%DASHBOARD_PATH%
start "" "http://127.0.0.1:5051/elearning-assets/phase4-dashboard.html"

echo [INFO] Opening Main BCL page (direct):
echo        %BACKEND_URL%/
start "" "http://127.0.0.1:5051/"

goto :done_ok

:proxy_mode
set "LASTSTEP=CHECK_NGINX_FILES"
echo.
echo [INFO] Proxy mode enabled. Starting nginx and opening %PROXY_BASE% ...

if not exist "%NGINX_EXE%" (
  set "ERRMSG=nginx.exe not found at %NGINX_EXE%"
  goto :error_exit
)
if not exist "%NGINX_CONF%" (
  set "ERRMSG=nginx.conf not found at %NGINX_CONF%"
  goto :error_exit
)

set "LASTSTEP=NGINX_TEST"
"%NGINX_EXE%" -p "%NGINX_DIR%" -c "conf\nginx.conf" -t >nul 2>&1
if errorlevel 1 (
  set "ERRMSG=nginx config test FAILED. Run: ""%NGINX_EXE%"" -p ""%NGINX_DIR%"" -c ""conf\nginx.conf"" -t"
  goto :error_exit
)

set "LASTSTEP=NGINX_START_OR_RELOAD"
"%NGINX_EXE%" -p "%NGINX_DIR%" -c "conf\nginx.conf" -s reload >nul 2>&1
if errorlevel 1 (
  "%NGINX_EXE%" -p "%NGINX_DIR%" -c "conf\nginx.conf" >nul 2>&1
)

set "LASTSTEP=WAIT_PROXY_READY"
echo [INFO] Waiting proxy ready at %PROXY_BASE%/
set "PROXY_READY=0"

for /L %%i in (1,1,%MAX_TRIES%) do (
  set "PCODE="
  for /f %%H in ('curl.exe -s -o nul -m 2 -w %%{http_code} %PROXY_BASE%/') do set "PCODE=%%H"

  if "!PCODE!"=="200" set "PROXY_READY=1"
  if "!PCODE!"=="301" set "PROXY_READY=1"
  if "!PCODE!"=="302" set "PROXY_READY=1"
  if "!PCODE!"=="304" set "PROXY_READY=1"

  if "!PROXY_READY!"=="1" (
    echo [OK] Proxy reachable (HTTP !PCODE!) on attempt %%i/%MAX_TRIES%.
    goto :open_proxy
  )

  if "!PCODE!"=="" (
    echo   ...attempt %%i/%MAX_TRIES% (connecting...^)
  ) else (
    echo   ...attempt %%i/%MAX_TRIES% (http !PCODE!^)
  )
  timeout /t %SLEEP_SEC% >nul
)

set "ERRMSG=Proxy not reachable on port 80. Check: netstat -ano ^| findstr "":80"" and nginx logs."
goto :error_exit

:open_proxy
set "LASTSTEP=OPEN_PROXY"
echo.
echo [INFO] Opening Enterprise Dashboard (proxy):
echo        %PROXY_BASE%%DASHBOARD_PATH%
start "" "http://bcl.nke.net/elearning-assets/phase4-dashboard.html"

echo [INFO] Opening Main BCL page (proxy):
echo        %PROXY_BASE%/
start "" "http://bcl.nke.net/"

goto :done_ok

:done_ok
echo.
echo ============================================================
echo  DONE
echo  Backend : %BACKEND_URL%
if "%USE_PROXY%"=="1" echo  Proxy   : %PROXY_BASE%/
echo ============================================================
if "%NO_PAUSE%"=="0" pause
exit /b 0

:error_exit
echo.
echo ============================================================
echo  LAUNCH FAILED
echo ============================================================
echo  Last step: %LASTSTEP%
if defined ERRMSG echo  Reason  : %ERRMSG%
echo.
if "%NO_PAUSE%"=="0" pause
exit /b 1
