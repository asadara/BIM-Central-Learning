# Start BCL Server in HTTP-only mode
Write-Host "Starting BCL Server in HTTP-only mode..." -ForegroundColor Cyan
Write-Host ""

$env:USE_HTTPS = "false"
$env:HTTP_PORT = "5150"

Set-Location "C:\BCL\backend"
node server.js
