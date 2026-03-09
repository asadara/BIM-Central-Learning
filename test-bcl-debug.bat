@echo off
title BCL Debug Test
color 0E

echo ===============================================================================
echo                    BCL DEBUG TEST - Checking Components
echo ===============================================================================
echo.

echo [TEST 1] Checking current directory...
echo Current directory: %CD%
echo.

echo [TEST 2] Checking BCL backend directory...
if exist "C:\BCL\backend" (
    echo [OK] Backend directory found: C:\BCL\backend
) else (
    echo [ERROR] Backend directory NOT found: C:\BCL\backend
)
echo.

echo [TEST 3] Checking server.js file...
if exist "C:\BCL\backend\server.js" (
    echo [OK] server.js found in backend directory
) else (
    echo [ERROR] server.js NOT found in backend directory
)
echo.

echo [TEST 4] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH
) else (
    echo [OK] Node.js is available
    node --version
)
echo.

echo [TEST 5] Checking dashboard file...
if exist "C:\BCL\BC-Learning-Main\elearning-assets\phase4-dashboard.html" (
    echo [OK] Dashboard file found
) else (
    echo [WARNING] Dashboard file not found
)
echo.

echo [TEST 6] Checking PowerShell...
powershell -NoProfile -Command "Write-Host '[OK] PowerShell is working'"
echo.

echo [TEST 7] Testing IP detection...
powershell -NoProfile -Command "$addrs = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '10.0.0.90' -and -not ($_.IPAddress -like '169.254.*') } | Select-Object -ExpandProperty IPAddress -Unique; if ($addrs) { Write-Host '[OK] Network interfaces detected:'; foreach ($ip in $addrs) { Write-Host \"  - $ip\" } } else { Write-Host '[WARNING] No non-loopback IP addresses found' }"
echo.

echo ===============================================================================
echo                              DEBUG COMPLETE
echo ===============================================================================
echo.
echo Press any key to run the original start-bcl-fixed.bat...
pause

echo.
echo [INFO] Running original batch file...
call "C:\BCL\start-bcl-fixed.bat"
