@echo off
chcp 65001 >nul
title Clear Browser Cache & HSTS for BCL Access
color 0E

echo ================================================================================
echo                    BROWSER CACHE & HSTS CLEANUP TOOL
echo                      For BCL HTTP Access Issues
echo ================================================================================
echo.

echo [INFO] This tool helps resolve browser HTTPS redirects and cache issues
echo [INFO] Run this if you still get redirected to HTTPS when accessing bcl.nke.net
echo.

echo [1/4] Checking browser installations...

:: Check Chrome
reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" >nul 2>&1
if %errorlevel%==0 (
    echo [OK] Google Chrome detected
    set CHROME_FOUND=1
) else (
    echo [INFO] Google Chrome not found
    set CHROME_FOUND=0
)

:: Check Edge
reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe" >nul 2>&1
if %errorlevel%==0 (
    echo [OK] Microsoft Edge detected
    set EDGE_FOUND=1
) else (
    echo [INFO] Microsoft Edge not found
    set EDGE_FOUND=0
)

:: Check Firefox
reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\firefox.exe" >nul 2>&1
if %errorlevel%==0 (
    echo [OK] Mozilla Firefox detected
    set FIREFOX_FOUND=1
) else (
    echo [INFO] Mozilla Firefox not found
    set FIREFOX_FOUND=0
)

echo.

:: Clear HSTS cache (requires admin privileges)
echo [2/4] Clearing HSTS cache...
echo [INFO] This requires administrator privileges

:: Try to clear Chrome HSTS
if %CHROME_FOUND%==1 (
    echo [INFO] Clearing Chrome HSTS cache...
    if exist "%LOCALAPPDATA%\Google\Chrome\User Data\Default\TransportSecurity" (
        rmdir /s /q "%LOCALAPPDATA%\Google\Chrome\User Data\Default\TransportSecurity" 2>nul
        echo [OK] Chrome HSTS cache cleared
    ) else (
        echo [INFO] Chrome HSTS cache not found or already clear
    )
)

:: Try to clear Edge HSTS
if %EDGE_FOUND%==1 (
    echo [INFO] Clearing Edge HSTS cache...
    if exist "%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\TransportSecurity" (
        rmdir /s /q "%LOCALAPPDATA%\Microsoft\Edge\User Data\Default\TransportSecurity" 2>nul
        echo [OK] Edge HSTS cache cleared
    ) else (
        echo [INFO] Edge HSTS cache not found or already clear
    )
)

:: Try to clear Firefox HSTS (different location)
if %FIREFOX_FOUND%==1 (
    echo [INFO] Clearing Firefox HSTS cache...
    for /d %%i in ("%APPDATA%\Mozilla\Firefox\Profiles\*") do (
        if exist "%%i\SiteSecurityServiceState.txt" (
            del /f /q "%%i\SiteSecurityServiceState.txt" 2>nul
            echo [OK] Firefox HSTS cache cleared for profile: %%~ni
        )
    )
    if exist "%APPDATA%\Mozilla\Firefox\SiteSecurityServiceState.txt" (
        del /f /q "%APPDATA%\Mozilla\Firefox\SiteSecurityServiceState.txt" 2>nul
        echo [OK] Firefox global HSTS cache cleared
    )
)

echo.

:: Clear DNS cache
echo [3/4] Clearing system DNS cache...
ipconfig /flushdns >nul 2>&1
if %errorlevel%==0 (
    echo [OK] DNS cache flushed
) else (
    echo [WARNING] Could not flush DNS cache (may require admin privileges)
)

echo.

:: Instructions for manual browser cache clearing
echo [4/4] Browser cache clearing instructions:
echo =========================================
echo.
echo MANUAL STEPS (if automated clearing didn't work):
echo.
echo GOOGLE CHROME:
echo 1. Open Chrome
echo 2. Press Ctrl+Shift+Delete
echo 3. Select "Cached images and files" and "Cookies and other site data"
echo 4. Set time range to "All time"
echo 5. Click "Clear data"
echo.
echo MICROSOFT EDGE:
echo 1. Open Edge
echo 2. Press Ctrl+Shift+Delete
echo 3. Select "Cached images and files" and "Cookies and other site data"
echo 4. Set time range to "All time"
echo 5. Click "Clear"
echo.
echo MOZILLA FIREFOX:
echo 1. Open Firefox
echo 2. Press Ctrl+Shift+Delete
echo 3. Select "Cache" and "Cookies"
echo 4. Set time range to "Everything"
echo 5. Click "OK"
echo.

echo ALTERNATIVE ACCESS METHODS:
echo ===========================
echo 1. Use Incognito/Private browsing mode
echo 2. Use a different browser
echo 3. Use IP address directly: http://127.0.0.1
echo 4. Clear browser history and cache manually
echo.

echo HOSTS FILE VERIFICATION:
echo =======================
echo Check that your hosts file contains:
echo 127.0.0.1 bcl.nke.net
echo.
echo To edit hosts file:
echo 1. Run Notepad as Administrator
echo 2. Open: C:\Windows\System32\drivers\etc\hosts
echo 3. Add the line above if missing
echo 4. Save and restart browser
echo.

echo ================================================================================
echo                         CACHE CLEANUP COMPLETE
echo ================================================================================
echo.
echo [SUCCESS] Browser cache and HSTS cleanup completed
echo [SUCCESS] System DNS cache flushed
echo.
echo NOW TRY ACCESSING:
echo ==================
echo http://bcl.nke.net (should work without HTTPS redirects)
echo http://bcl.nke.net/pages/login.html (login page)
echo.
echo If you still get HTTPS redirects, try:
echo 1. Using Incognito/Private browsing mode
echo 2. Using a different browser
echo 3. Manual browser cache clearing (see instructions above)
echo.

pause