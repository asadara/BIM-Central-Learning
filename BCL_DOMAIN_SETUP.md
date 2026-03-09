# BCL Domain Setup - bcl.nke.net

## Masalah
BCL dapat diakses via IP address (http://10.0.0.90), namun user harus dapat mengakses via domain `bcl.nke.net` tanpa mengetikkan IP address server.

## Solusi
Karena `bcl.nke.net` adalah domain lokal (bukan domain publik), diperlukan konfigurasi DNS lokal pada setiap komputer client.

### Opsi 1: Konfigurasi Manual (Hosts File)
Tambahkan entry berikut ke file hosts di setiap komputer client:

```
10.0.0.90 bcl.nke.net
```

**Lokasi file hosts:**
- Windows: `C:\Windows\System32\drivers\etc\hosts`
- Linux: `/etc/hosts`
- macOS: `/etc/hosts`

**Cara edit:**
1. Buka Notepad/Editor sebagai Administrator
2. Buka file hosts
3. Tambahkan baris `10.0.0.90 bcl.nke.net`
4. Simpan file
5. Jalankan `ipconfig /flushdns` di Command Prompt

### Opsi 2: Script Otomatis (Windows)
Gunakan script yang sudah disediakan:

#### Batch Script (add-bcl-hosts.bat)
```cmd
# Jalankan sebagai Administrator
.\add-bcl-hosts.bat
```

#### PowerShell Script (add-bcl-hosts.ps1)
```powershell
# Jalankan sebagai Administrator
.\add-bcl-hosts.ps1
```

### Opsi 3: Konfigurasi Router (Recommended untuk Jaringan Besar)
Jika menggunakan router yang mendukung DNS lokal:
1. Masuk ke admin panel router
2. Tambahkan DNS entry: `bcl.nke.net -> 10.0.0.90`
3. Pastikan semua komputer menggunakan router sebagai DNS server

### Opsi 4: DNS Server Lokal (Advanced)
Setup DNS server di server BCL menggunakan:
- Windows DNS Server role
- BIND (Linux)
- dnsmasq

## Verifikasi
Setelah konfigurasi, test dengan:
```cmd
ping bcl.nke.net
nslookup bcl.nke.net
curl http://bcl.nke.net/ping
```

## Troubleshooting
1. **Masih tidak bisa akses:**
   - Restart browser
   - Clear browser cache (Ctrl+F5)
   - Flush DNS: `ipconfig /flushdns`

2. **Error "Permission denied":**
   - Jalankan editor sebagai Administrator

3. **Domain tidak resolve:**
   - Pastikan entry hosts benar
   - Check firewall tidak block

## Status Server
- ✅ Backend: Port 5051
- ✅ Nginx Proxy: Port 80
- ✅ Domain: bcl.nke.net (dengan konfigurasi hosts)
- ✅ IP Access: 10.0.0.90