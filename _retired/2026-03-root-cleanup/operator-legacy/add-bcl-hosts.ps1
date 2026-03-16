#Requires -RunAsAdministrator

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "       Menambahkan Domain BCL ke Hosts File" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$hostsEntry = "10.0.0.90 bcl.nke.net"
$hostsPath = "$env:windir\System32\drivers\etc\hosts"

Write-Host "Script ini akan menambahkan entry berikut ke hosts file:" -ForegroundColor Yellow
Write-Host "$hostsEntry" -ForegroundColor Green
Write-Host ""
Write-Host "Ini diperlukan agar BCL dapat diakses via domain bcl.nke.net" -ForegroundColor Yellow
Write-Host "tanpa mengetikkan IP address server." -ForegroundColor Yellow
Write-Host ""

# Check if entry already exists
$hostsContent = Get-Content $hostsPath -ErrorAction SilentlyContinue
if ($hostsContent -and ($hostsContent -match [regex]::Escape($hostsEntry))) {
    Write-Host "[OK] Entry sudah ada di hosts file" -ForegroundColor Green
} else {
    # Create backup
    $backupPath = "$hostsPath.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Copy-Item $hostsPath $backupPath -ErrorAction SilentlyContinue
    Write-Host "[INFO] Backup hosts file dibuat: $backupPath" -ForegroundColor Gray

    # Add the entry
    try {
        Add-Content -Path $hostsPath -Value "" -ErrorAction Stop
        Add-Content -Path $hostsPath -Value $hostsEntry -ErrorAction Stop
        Write-Host "[SUCCESS] Entry berhasil ditambahkan ke hosts file" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Gagal menambahkan entry ke hosts file" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "Solusi manual:" -ForegroundColor Yellow
        Write-Host "1. Buka Notepad sebagai Administrator" -ForegroundColor White
        Write-Host "2. Buka file: $hostsPath" -ForegroundColor White
        Write-Host "3. Tambahkan baris: $hostsEntry" -ForegroundColor White
        exit 1
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "              KONFIGURASI SELESAI" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Sekarang Anda dapat mengakses BCL dengan:" -ForegroundColor Green
Write-Host "http://bcl.nke.net" -ForegroundColor Cyan
Write-Host ""
Write-Host "Jika masih tidak bisa, coba:" -ForegroundColor Yellow
Write-Host "1. Restart browser" -ForegroundColor White
Write-Host "2. Clear browser cache (Ctrl+F5)" -ForegroundColor White
Write-Host "3. Jalankan di Command Prompt: ipconfig /flushdns" -ForegroundColor White
Write-Host ""

Read-Host "Tekan Enter untuk keluar"