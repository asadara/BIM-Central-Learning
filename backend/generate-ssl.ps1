# BCL SSL Certificate Generator (PowerShell)
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "BCL SSL Certificate Generator" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if OpenSSL is available
$opensslPath = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $opensslPath) {
    Write-Host "[ERROR] OpenSSL not found in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install OpenSSL or use one of these alternatives:" -ForegroundColor Yellow
    Write-Host "1. Install OpenSSL for Windows: https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor Yellow
    Write-Host "2. Use Git Bash (includes OpenSSL): git bash -c 'openssl version'" -ForegroundColor Yellow
    Write-Host "3. Use Windows Subsystem for Linux (WSL)" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[INFO] OpenSSL found at: $($opensslPath.Source)" -ForegroundColor Green
Write-Host ""

try {
    # Generate private key
    Write-Host "[STEP 1] Generating private key..." -ForegroundColor Yellow
    & openssl genrsa -out bcl.key 2048
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to generate private key"
    }

    # Create certificate configuration
    Write-Host "[STEP 2] Creating certificate configuration..." -ForegroundColor Yellow
    $sslConfig = @"
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=ID
ST=Jakarta
L=Jakarta
O=BCL Development
OU=IT Department
CN=localhost

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = bcl.local
DNS.3 = *.bcl.local
IP.1 = 127.0.0.1
IP.2 = ::1
"@
    
    $sslConfig | Out-File -FilePath "bcl-ssl.conf" -Encoding ASCII

    # Generate certificate
    Write-Host "[STEP 3] Generating self-signed certificate..." -ForegroundColor Yellow
    & openssl req -new -x509 -key bcl.key -out bcl.crt -days 365 -config bcl-ssl.conf -extensions v3_req
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to generate certificate"
    }

    # Clean up
    Remove-Item "bcl-ssl.conf" -ErrorAction SilentlyContinue

    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host "SSL Certificates Generated Successfully!" -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Files created:" -ForegroundColor White
    Write-Host "  • bcl.key (private key)" -ForegroundColor White
    Write-Host "  • bcl.crt (certificate)" -ForegroundColor White
    Write-Host ""
    Write-Host "Browser Security Notice:" -ForegroundColor Yellow
    Write-Host "  • These are self-signed certificates" -ForegroundColor Yellow
    Write-Host "  • Browser may still show 'Not Secure'" -ForegroundColor Yellow
    Write-Host "  • Click 'Advanced' then 'Proceed to localhost'" -ForegroundColor Yellow
    Write-Host "  • Or add certificates to Windows Certificate Store" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Restart your BCL server" -ForegroundColor Cyan
    Write-Host "  2. Access https://localhost:5150" -ForegroundColor Cyan
    Write-Host "  3. Accept the security warning" -ForegroundColor Cyan
    Write-Host ""

}
catch {
    Write-Host ""
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

Read-Host "Press Enter to exit"
