# BCL LAN HTTPS Trusted End-to-End

## 1) Generate LAN Root CA + Server Certificate
Run on BCL server (recommended as Administrator):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\BCL\setup-lan-https-trusted.ps1 -Domain bcl.nke.net -ServerIP 10.0.0.90
```

This script will create:
- `C:\BCL\nginx\certs\lan-ca\bcl-lan-root-ca.crt`
- `C:\BCL\nginx\certs\bcl.nke.net.crt`
- `C:\BCL\nginx\certs\bcl.nke.net.fullchain.crt`
- `C:\BCL\BC-Learning-Main\certs\bcl-lan-root-ca.crt`

## 2) Ensure Nginx uses full chain
`nginx.conf` now points to:
- `ssl_certificate C:/BCL/nginx/certs/bcl.nke.net.fullchain.crt;`

If Nginx was started by elevated account, reload/restart Nginx as Administrator.

## 3) Open LAN firewall ports
Run as Administrator:

```bat
C:\BCL\configure-firewall.bat
```

Ports required: `80`, `443`, `5051`.

## 4) Install trust on each client device
Use one of these:
- `https://bcl.nke.net/bcl-install-cert.bat`
- `C:\BCL\install-bcl-lan-rootca.bat` (on server machine)

Installer actions:
- install `bcl-lan-root-ca.crt` to trust store
- set hosts mapping `10.0.0.90 bcl.nke.net`
- flush DNS cache

## 5) Access URLs
- `https://bcl.nke.net`
- `https://10.0.0.90`

If `bcl.nke.net` still fails on WiFi, verify client hosts/DNS maps to `10.0.0.90`.
