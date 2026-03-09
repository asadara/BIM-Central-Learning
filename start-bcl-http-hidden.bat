@echo off
cd /d "%~dp0"
call "%~dp0start-bcl-http.bat" --hidden --boot --no-error-console %*
