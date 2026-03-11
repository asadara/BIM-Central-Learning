@echo off
echo ================================================
echo        BCL Network Access Firewall Setup
echo ================================================
echo.

echo [1/3] Adding firewall rule for HTTP port 80...
netsh advfirewall firewall add rule name="BCL HTTP Port 80" dir=in action=allow protocol=TCP localport=80
if %errorlevel% neq 0 (
    echo [ERROR] Failed to add HTTP port 80 rule
) else (
    echo [OK] HTTP port 80 rule added successfully
)
echo.

echo [2/3] Adding firewall rule for HTTPS port 443...
netsh advfirewall firewall add rule name="BCL HTTPS Port 443" dir=in action=allow protocol=TCP localport=443
if %errorlevel% neq 0 (
    echo [ERROR] Failed to add HTTPS port 443 rule
) else (
    echo [OK] HTTPS port 443 rule added successfully
)
echo.

echo [3/3] Adding firewall rule for Backend port 5052...
netsh advfirewall firewall add rule name="BCL Backend Port 5052" dir=in action=allow protocol=TCP localport=5052
if %errorlevel% neq 0 (
    echo [ERROR] Failed to add Backend port 5052 rule
) else (
    echo [OK] Backend port 5052 rule added successfully
)
echo.

echo ================================================
echo               Firewall Setup Complete
echo ================================================
echo.
echo Firewall rules added for BCL network access:
echo - Port 80  (HTTP reverse proxy)
echo - Port 443 (HTTPS reverse proxy)
echo - Port 5052 (Backend server)
echo.
echo Now other devices on the same network can access:
echo https://10.0.0.90 and https://bcl.nke.net
echo (domain requires hosts or DNS mapping to 10.0.0.90)
echo.
pause
