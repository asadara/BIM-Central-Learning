#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Domain = "bcl.nke.net",
    [string]$ServerIP = "10.0.0.90",
    [int]$RootCertDays = 3650,
    [int]$ServerCertDays = 825,
    [switch]$SkipTrustImport,
    [switch]$SkipFirewall,
    [switch]$SkipNginxTest,
    [switch]$SkipNginxReload
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Require-OpenSSL {
    $cmd = Get-Command openssl -ErrorAction SilentlyContinue
    if (-not $cmd) {
        throw "OpenSSL tidak ditemukan di PATH."
    }
}

function Invoke-OpenSSL {
    param([string[]]$OpenSSLArgs)
    & openssl @OpenSSLArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Perintah OpenSSL gagal: openssl $($OpenSSLArgs -join ' ')"
    }
}

function Test-IsAdmin {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Import-RootCertificate {
    param([string]$CertPath)

    if ($SkipTrustImport) {
        Write-Host "[SKIP] Import root certificate dilewati."
        return
    }

    $isAdmin = Test-IsAdmin
    $targetStore = if ($isAdmin) { "Cert:\LocalMachine\Root" } else { "Cert:\CurrentUser\Root" }

    try {
        Import-Certificate -FilePath $CertPath -CertStoreLocation $targetStore | Out-Null
        Write-Host "[OK] Root CA diimport ke $targetStore"
    } catch {
        throw "Gagal import Root CA ke $targetStore. $($_.Exception.Message)"
    }
}

function Reset-FirewallRule {
    param(
        [string]$Name,
        [string]$Port
    )

    & netsh advfirewall firewall delete rule name="$Name" | Out-Null
    & netsh advfirewall firewall add rule name="$Name" dir=in action=allow protocol=TCP localport=$Port | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Gagal membuat rule firewall '$Name' untuk port $Port."
    }
}

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$certDir = Join-Path $repoRoot "nginx\certs"
$caDir = Join-Path $certDir "lan-ca"
$nginxRoot = Join-Path $repoRoot "nginx\nginx-1.28.0"
$nginxExe = Join-Path $nginxRoot "nginx.exe"

$rootCaKey = Join-Path $caDir "bcl-lan-root-ca.key"
$rootCaCert = Join-Path $caDir "bcl-lan-root-ca.crt"
$rootCaSerial = Join-Path $caDir "bcl-lan-root-ca.srl"
$rootCaCrl = Join-Path $caDir "bcl-lan-root-ca.crl"
$rootCaIndex = Join-Path $caDir "index.txt"
$rootCaSerialTxt = Join-Path $caDir "serial"
$rootCaCrlNumber = Join-Path $caDir "crlnumber"

$serverKey = Join-Path $certDir "bcl.nke.net.key"
$serverCert = Join-Path $certDir "bcl.nke.net.crt"
$serverFullchain = Join-Path $certDir "bcl.nke.net.fullchain.crt"
$serverCsr = Join-Path $caDir "bcl-nke-net.csr"

$rootCaConfig = Join-Path $caDir "root-ca.cnf"
$serverReqConfig = Join-Path $caDir "server-req.cnf"
$serverExtConfig = Join-Path $caDir "server-ext.cnf"

$webCertDir = Join-Path $repoRoot "BC-Learning-Main\certs"
$webRootCaCert = Join-Path $webCertDir "bcl-lan-root-ca.crt"
$webRootCaCrl = Join-Path $webCertDir "bcl-lan-root-ca.crl"

Write-Host "BCL LAN HTTPS Trusted Setup" -ForegroundColor Green
Write-Host "Repository: $repoRoot"
Write-Host "Domain    : $Domain"
Write-Host "Server IP : $ServerIP"

Require-OpenSSL

New-Item -ItemType Directory -Force -Path $caDir | Out-Null
New-Item -ItemType Directory -Force -Path $webCertDir | Out-Null

