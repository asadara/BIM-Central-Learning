@echo off
echo ================================================
echo        Menambahkan Domain BCL ke Hosts File
echo ================================================
echo.
echo Script ini akan menambahkan entry berikut ke hosts file:
echo 10.0.0.90 bcl.nke.net
echo.
echo Ini diperlukan agar BCL dapat diakses via domain bcl.nke.net
echo tanpa mengetikkan IP address server.
echo.

:: Check if running as administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Running as administrator
) else (
    echo [WARNING] Not running as administrator
    echo [INFO] Hosts file biasanya memerlukan administrator privileges
    echo [INFO] Jika gagal, jalankan script ini sebagai administrator
    echo.
)

echo [INFO] Menambahkan entry ke hosts file...
echo.

:: Backup hosts file
copy "C:\Windows\System32\drivers\etc\hosts" "C:\Windows\System32\drivers\etc\hosts.backup.%date:~-4,4%%date:~-10,2%%date:~-7,2%" >nul 2>&1

:: Check if entry already exists
findstr /C:"10.0.0.90 bcl.nke.net" "C:\Windows\System32\drivers\etc\hosts" >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Entry sudah ada di hosts file
    goto :success
)

:: Add the entry
echo 10.0.0.90 bcl.nke.net >> "C:\Windows\System32\drivers\etc\hosts"

:: Verify the entry was added
findstr /C:"10.0.0.90 bcl.nke.net" "C:\Windows\System32\drivers\etc\hosts" >nul 2>&1
if %errorLevel% == 0 (
    echo [SUCCESS] Entry berhasil ditambahkan
    goto :success
) else (
    echo [ERROR] Gagal menambahkan entry ke hosts file
    echo [INFO] Pastikan menjalankan sebagai administrator
    goto :error
)

:success
echo.
echo ================================================
echo               KONFIGURASI SELESAI
echo ================================================
echo.
echo Sekarang Anda dapat mengakses BCL dengan:
echo http://bcl.nke.net
echo.
echo Jika masih tidak bisa, coba:
echo 1. Restart browser
echo 2. Clear browser cache (Ctrl+F5)
echo 3. Jalankan: ipconfig /flushdns
echo.
pause
goto :end

:error
echo.
echo ================================================
echo                 ERROR
echo ================================================
echo.
echo Gagal mengkonfigurasi hosts file.
echo.
echo Solusi:
echo 1. Jalankan script ini sebagai administrator
echo 2. Atau tambahkan manual ke hosts file:
echo    10.0.0.90 bcl.nke.net
echo.
echo Lokasi hosts file: C:\Windows\System32\drivers\etc\hosts
echo.
pause
exit /b 1

:end