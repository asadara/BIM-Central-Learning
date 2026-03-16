@echo off
echo Starting BCL Server in HTTP-only mode...
echo.
set USE_HTTPS=false
set "HTTP_PORT=%BCL_BACKEND_PORT%"
if not defined HTTP_PORT set "HTTP_PORT=5052"
cd /d "C:\BCL\backend"
node server.js
pause
