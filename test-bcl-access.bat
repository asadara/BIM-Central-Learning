@echo off
set "BACKEND_PORT=%BCL_BACKEND_PORT%"
if not defined BACKEND_PORT set "BACKEND_PORT=5052"

echo ================================================
echo        BCL HTTP Access Test Script
echo ================================================
echo.

echo [1/4] Checking DNS resolution...
ping -n 1 bcl.nke.net >nul 2>&1
if %errorlevel% neq 0 (
    echo DNS resolution failed
    echo    Make sure hosts file contains: 10.0.0.90 bcl.nke.net
) else (
    echo DNS resolution OK
)
echo.

echo [2/4] Checking nginx reverse proxy (port 80)...
powershell -NoProfile -Command "try { $tcp = New-Object System.Net.Sockets.TcpClient; $tcp.Connect('127.0.0.1', 80); echo 'Nginx port 80 accessible'; $tcp.Close() } catch { echo 'Nginx port 80 not accessible' }" 2>nul
echo.

echo [3/4] Checking backend server (port %BACKEND_PORT%)...
powershell -NoProfile -Command "try { $tcp = New-Object System.Net.Sockets.TcpClient; $tcp.Connect('127.0.0.1', %BACKEND_PORT%); echo 'Backend port %BACKEND_PORT% accessible'; $tcp.Close() } catch { echo 'Backend port %BACKEND_PORT% not accessible' }" 2>nul
echo.

echo [4/4] Testing HTTP access to bcl.nke.net...
powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri 'http://bcl.nke.net' -Method Head -TimeoutSec 5 -MaximumRedirection 0; echo 'HTTP access successful'; echo '   Status:' $response.StatusCode } catch { if ($_.Exception.Response.StatusCode -eq 302) { echo 'Redirect detected - check HSTS cache'; echo '   Solution: Clear HSTS in chrome://net-internals/#hsts' } else { echo 'HTTP access failed:'; echo '   Error:' $_.Exception.Message } }" 2>nul
echo.

echo ================================================
echo               Test Complete
echo ================================================
echo.
echo If you see redirect warnings, clear browser HSTS cache:
echo chrome://net-internals/#hsts ^> Delete bcl.nke.net
echo.
pause