Write-Step "Generate / reuse LAN Root CA"
if (-not (Test-Path $rootCaIndex)) { New-Item -ItemType File -Path $rootCaIndex -Force | Out-Null }
if (-not (Test-Path $rootCaSerialTxt)) { '1000' | Set-Content -Encoding ascii -Path $rootCaSerialTxt }
if (-not (Test-Path $rootCaCrlNumber)) { '1000' | Set-Content -Encoding ascii -Path $rootCaCrlNumber }

@"
[ ca ]
default_ca = BCL_CA

[ BCL_CA ]
dir = $($caDir -replace '\\','/')
database = `$dir/index.txt
new_certs_dir = `$dir
certificate = $($rootCaCert -replace '\\','/')
private_key = $($rootCaKey -replace '\\','/')
serial = $($rootCaSerialTxt -replace '\\','/')
crlnumber = $($rootCaCrlNumber -replace '\\','/')
default_md = sha256
default_days = $ServerCertDays
default_crl_days = 365
policy = policy_any
x509_extensions = v3_ca
copy_extensions = copy
unique_subject = no

[ policy_any ]
commonName = supplied
stateOrProvinceName = optional
countryName = optional
organizationName = optional
organizationalUnitName = optional
emailAddress = optional

[ req ]
prompt = no
default_bits = 4096
default_md = sha256
distinguished_name = dn
x509_extensions = v3_ca

[ dn ]
C = ID
ST = DKI Jakarta
L = Jakarta
O = BCL
OU = LAN PKI
CN = BCL LAN Root CA

[ v3_ca ]
basicConstraints = critical, CA:TRUE, pathlen:1
keyUsage = critical, keyCertSign, cRLSign, digitalSignature
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
"@ | Set-Content -Encoding ascii -Path $rootCaConfig

if (-not (Test-Path $rootCaKey) -or -not (Test-Path $rootCaCert)) {
    Invoke-OpenSSL -OpenSSLArgs @("genrsa", "-out", $rootCaKey, "4096")
    Invoke-OpenSSL -OpenSSLArgs @("req", "-x509", "-new", "-nodes", "-key", $rootCaKey, "-sha256", "-days", "$RootCertDays", "-out", $rootCaCert, "-config", $rootCaConfig)
    Write-Host "[OK] Root CA dibuat: $rootCaCert"
} else {
    Write-Host "[OK] Root CA existing dipakai: $rootCaCert"
}

Write-Step "Generate server certificate with SAN (domain + LAN IP)"
$dnsNames = @($Domain, "localhost") | Select-Object -Unique
$ipNames = @($ServerIP, "127.0.0.1") | Select-Object -Unique

$altNamesLines = @()
$dnsIndex = 1
foreach ($dns in $dnsNames) {
    $altNamesLines += "DNS.$dnsIndex = $dns"
    $dnsIndex++
}
$ipIndex = 1
foreach ($ip in $ipNames) {
    $altNamesLines += "IP.$ipIndex = $ip"
    $ipIndex++
}

@"
[req]
prompt = no
default_bits = 2048
default_md = sha256
distinguished_name = dn
req_extensions = req_ext

[dn]
C = ID
ST = DKI Jakarta
L = Jakarta
O = BCL
OU = Platform
CN = $Domain

[req_ext]
subjectAltName = @alt_names

[alt_names]
$($altNamesLines -join "`r`n")
"@ | Set-Content -Encoding ascii -Path $serverReqConfig

@"
[v3_server]
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names
authorityInfoAccess = caIssuers;URI:http://$Domain/certs/bcl-lan-root-ca.crt
crlDistributionPoints = @crl_info

[alt_names]
$($altNamesLines -join "`r`n")

[crl_info]
URI.1 = http://$Domain/certs/bcl-lan-root-ca.crl
URI.2 = http://$ServerIP/certs/bcl-lan-root-ca.crl
"@ | Set-Content -Encoding ascii -Path $serverExtConfig

