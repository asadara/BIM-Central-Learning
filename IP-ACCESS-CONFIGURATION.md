# 🖥️ BCL Server - IP Address Access Configuration

## ✅ Setup Status: SUCCESSFUL

Server BCL telah berhasil dikonfigurasi untuk dapat diakses melalui IP address tanpa perlu menambahkan port number.

---

## 🎯 Hasil Implementasi

### Sebelum Setup:
```
http://10.0.0.90:5051  ❌ (Perlu port 5051)
```

### Sesudah Setup:
```
http://10.0.0.90         ✅ (Tanpa port, langsung accessible)
```

---

## 🔧 Komponen yang Dikonfigurasi

### 1. Nginx Reverse Proxy
- **Lokasi**: `C:\nginx\nginx-1.28.0\`
- **Port**: 80 (default HTTP)
- **Server Names**: `bcl.nke.net localhost 127.0.0.1 10.0.0.90 _`
- **Target**: `http://localhost:5051`

### 2. Backend Server
- **Port**: 5051 (internal)
- **Status**: Running
- **Access**: Via reverse proxy only

### 3. Firewall & Network
- **Port 80**: Open for HTTP traffic
- **IP Binding**: All interfaces (0.0.0.0)

---

## 🧪 Testing Results

### Test 1: IP Address Access (SUCCESS)
```powershell
Invoke-WebRequest -Uri http://10.0.0.90/ping -UseBasicParsing
```
**Response**: `{"status":"OK","timestamp":"2026-01-14T08:54:37.837Z"}`

### Test 2: Localhost Access (SUCCESS)
```powershell
Invoke-WebRequest -Uri http://localhost/ping -UseBasicParsing
```
**Response**: `{"status":"OK","timestamp":"2026-01-14T08:54:45.631Z"}`

### Test 3: Domain Access (SUCCESS)
```powershell
Invoke-WebRequest -Uri http://bcl.nke.net/ping -UseBasicParsing
```
**Response**: `{"status":"OK","timestamp":"2026-01-14T08:54:50.127Z"}`

---

## 🚀 Cara Menjalankan Sistem

### Metode Otomatis (Recommended)
```powershell
# Jalankan backend server
cd C:\BCL\backend
node server.js

# Jalankan Nginx reverse proxy
& "C:\nginx\nginx-1.28.0\nginx.exe" -c "C:\nginx\nginx-1.28.0\conf\nginx.conf"
```

### Metode Manual
```powershell
# 1. Start Backend Server
cd C:\BCL\backend
node server.js

# 2. Start Nginx Proxy (run as administrator jika perlu)
& "C:\nginx\nginx-1.28.0\nginx.exe" -c "C:\nginx\nginx-1.28.0\conf\nginx.conf"
```

---

## 📊 Port Usage

| Service | Port | Status | Description |
|---------|------|--------|-------------|
| Nginx Reverse Proxy | 80 | ✅ Active | Handles all HTTP requests |
| BCL Backend Server | 5051 | ✅ Active | Internal Node.js server |
| Nginx Management | - | ✅ Active | Configuration reload/restart |

---

## 🔍 Troubleshooting

### Problem: 502 Bad Gateway
**Solution**:
1. Pastikan backend server (port 5051) berjalan
2. Check nginx error log: `type C:\nginx\nginx-1.28.0\logs\error.log`
3. Restart nginx: `nginx -s reload`

### Problem: Connection Refused
**Solution**:
1. Check firewall settings untuk port 80
2. Jalankan nginx sebagai administrator
3. Verify backend server accessibility: `curl http://localhost:5051/ping`

### Problem: IP Address tidak dapat diakses
**Solution**:
1. Pastikan IP address benar: `10.0.0.90`
2. Check network connectivity
3. Verify nginx configuration syntax: `nginx -t`

---

## 📁 File Configuration

### Nginx Config: `C:\nginx\nginx-1.28.0\conf\nginx.conf`
```nginx
server {
    listen 80;
    server_name bcl.nke.net localhost 127.0.0.1 10.0.0.90 _;

    location / {
        proxy_pass http://127.0.0.1:5051;
        # ... proxy settings
    }
}
```

---

## 🎉 Kesimpulan

✅ **IP address access berhasil dikonfigurasi**
✅ **Port 5051 tidak lagi diperlukan untuk akses IP**
✅ **Reverse proxy berfungsi dengan baik**
✅ **Semua akses method (IP, localhost, domain) bekerja**

**URL Akses Baru**:
- `http://10.0.0.90` (IP address tanpa port)
- `http://bcl.nke.net` (domain tanpa port)
- `http://localhost` (localhost tanpa port)

---

*Setup completed on: 2026-01-14*
*By: Cline AI Assistant*
