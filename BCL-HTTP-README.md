# 🚀 BCL Phase 4 Enterprise - HTTP Only Access Guide

## 📋 OVERVIEW

Panduan lengkap untuk menjalankan **BCL Phase 4 Enterprise** dalam mode **HTTP-only** yang optimal untuk environment LAN tanpa SSL certificates.

## 🎯 MASALAH YANG DIPERBAIKI

### ❌ Masalah Sebelumnya:
- Browser otomatis redirect ke HTTPS (`https://bcl.nke.net`)
- Mixed Content errors dengan API calls
- SSL Protocol errors karena backend tidak support HTTPS
- Cache browser yang memaksa HTTPS redirects

### ✅ Solusi Lengkap:
- **Server HTTP-only**: Backend & reverse proxy hanya menggunakan HTTP
- **Nginx config**: Disabled server HTTPS block
- **JavaScript fix**: API calls menggunakan HTTP secara paksa
- **Cache cleanup**: Tools untuk clear browser HSTS & cache

---

## 🚀 CARA MENJALANKAN SISTEM

### Metode 1: Single Command (Recommended)
```batch
# Jalankan dari folder C:\BCL
.\start-bcl-http.bat
```

### Metode 2: Manual Step-by-Step
```batch
# 1. Start backend server
cd backend
node server.js

# 2. Start Nginx (dalam terminal berbeda)
C:\nginx\nginx-1.28.0\nginx.exe -c C:\nginx\nginx-1.28.0\conf\nginx.conf
```

---

## 🌐 ACCESS URLs (HTTP ONLY)

| Service | URL | Description |
|---------|-----|-------------|
| **Main Platform** | `http://bcl.nke.net` | Halaman utama BCL |
| **Admin Panel** | `http://bcl.nke.net/admin.html` | Panel administrasi |
| **Login Page** | `http://bcl.nke.net/pages/login.html` | Halaman login |
| **Dashboard** | `http://bcl.nke.net/elearning-assets/dashboard.html` | Dashboard pembelajaran |
| **API Endpoints** | `http://bcl.nke.net/api/*` | REST API endpoints |

---

## 🔧 SYSTEM ARCHITECTURE

```
🌐 Browser → HTTP (bcl.nke.net:80) → Nginx Reverse Proxy → Node.js Backend (localhost:5051)
```

### Components:
- **Frontend**: HTML/CSS/JavaScript (HTTP port 80)
- **Backend**: Node.js server (HTTP port 5051 internal)
- **Reverse Proxy**: Nginx (HTTP port 80 external)
- **Database**: JSON file storage
- **Protocol**: HTTP only (no SSL/HTTPS)

---

## 🛠️ TROUBLESHOOTING

### Jika Masih Redirect ke HTTPS:

#### Step 1: Clear Browser Cache
```batch
# Jalankan dari folder C:\BCL
.\clear-browser-cache.bat
```

#### Step 2: Manual Browser Cache Clearing

**Google Chrome:**
1. Press `Ctrl + Shift + Delete`
2. Select "Cached images and files" + "Cookies and other site data"
3. Set time range to "All time"
4. Click "Clear data"

**Microsoft Edge:**
1. Press `Ctrl + Shift + Delete`
2. Select "Cached images and files" + "Cookies and other site data"
3. Set time range to "All time"
4. Click "Clear"

**Mozilla Firefox:**
1. Press `Ctrl + Shift + Delete`
2. Select "Cache" + "Cookies"
3. Set time range to "Everything"
4. Click "OK"

#### Step 3: Alternative Access Methods
- **Incognito/Private mode**: `Ctrl + Shift + N`
- **Different browser**: Coba browser lain
- **Direct IP**: `http://127.0.0.1` atau `http://localhost`

---

## ⚙️ CONFIGURATION FILES

### 1. Nginx Configuration
**File**: `C:\nginx\nginx-1.28.0\conf\nginx.conf`
```nginx
# HTTP Server (Port 80) - ACTIVE
server {
    listen 80;
    server_name bcl.nke.net;
    # ... proxy to localhost:5051
}

# HTTPS Server (Port 443) - DISABLED
# server {
#     listen 443 ssl http2;
#     server_name bcl.nke.net;
#     # ... commented out
# }
```

