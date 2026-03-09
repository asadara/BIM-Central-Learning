# Manual Certificate Trust Script for BCL
# Run this as Administrator to trust the SSL certificate

param(
    [string]$CertPath = "$PSScriptRoot\bcl.crt"
)

Write-Host "🔐 BCL SSL Certificate Trust Script" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Check if certificate file exists
if (!(Test-Path $CertPath)) {
    Write-Host "❌ Certificate file not found: $CertPath" -ForegroundColor Red
    Write-Host "Please ensure the certificate file exists." -ForegroundColor Yellow
    exit 1
}

Write-Host "📄 Certificate file found: $CertPath" -ForegroundColor Green

# Check if running as administrator
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (!$isAdmin) {
    Write-Host "⚠️  WARNING: Not running as Administrator!" -ForegroundColor Yellow
    Write-Host "This script needs Administrator privileges to trust certificates system-wide." -ForegroundColor Yellow
    Write-Host "Please right-click and 'Run as Administrator' or the certificate won't be trusted." -ForegroundColor Yellow
    $response = Read-Host "Continue anyway? (y/n)"
    if ($response -ne 'y') {
        exit 1
    }
}
else {
    Write-Host "✅ Running as Administrator" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔄 Importing certificate..." -ForegroundColor Yellow

try {
    # Load certificate
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2
    $cert.Import($CertPath)

    Write-Host "📋 Certificate Details:" -ForegroundColor Cyan
    Write-Host "   Subject: $($cert.Subject)" -ForegroundColor White
    Write-Host "   Issuer: $($cert.Issuer)" -ForegroundColor White
    Write-Host "   Valid From: $($cert.NotBefore)" -ForegroundColor White
    Write-Host "   Valid To: $($cert.NotAfter)" -ForegroundColor White
    Write-Host "   Thumbprint: $($cert.Thumbprint)" -ForegroundColor White

    # Open Trusted Root store
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "LocalMachine")
    $store.Open("ReadWrite")

    # Check if certificate already exists
    $existingCert = $store.Certificates | Where-Object { $_.Thumbprint -eq $cert.Thumbprint }
    if ($existingCert) {
        Write-Host "ℹ️  Certificate already trusted" -ForegroundColor Blue
    }
    else {
        # Add certificate to store
        $store.Add($cert)
        Write-Host "✅ Certificate successfully added to Trusted Root store" -ForegroundColor Green
    }

    $store.Close()

    Write-Host ""
    Write-Host "🎉 SUCCESS!" -ForegroundColor Green
    Write-Host "The BCL SSL certificate is now trusted system-wide." -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Restart your browser (Chrome/Firefox/Edge)" -ForegroundColor White
    Write-Host "2. Visit: https://10.0.0.90:5051/" -ForegroundColor White
    Write-Host "3. The 'Not Secure' warning should be gone!" -ForegroundColor White

}
catch {
    Write-Host "❌ ERROR: Failed to trust certificate" -ForegroundColor Red
    Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 Alternative: Manual Import" -ForegroundColor Yellow
    Write-Host "1. Press Win+R, type certlm.msc, press Enter" -ForegroundColor White
    Write-Host "2. Navigate to Trusted Root Certification Authorities > Certificates" -ForegroundColor White
    Write-Host "3. Right-click > All Tasks > Import" -ForegroundColor White
    Write-Host "4. Select file: $CertPath" -ForegroundColor White
    Write-Host "5. Place in: Trusted Root Certification Authorities" -ForegroundColor White
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
