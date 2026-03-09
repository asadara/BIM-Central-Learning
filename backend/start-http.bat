@echo off
echo Starting BCL Server in HTTP-only mode...
echo.
set USE_HTTPS=false
set PORT=5150
cd /d "C:\BCL\backend"
node server.js
pause
