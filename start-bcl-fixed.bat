@echo off
setlocal

cd /d "%~dp0"

if not exist "%~dp0start-bcl-http.bat" (
    echo [ERROR] start-bcl-http.bat not found in %~dp0
    pause
    exit /b 1
)

echo [INFO] start-bcl-fixed.bat now delegates to start-bcl-http.bat
call "%~dp0start-bcl-http.bat" %*
exit /b %errorlevel%
