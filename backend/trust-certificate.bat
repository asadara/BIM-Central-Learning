@echo off
title Trust BCL SSL Certificate for LAN Environment
color 0A

echo ===============================================================================
echo           TRUST BCL SSL CERTIFICATE FOR LAN ENVIRONMENT
echo ===============================================================================
echo.
echo This script will help you trust the BCL SSL certificate to remove
echo the "Not Secure" warning in your browser.
echo.
echo IMPORTANT: Run this as Administrator for system-wide trust
echo.

:: Check if running as administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Running as Administrator
) else (
    echo [WARNING] Not running as Administrator
    echo [INFO] Some operations may fail - try running as Administrator
    pause
)

echo.
echo [1/3] Creating certificate trust script...
echo.

:: Create PowerShell script to trust certificate
echo # Trust BCL SSL Certificate > trust-cert.ps1
echo # Run this script as Administrator to trust the certificate >> trust-cert.ps1
echo. >> trust-cert.ps1
echo # Import certificate to Trusted Root store >> trust-cert.ps1
echo $certPath = "$PSScriptRoot\bcl.crt" >> trust-cert.ps1
echo if (Test-Path $certPath) { >> trust-cert.ps1
echo     try { >> trust-cert.ps1
echo         $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 >> trust-cert.ps1
echo         $cert.Import($certPath) >> trust-cert.ps1
echo         $store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine") >> trust-cert.ps1
echo         $store.Open("ReadWrite") >> trust-cert.ps1
echo         $store.Add($cert) >> trust-cert.ps1
echo         $store.Close() >> trust-cert.ps1
echo         Write-Host "[SUCCESS] Certificate trusted successfully!" >> trust-cert.ps1
echo         Write-Host "Restart your browser and visit https://10.0.0.90:5052/" >> trust-cert.ps1
echo     } catch { >> trust-cert.ps1
echo         Write-Host "[ERROR] Failed to trust certificate: $($_.Exception.Message)" >> trust-cert.ps1
echo     } >> trust-cert.ps1
echo } else { >> trust-cert.ps1
echo     Write-Host "[ERROR] Certificate file not found: $certPath" >> trust-cert.ps1
echo } >> trust-cert.ps1

echo [2/3] Running certificate trust script...
powershell -ExecutionPolicy Bypass -File trust-cert.ps1

echo.
echo [3/3] Cleanup...
if exist trust-cert.ps1 del trust-cert.ps1

echo.
echo ===============================================================================
echo                       CERTIFICATE TRUST PROCESS COMPLETE
echo ===============================================================================
echo.
echo If successful, restart your browser and visit:
echo   https://10.0.0.90:5052/
echo.
echo The "Not Secure" warning should be gone!
echo.
echo If you see errors above, you may need to:
echo 1. Run this script as Administrator (right-click ^> Run as Administrator)
echo 2. Or manually import bcl.crt to Trusted Root Certification Authorities
echo.

pause