### 2. Hosts File
**File**: `C:\Windows\System32\drivers\etc\hosts`
```hosts
127.0.0.1 bcl.nke.net
```

### 3. JavaScript API Calls
**File**: `BC-Learning-Main/js/user.js`
```javascript
// Force HTTP for all API calls
const protocol = 'http:'; // Always HTTP
let apiUrl = `${protocol}//${window.location.hostname}:5051/api/login`;
```

---

## 🔐 LOGIN & AUTHENTICATION

### Cara Login:
1. Akses: `http://bcl.nke.net/pages/login.html`
2. Masukkan email & password
3. API call: `http://bcl.nke.net/api/login`
4. Redirect ke dashboard jika berhasil

### User Session:
- Data disimpan di `localStorage`
- Navbar menampilkan nama user
- Session persistent across browser tabs
- Logout menghapus semua data

---

## 📊 MONITORING & LOGS

### Server Logs:
- **Backend**: `C:\BCL\backend\server.log`
- **Nginx Access**: `C:\nginx\nginx-1.28.0\logs\bcl_access.log`
- **Nginx Error**: `C:\nginx\nginx-1.28.0\logs\bcl_error.log`

### Health Checks:
```batch
# Test backend server
curl http://localhost:5051/ping

# Test reverse proxy
curl http://bcl.nke.net/ping
```

---

## 🚨 COMMON ISSUES & SOLUTIONS

### Issue 1: "ERR_SSL_PROTOCOL_ERROR"
**Cause**: Browser trying HTTPS, backend no SSL
**Solution**: Use HTTP URLs, clear HSTS cache

### Issue 2: "Failed to fetch"
**Cause**: Backend server not running
**Solution**: Run `.\start-bcl-http.bat`

### Issue 3: "Connection refused"
**Cause**: Nginx not running or port blocked
**Solution**: Check Windows Firewall, restart Nginx

### Issue 4: Login stuck at "Logging in..."
**Cause**: JavaScript errors or network issues
**Solution**: Check browser console, use Incognito mode

---

## 🏗️ DEVELOPMENT NOTES

### Environment Variables:
```batch
set USE_HTTPS=false
set HTTP_PORT=5051
```

### Ports Used:
- **80**: Nginx reverse proxy (external)
- **5051**: Node.js backend (internal)
- **443**: Disabled (HTTPS)

### File Structure:
```
C:\BCL\
├── backend\           # Node.js server
├── BC-Learning-Main\  # Frontend files
├── start-bcl-http.bat # Startup script
├── clear-browser-cache.bat # Cache cleanup
└── nginx\            # Nginx server
```

---

## 🎉 SUCCESS INDICATORS

### System Running Successfully When:
- ✅ `http://bcl.nke.net` loads without HTTPS redirect
- ✅ Login page accessible via HTTP
- ✅ API calls work without Mixed Content errors
- ✅ User authentication functions properly
- ✅ Dashboard displays user name correctly
- ✅ No SSL protocol errors in browser console

---

## 📞 SUPPORT

### Quick Commands:
```batch
# Start system
.\start-bcl-http.bat

# Clear cache
.\clear-browser-cache.bat

# Check services
netstat -ano | findstr "5051\|80"

# Kill processes
taskkill /f /im node.exe
taskkill /f /im nginx.exe
```

### Logs to Check:
- Browser developer console (F12)
- `C:\BCL\backend\server.log`
- `C:\nginx\nginx-1.28.0\logs\error.log`

---

## ✨ CONCLUSION

BCL Phase 4 Enterprise sekarang dioptimalkan untuk **HTTP-only access** yang sempurna untuk environment LAN tanpa kompleksitas SSL certificates. Sistem akan berjalan stabil tanpa redirect HTTPS yang menyebabkan error.

**Access URL: `http://bcl.nke.net`** 🚀