if ((Test-Path $serverKey) -and (Test-Path $serverCert)) {
    $backupDir = Join-Path $certDir ("backup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    Copy-Item $serverKey (Join-Path $backupDir "bcl.nke.net.key") -Force
    Copy-Item $serverCert (Join-Path $backupDir "bcl.nke.net.crt") -Force
    if (Test-Path $serverFullchain) {
        Copy-Item $serverFullchain (Join-Path $backupDir "bcl.nke.net.fullchain.crt") -Force
    }
    Write-Host "[OK] Backup cert lama: $backupDir"
}

Invoke-OpenSSL -OpenSSLArgs @("genrsa", "-out", $serverKey, "2048")
Invoke-OpenSSL -OpenSSLArgs @("req", "-new", "-key", $serverKey, "-out", $serverCsr, "-config", $serverReqConfig)
Invoke-OpenSSL -OpenSSLArgs @("x509", "-req", "-in", $serverCsr, "-CA", $rootCaCert, "-CAkey", $rootCaKey, "-CAcreateserial", "-out", $serverCert, "-days", "$ServerCertDays", "-sha256", "-extfile", $serverExtConfig, "-extensions", "v3_server")
Invoke-OpenSSL -OpenSSLArgs @("ca", "-gencrl", "-config", $rootCaConfig, "-out", $rootCaCrl)

Get-Content $serverCert, $rootCaCert | Set-Content -Encoding ascii $serverFullchain
Copy-Item $rootCaCert $webRootCaCert -Force
Copy-Item $rootCaCrl $webRootCaCrl -Force

Write-Host "[OK] Server cert: $serverCert"
Write-Host "[OK] Full chain : $serverFullchain"
Write-Host "[OK] Root CA web : $webRootCaCert"
Write-Host "[OK] Root CA CRL : $webRootCaCrl"

Write-Step "Import Root CA on server"
Import-RootCertificate -CertPath $rootCaCert

if (-not $SkipFirewall) {
    Write-Step "Configure firewall rules"
    if (-not (Test-IsAdmin)) {
        Write-Host "[WARN] Tidak admin: firewall rule dilewati."
    } else {
        Reset-FirewallRule -Name "BCL HTTP Port 80" -Port "80"
        Reset-FirewallRule -Name "BCL HTTPS Inbound" -Port "443"
        Reset-FirewallRule -Name "BCL Backend Port 5051" -Port "5051"
        Write-Host "[OK] Firewall rules untuk 80/443/5051 sudah disiapkan."
    }
}

if (-not $SkipNginxTest) {
    Write-Step "Validate nginx config"
    if (Test-Path $nginxExe) {
        & $nginxExe -p "$nginxRoot\" -c "conf/nginx.conf" -t
        if ($LASTEXITCODE -ne 0) {
            throw "Nginx config test gagal."
        }
        Write-Host "[OK] Nginx config valid."
    } else {
        Write-Host "[WARN] nginx.exe tidak ditemukan di $nginxExe"
    }
}

if (-not $SkipNginxReload) {
    Write-Step "Reload nginx"
    if (Test-Path $nginxExe) {
        & $nginxExe -p "$nginxRoot\" -c "conf/nginx.conf" -s reload
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Nginx reload berhasil."
        } else {
            Write-Host "[WARN] Nginx reload gagal (kemungkinan process nginx berjalan elevated)." -ForegroundColor Yellow
            Write-Host "       Jalankan ulang script ini sebagai Administrator, atau restart Nginx/BCL Launcher sebagai Administrator." -ForegroundColor Yellow
        }
    }
}

Write-Step "Summary"
Write-Host "1. Root CA: $rootCaCert"
Write-Host "2. Root CA CRL: $rootCaCrl"
Write-Host "3. Server cert: $serverCert"
Write-Host "3. Client cert download URL:"
Write-Host "   - http://$Domain/certs/bcl-lan-root-ca.crt"
Write-Host "   - http://$ServerIP/certs/bcl-lan-root-ca.crt"
Write-Host "4. Client CRL URL:"
Write-Host "   - http://$Domain/certs/bcl-lan-root-ca.crl"
Write-Host "   - http://$ServerIP/certs/bcl-lan-root-ca.crl"
Write-Host ""
Write-Host "Untuk client Wi-Fi, install root CA dengan:"
Write-Host "  C:\\BCL\\install-bcl-lan-rootca.bat"
Write-Host ""
Write-Host "Selesai."
