@echo off
echo =====================================
echo BCL SSL Certificate Generator
echo =====================================
echo.

:: Check if OpenSSL is available
where openssl >nul 2>&1
if errorlevel 1 (
    echo [ERROR] OpenSSL not found in PATH
    echo.
    echo Please install OpenSSL or use one of these alternatives:
    echo 1. Install OpenSSL for Windows: https://slproweb.com/products/Win32OpenSSL.html
    echo 2. Use Git Bash ^(includes OpenSSL^): git bash -c "openssl version"
    echo 3. Use Windows Subsystem for Linux ^(WSL^)
    echo.
    pause
    exit /b 1
)

echo [INFO] OpenSSL found, generating certificates...
echo.

:: Generate private key
echo [STEP 1] Generating private key...
openssl genrsa -out bcl.key 2048
if errorlevel 1 (
    echo [ERROR] Failed to generate private key
    pause
    exit /b 1
)

:: Create certificate signing request configuration
echo [STEP 2] Creating certificate configuration...
(
echo [req]
echo default_bits = 2048
echo prompt = no
echo default_md = sha256
echo distinguished_name = dn
echo req_extensions = v3_req
echo.
echo [dn]
echo C=ID
echo ST=Jakarta
echo L=Jakarta
echo O=BCL Development
echo OU=IT Department
echo CN=localhost
echo.
echo [v3_req]
echo basicConstraints = CA:FALSE
echo keyUsage = nonRepudiation, digitalSignature, keyEncipherment
echo subjectAltName = @alt_names
echo.
echo [alt_names]
echo DNS.1 = localhost
echo DNS.2 = bcl.local
echo DNS.3 = *.bcl.local
echo IP.1 = 127.0.0.1
echo IP.2 = ::1
) > bcl-ssl.conf

:: Generate self-signed certificate
echo [STEP 3] Generating self-signed certificate...
openssl req -new -x509 -key bcl.key -out bcl.crt -days 365 -config bcl-ssl.conf -extensions v3_req
if errorlevel 1 (
    echo [ERROR] Failed to generate certificate
    pause
    exit /b 1
)

:: Clean up
del bcl-ssl.conf

echo.
echo =====================================
echo ✅ SSL Certificates Generated Successfully!
echo =====================================
echo.
echo Files created:
echo   • bcl.key ^(private key^)
echo   • bcl.crt ^(certificate^)
echo.
echo ⚠️  Browser Security Notice:
echo   • These are self-signed certificates
echo   • Browser may still show "Not Secure"
echo   • Click "Advanced" → "Proceed to localhost"
echo   • Or add certificates to Windows Certificate Store
echo.
echo 🔧 Next Steps:
echo   1. Restart your BCL server
echo   2. Access https://localhost:5150
echo   3. Accept the security warning
echo.
pause
