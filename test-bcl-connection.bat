@echo off
chcp 65001 >nul
title Test BCL Connection - Troubleshooting Tool
color 0B

echo ================================================================================
echo                    BCL CONNECTION TEST & TROUBLESHOOTING
echo ================================================================================
echo.

echo [INFO] This tool tests BCL system connectivity and diagnoses issues
echo.

:: Test 1: Check hosts file
echo [1/8] Checking hosts file configuration...
findstr "bcl.nke.net" "C:\Windows\System32\drivers\etc\hosts" >nul 2>&1
if %errorlevel%==0 (
    echo [OK] bcl.nke.net found in hosts file
    for /f "tokens=*" %%i in ('findstr "127.0.0.1.*bcl.nke.net" "C:\Windows\System32\drivers\etc\hosts"') do echo [INFO] Hosts entry: %%i
) else (
    echo [ERROR] bcl.nke.net not found in hosts file!
    echo [FIX] Add this line to C:\Windows\System32\drivers\etc\hosts:
    echo       127.0.0.1 bcl.nke.net
)

echo.

:: Test 2: Check Node.js
echo [2/8] Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=*" %%i in ('node --version') do echo [OK] Node.js installed: %%i
) else (
    echo [ERROR] Node.js not found!
    echo [FIX] Install Node.js from https://nodejs.org/
)

echo.

:: Test 3: Check Nginx
echo [3/8] Checking Nginx installation...
if exist "C:\nginx\nginx-1.28.0\nginx.exe" (
    echo [OK] Nginx found at C:\nginx\nginx-1.28.0\nginx.exe
) else (
    echo [ERROR] Nginx not found at C:\nginx\nginx-1.28.0\nginx.exe
    echo [FIX] Install Nginx to the correct location
)

echo.

:: Test 4: Check if Node.js processes are running
echo [4/8] Checking running Node.js processes...
tasklist /fi "imagename eq node.exe" /nh >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=*" %%i in ('tasklist /fi "imagename eq node.exe" /nh') do echo [OK] Node.js process running: %%i
) else (
    echo [WARNING] No Node.js processes found (backend may not be running)
)

echo.

:: Test 5: Check if Nginx processes are running
echo [5/8] Checking running Nginx processes...
tasklist /fi "imagename eq nginx.exe" /nh >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=*" %%i in ('tasklist /fi "imagename eq nginx.exe" /nh') do echo [OK] Nginx process running: %%i
) else (
    echo [WARNING] No Nginx processes found (reverse proxy may not be running)
)

echo.

:: Test 6: Test localhost backend connection
echo [6/8] Testing backend server connection (localhost:5051)...
powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:5051/ping' -TimeoutSec 5 -UseBasicParsing; Write-Host '[OK] Backend server responding on port 5051' } catch { Write-Host '[ERROR] Backend server not responding on port 5051:' $_.Exception.Message }"

echo.

:: Test 7: Test Nginx reverse proxy connection
echo [7/8] Testing reverse proxy connection (bcl.nke.net:80)...
powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri 'http://bcl.nke.net/ping' -TimeoutSec 5 -UseBasicParsing; Write-Host '[OK] Reverse proxy responding on bcl.nke.net' } catch { Write-Host '[ERROR] Reverse proxy not responding on bcl.nke.net:' $_.Exception.Message }"

echo.

:: Test 8: Test main page access
echo [8/8] Testing main page access (bcl.nke.net main page)...
powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri 'http://bcl.nke.net' -TimeoutSec 10 -UseBasicParsing; Write-Host '[OK] Main page accessible - Status:' $response.StatusCode } catch { Write-Host '[ERROR] Main page not accessible:' $_.Exception.Message }"

echo.
echo ================================================================================
echo                             TEST RESULTS SUMMARY
echo ================================================================================

:: Check all conditions
set "ALL_OK=1"

:: Check hosts
findstr "127.0.0.1.*bcl.nke.net" "C:\Windows\System32\drivers\etc\hosts" >nul 2>&1
if %errorlevel% neq 0 set "ALL_OK=0"

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 set "ALL_OK=0"

:: Check Nginx
if not exist "C:\nginx\nginx-1.28.0\nginx.exe" set "ALL_OK=0"

:: Check processes
tasklist /fi "imagename eq node.exe" /nh >nul 2>&1
if %errorlevel% neq 0 set "ALL_OK=0"

tasklist /fi "imagename eq nginx.exe" /nh >nul 2>&1
if %errorlevel% neq 0 set "ALL_OK=0"

:: Check connections
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:5051/ping' -TimeoutSec 3 -UseBasicParsing | Out-Null; $backend_ok = $true } catch { $backend_ok = $false }; try { Invoke-WebRequest -Uri 'http://bcl.nke.net/ping' -TimeoutSec 3 -UseBasicParsing | Out-Null; $proxy_ok = $true } catch { $proxy_ok = $false }; if ($backend_ok -and $proxy_ok) { exit 0 } else { exit 1 }" >nul 2>&1
if %errorlevel% neq 0 set "ALL_OK=0"

if %ALL_OK%==1 (
    echo [SUCCESS] All tests passed! BCL system should be working.
    echo [ACTION] Try accessing: http://bcl.nke.net
) else (
    echo [WARNING] Some tests failed. Please check the errors above.
    echo.
    echo COMMON FIXES:
    echo =============
    echo 1. Run as Administrator if permission errors
    echo 2. Check Windows Firewall settings
    echo 3. Clear browser cache: .\clear-browser-cache.bat
    echo 4. Restart system: .\start-bcl-http.bat
    echo 5. Check if ports 80 and 5051 are not blocked
)

echo.
echo ================================================================================
echo                   CONNECTION TEST COMPLETE
echo ================================================================================

pause