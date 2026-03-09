# Troubleshooting Guide: BCL Tidak Bisa Diakses dari Device Lain di LAN

## Root Cause Analysis
✅ **Ditemukan**: Network profile di-set sebagai "Public" yang memblokir incoming connections

## Masalah yang Teridentifikasi:
1. **Network Profile = Public** → Firewall ketat
2. **Tidak ada Firewall Rule untuk Port 5150** → Koneksi diblokir
3. **Mungkin ada Antivirus/Security Software** yang memblokir

## Solusi Step-by-Step:

### ⚠️ **SOLUSI UTAMA: Ubah Network Profile**
```powershell
# Jalankan sebagai Administrator:
Set-NetConnectionProfile -Name "NKEguest" -NetworkCategory Private
```

### 🔥 **Alternatif: Buat Firewall Rule Manual**
Jika tidak bisa ubah network profile, buat rule firewall:

**Via Command Prompt (Administrator):**
```cmd
netsh advfirewall firewall add rule name="BCL Server HTTP" dir=in action=allow protocol=TCP localport=5150
```

**Via PowerShell (Administrator):**
```powershell
New-NetFirewallRule -DisplayName "BCL Server HTTP" -Direction Inbound -Protocol TCP -LocalPort 5150 -Action Allow -Profile Any
```

### 🔍 **Verifikasi Setting:**

1. **Cek Network Profile:**
```powershell
Get-NetConnectionProfile
```

2. **Cek Firewall Rule:**
```powershell
Get-NetFirewallRule -DisplayName "*BCL*" | Select-Object DisplayName, Enabled, Direction
```

3. **Test Port Listening:**
```powershell
netstat -an | Select-String ":5150"
```
Hasil yang benar: `TCP    0.0.0.0:5150           0.0.0.0:0              LISTENING`

4. **Test dari Device Lain:**
   - Browser: `http://10.0.0.76:5150`
   - Telnet: `telnet 10.0.0.76 5150`

### 🛡️ **Alternatif Sementara: Disable Firewall**
⚠️ **TIDAK DIREKOMENDASIKAN untuk production!**
```powershell
# Administrator PowerShell:
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False
```

### 📋 **Checklist Troubleshooting:**
- [ ] Network profile = Private ✅
- [ ] Firewall rule untuk port 5150 ada ✅  
- [ ] Server binding ke 0.0.0.0:5150 ✅ (sudah benar)
- [ ] IP address device server: 10.0.0.76 ✅
- [ ] Antivirus tidak memblokir Node.js
- [ ] Router tidak memblokir internal traffic

### 🔧 **Informasi Server Saat Ini:**
- **Server IP**: 10.0.0.76
- **Port**: 5150  
- **URL untuk device lain**: http://10.0.0.76:5150
- **Bind Configuration**: 0.0.0.0 (sudah benar untuk semua interface)

### 📱 **Test dari Device Lain:**
Setelah fix, coba akses dari device lain:
- **URL**: http://10.0.0.76:5150
- **Tutorial Page**: http://10.0.0.76:5150/pages/tutorial.html  
- **API Test**: http://10.0.0.76:5150/api/tutorials

### ✅ **Status Verifikasi (18 Aug 2025):**
- ✅ Network Profile: Changed to Private
- ✅ Server Running: Listening on 0.0.0.0:5150
- ✅ Local Access: Working (localhost:5150)
- ✅ Network Access: Working (10.0.0.76:5150)
- ✅ HTTP Response: 200 OK
- ✅ API Response: 126KB data returned

### 🚨 **Jika Masih Tidak Bisa Diakses dari Device Lain:**

1. **Pastikan IP Address yang Benar:**
   - IP Server: **10.0.0.76** (BUKAN 10.0.76)
   - URL yang Benar: **http://10.0.0.76:5150**

2. **Cek di Device Lain:**
   ```bash
   # Test koneksi dari device lain:
   ping 10.0.0.76
   telnet 10.0.0.76 5150
   ```

3. **Masalah di Router/Switch:**
   - AP Isolation mungkin aktif
   - VLAN separation
   - Router firewall memblokir port 5150

4. **Masalah di Device Client:**
   - Proxy settings
   - Local firewall di device client
   - Browser cache issues

5. **Temporary Solution - Buat Firewall Rule:**
   ```cmd
   # Jalankan sebagai Administrator di Command Prompt:
   netsh advfirewall firewall add rule name="BCL HTTP Inbound" dir=in action=allow protocol=TCP localport=5150
   ```

## Quick Fix Command (Administrator):
```powershell
Set-NetConnectionProfile -Name "NKEguest" -NetworkCategory Private
```

### 🔧 **Advanced Diagnostics dari Device Lain:**
Jalankan dari device lain yang tidak bisa akses:
```bash
# Test basic connectivity:
ping 10.0.0.76

# Test port (Windows):
telnet 10.0.0.76 5150

# Test port (PowerShell):
Test-NetConnection -ComputerName 10.0.0.76 -Port 5150

# Test HTTP (curl):
curl -I http://10.0.0.76:5150
```

Jika semua test di atas gagal, masalahnya di network infrastructure (router/switch).
