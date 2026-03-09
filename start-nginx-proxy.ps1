# PowerShell script to start Nginx reverse proxy for BCL
# This script can be added to Windows startup or run manually

Write-Host "Starting BCL Nginx Reverse Proxy with HTTPS..." -ForegroundColor Green

# Check if Nginx is already running
$nginxProcess = Get-Process nginx -ErrorAction SilentlyContinue
if ($nginxProcess) {
    Write-Host "Nginx is already running (PID: $($nginxProcess.Id))" -ForegroundColor Yellow
    exit 0
}

# Start Nginx
$nginxPath = "C:\nginx\nginx-1.28.0\nginx.exe"
$configPath = "C:\nginx\nginx-1.28.0\conf\nginx.conf"

Write-Host "Starting Nginx with config: $configPath" -ForegroundColor Cyan

try {
    Start-Process -FilePath $nginxPath -ArgumentList "-c", $configPath -WindowStyle Hidden -ErrorAction Stop
    Start-Sleep -Seconds 2

    # Verify Nginx started
    $nginxProcess = Get-Process nginx -ErrorAction SilentlyContinue
    if ($nginxProcess) {
        Write-Host "✅ Nginx started successfully (PID: $($nginxProcess.Id))" -ForegroundColor Green
        Write-Host "🔒 HTTPS Reverse proxy running:" -ForegroundColor Green
        Write-Host "   • HTTPS: https://bcl.nke.net (port 443)" -ForegroundColor Green
        Write-Host "   • HTTP redirects to HTTPS automatically" -ForegroundColor Cyan
        Write-Host "🔄 Proxying to http://localhost:5051" -ForegroundColor Cyan
        Write-Host "" -ForegroundColor White
        Write-Host "⚠️  Note: Self-signed certificate - browser may show security warning" -ForegroundColor Yellow
        Write-Host "   Click 'Advanced' → 'Proceed to bcl.nke.net (unsafe)' to continue" -ForegroundColor Yellow
    }
    else {
        Write-Host "❌ Failed to start Nginx" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "❌ Error starting Nginx: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "HTTPS reverse proxy setup complete!" -ForegroundColor Green
