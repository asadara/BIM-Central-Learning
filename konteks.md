# Konteks Sistem BCL - PANDUAN KRITIS

## 🚨 PENTING UNTUK AI/DEVELOPER BARU
**Baca file ini SEBELUM melakukan perubahan apapun pada sistem BCL!**

---

## 🚀 ENTRY POINT UTAMA
```bash
./start-bcl-http.bat    # SELALU gunakan ini untuk production!
```

**JANGAN PAKAI:**
- ❌ `./BCL_Launcher.bat` (development only)
- ❌ `node backend/server.js` (manual start)
- ❌ File batch lain tanpa konfirmasi

---

## 🏗️ ARSITEKTUR SISTEM

### Infrastructure Stack:
```
User Browser ──HTTP──► Nginx Proxy (Port 80)
                        │
                        └──► Node.js Backend (Port 5051)
                            │
                            └──► PostgreSQL (Docker Container)
```

### Komponen Utama:
- **Nginx (Port 80)**: Reverse proxy, serve static files
- **Node.js (Port 5051)**: Backend API, business logic
- **PostgreSQL**: Database utama (Docker)
- **JSON Files**: Legacy/local data artifacts; jangan dijadikan fallback bila DB down (production wajib DB)

---

## 📁 STRUKTUR FOLDER HALAMAN - KRITIS UNTUK NAVIGASI!

### ❌ KESALAHAN UMUM: Mengubah Path Navbar Tanpa Memahami Struktur

**Masalah:** AI/Developer sering mengubah link navbar tanpa memahami konteks **root domain vs subpath** (contoh `http://host/bcl/`) dan struktur folder.

### 3 Tipe Halaman BCL:

#### 1. 🏠 **Root Pages** (`/`)
```
📁 BC-Learning-Main/
├── index.html              # ← Root level
├── about.html             # ← Root level
└── pages/                 # ← Subfolder
    └── bim.html
```

**Path yang benar dari root pages:**
- ✅ `pages/bim.html` (relative)
- NOTE `/pages/bim.html` (absolute) aman di root domain; bermasalah jika deploy di subpath

#### 2. 📄 **Pages Folder** (`/pages/`)
```
📁 BC-Learning-Main/
├── index.html
└── pages/
    ├── bim.html           # ← Pages level
    ├── sub/
    │   └── adminbcl.html  # ← Sub-sub level
    └── standards.html
```

**Path yang benar dari pages folder:**
- ✅ `../index.html` (naik satu level)
- ✅ `sub/adminbcl.html` (tetap di pages)
- NOTE `/index.html` (absolute) aman di root domain; bermasalah jika deploy di subpath

#### 3. 🎓 **E-Learning Assets** (`/elearning-assets/`)
```
📁 BC-Learning-Main/
├── index.html
├── pages/
└── elearning-assets/
    ├── dashboard.html     # ← E-learning level
    └── home.html
```

**Path yang benar dari elearning-assets:**
- ✅ `../index.html` (naik satu level)
- ✅ `../pages/bim.html` (naik satu level)
- NOTE `/index.html` (absolute) aman di root domain; bermasalah jika deploy di subpath

### 🎯 **SOLUSI: Dynamic Navbar Path Adjustment**

Navbar component menggunakan JavaScript untuk **otomatis adjust paths** berdasarkan lokasi halaman:

```javascript
function adjustNavbarPaths() {
    const currentPath = window.location.pathname;

    if (currentPath.startsWith('/pages/')) {
        // Dari pages folder - gunakan ../
        pathPrefix = '../';
    } else if (currentPath.startsWith('/elearning-assets/')) {
        // Dari elearning-assets - gunakan ../
        pathPrefix = '../';
    } else {
        // Dari root - tidak perlu prefix
        pathPrefix = '';
    }

    // Adjust semua link yang perlu
    // ...
}
```

### 🚨 **PERINGATAN UNTUK AI/DEVELOPER:**

**JANGAN** mengubah navbar paths tanpa memahami apakah server berjalan di root domain atau subpath.

**ALASAN:** Absolute paths (`/index.html`) selalu resolve ke root domain. Jika sistem deploy di subpath, absolute path akan keluar dari subpath dan 404.

**LAKUKAN:** Biarkan navbar menggunakan dynamic adjustment, atau gunakan relative paths yang tepat untuk setiap konteks.

---


## 🔗 URL PATTERNS - KRITIS! (UNTUK JAVASCRIPT)

### ✅ BENAR (Relative URLs):
```javascript
// API Calls
fetch('/api/tutorials')           // ✓ Nginx forward ke backend
fetch('/api/tutorials/tags')      // ✓ Nginx forward ke backend

// Static Files
<img src="/thumbnails/video.jpg"> // ✓ Nginx serve langsung
<img src="/img/logo.png">         // ✓ Nginx serve langsung

// Pages
location.href = '/pages/tutorial.html' // ✓ Nginx serve langsung
```

### HINDARI (Hard-coded Host):
```javascript
// JANGAN PAKAI INI!
fetch('http://localhost:5051/api/tutorials')     // ❌ Langsung ke backend
fetch('http://localhost/api/tutorials')          // NOTE host hard-coded, bermasalah untuk IP/domain lain
```

---

## 🐛 COMMON ISSUES & SOLUSI

### 1. ❌ CORS Error / API Tidak Bisa Akses
**Gejala:** `Failed to fetch`, `TypeError: Failed to fetch`
**Penyebab:** JavaScript menggunakan absolute URLs
**Solusi:**
```javascript
// Ganti ini:
fetch('http://localhost:5051/api/tutorials')

// Menjadi:
fetch('/api/tutorials')
```

### 2. ❌ Thumbnail Tidak Muncul
**Gejala:** Video cards tanpa gambar, broken images
**Penyebab:** Thumbnail URL tidak kompatibel dengan Nginx
**Solusi:**
```javascript
// Pastikan relative URL:
const thumbnailUrl = video.thumbnail; // Sudah relative dari backend
```

### 3. ❌ API Connection Refused
**Gejala:** `ERR_CONNECTION_REFUSED`, port 5051 tidak accessible
**Penyebab:** Backend tidak running atau port conflict
**Solusi:**
```bash
# Stop backend jika perlu
taskkill /f /im node.exe

# Reload Nginx jika ada perubahan config (jangan kill)
C:\BCL\nginx\nginx-1.28.0\nginx.exe -s reload -p C:\BCL\nginx\nginx-1.28.0

# Restart dengan entry point benar
./start-bcl-http.bat
```

### 4. ❌ Port 80/5051 Sudah Digunakan
**Gejala:** Server gagal start, port in use
**Penyebab:** Process lain menggunakan port
**Solusi:**
```bash
netstat -ano | findstr ":80"
netstat -ano | findstr ":5051"
taskkill /pid <PID_NUMBER> /f
```

---

## 🔧 DEVELOPMENT WORKFLOW

### 1. Start System
```bash
./start-bcl-http.bat
```

### 2. Test URLs
```bash
✅ Main: http://localhost
✅ API: http://localhost/api/tutorials
✅ Admin: http://localhost/admin.html
❌ Wrong: http://localhost:5051 (langsung ke backend)
```

### 3. JavaScript Rules
- ✅ **SELALU** gunakan relative URLs: `/api/*`
- ✅ **JANGAN** gunakan absolute URLs: `http://localhost:5051/api/*`
- ✅ Test dengan production entry point

### 4. File Structure Penting
```bash
start-bcl-http.bat          # ← ENTRY POINT UTAMA
backend/server.js           # ← BACKEND (port 5051)
nginx/nginx-1.28.0/nginx.exe # ← NGINX (port 80) - LOKASI BARU!
BC-Learning-Main/           # ← FRONTEND (serve by Nginx)
konteks.md                  # ← FILE INI - BACA DULU!
```

## 🔧 NGINX CONFIGURATION FIXES (2026-01-21)

### Issue Resolved: Domain Access Broken
**Problem:** Users could NOT access BCL via `http://bcl.nke.net` but COULD access via `http://10.0.0.90:5051`

### Root Cause: Windows NGINX Master Context Mismatch
- Relative paths in nginx.conf didn't resolve correctly
- NGINX processes had permission conflicts preventing reload

### Solution Applied:
1. **Updated nginx.conf paths to absolute:**
   ```nginx
   # BEFORE (broken - relative paths):
   root ../BC-Learning-Main;
   client_body_temp_path temp/client_body_temp;

   # AFTER (fixed - absolute paths):
   root C:/BCL/BC-Learning-Main;
   client_body_temp_path C:/BCL/nginx/nginx-1.28.0/temp/client_body_temp;
   ```

2. **Started backend server manually** when batch file had issues

### Verification:
- ✅ `http://bcl.nke.net/ping` → **HTTP 200 OK**
- ✅ `http://bcl.nke.net/api/courses` → **HTTP 200 OK** (with data)
- ✅ `http://10.0.0.90:5051` → **WORKING** (direct backend access)

### NGINX Management Rules:
```bash
# Test configuration:
C:\BCL\nginx\nginx-1.28.0\nginx.exe -t -p C:\BCL\nginx\nginx-1.28.0

# Reload configuration (zero downtime):
C:\BCL\nginx\nginx-1.28.0\nginx.exe -s reload -p C:\BCL\nginx\nginx-1.28.0

# Stop NGINX (ONLY if explicitly requested):
C:\BCL\nginx\nginx-1.28.0\nginx.exe -s stop -p C:\BCL\nginx\nginx-1.28.0
```

## 🔍 PHASE4-DASHBOARD.HTML ANALYSIS (2026-01-21)

### Issue: Dashboard Shows Non-Existent Systems

**Problem:** The `phase4-dashboard.html` displays "Phase 4 Enterprise Systems" that **DO NOT EXIST** in the current BCL implementation.

### Systems Dashboard Claims (But Don't Exist):
❌ **AI Learning Assistant** - No real AI/ML backend, just basic chat interface
❌ **Predictive Learning Engine** - No predictive algorithms or ML models
❌ **Real-time Collaboration System** - No WebRTC, video conferencing, or collaboration features
❌ **Advanced CDN System** - Just basic file serving, no intelligent content delivery
❌ **Enterprise Multi-tenancy** - No tenant management or organization features
❌ **Mobile-First Architecture** - Basic responsive design only, no PWA/offline capabilities
❌ **Blockchain Integration** - No blockchain, smart contracts, or credential verification
❌ **Comprehensive API Ecosystem** - Basic APIs only, no GraphQL or advanced integrations
❌ **Business Intelligence Dashboard** - No advanced analytics or reporting
❌ **Advanced Testing Framework** - No automated testing or CI/CD integration

### What Actually Exists:
✅ **Basic APIs**: `/api/network-info`, `/api/server/status`, `/api/admin/logout`
✅ **Video Management**: Local file serving with basic tagging
✅ **User Management**: Basic authentication and user roles
✅ **Content Management**: Learning materials, courses, exam materials
✅ **Admin Panel**: Content management and user administration

### Dashboard Misinformation:
- Shows "Phase 4 Enterprise Platform" but it's actually Phase 3
- Claims 10 advanced systems but only basic features exist
- Displays online/offline status for non-existent services
- Promises AI, blockchain, predictive analytics that don't exist

### Recommendation:
**Update dashboard to reflect actual system capabilities**, or implement the promised Phase 4 features.

### Key Lessons:
1. **Always use absolute paths** in nginx.conf for Windows
2. **Never kill NGINX processes** - use reload for config changes
3. **NGINX is infrastructure** - must remain stable
4. **Backend can be restarted** as needed for troubleshooting
5. **Dashboard should reflect actual system capabilities**

---

## 📞 EMERGENCY CONTACTS

### Jika Sistem Bermasalah:
1. **Baca file ini dulu** (`konteks.md`)
2. **Restart dengan entry point benar**:
   ```bash
   ./start-bcl-http.bat
   ```
3. **Check logs**:
   - `backend.log`
   - Nginx error logs
4. **Validate context**:
   ```bash
   node validate-context.js  # (jika ada)
   ```

### Jika AI/Model Berubah:
- **SELALU baca file ini** (`konteks.md`) pertama!
- **Jangan edit code** sebelum paham konteks
- **Test dengan** `./start-bcl-http.bat`
- **Gunakan relative URLs** di JavaScript

---

## 🎯 QUICK REFERENCE

### Start System:
```bash
./start-bcl-http.bat
```

### Test API:
```bash
curl http://localhost/api/tutorials
```

### Common Fixes:
- **API errors** → Check relative URLs `/api/*`
- **Missing thumbnails** → Check Nginx static serving
- **Port conflicts** → Kill processes, restart

### Critical Rules:
1. **Entry point**: `./start-bcl-http.bat`
2. **URL pattern**: Relative URLs only (`/api/*`)
3. **Architecture**: Nginx (80) → Node.js (5051)
4. **Test first**: Selalu test dengan production setup

---

## 📝 CHANGE LOG

### v1.3 - Path Guidance Clarifications
- Clarify absolute path behavior for root domain vs subpath.
- Update URL guidance to avoid hard-coded host confusion.

### v1.2 - Startup Script Stability (Double-Click + Docker + Nginx)
- Entry point start-bcl-http.bat now keeps console open on double-click.
- Runlock handling auto-cleans stale locks; avoids false "another instance" exits.
- Docker Desktop auto-start + engine readiness check via `docker info`.
- Nginx startup flow simplified; removed false errorlevel check after `start`.
- Escaped parentheses in echo lines to prevent `: was unexpected at this time.`

### v1.1 - Page Folder Structure Documentation
- ✅ **STRUKTUR FOLDER HALAMAN** - Dokumentasi lengkap 3 tipe halaman
- ✅ **KESALAHAN UMUM** - Peringatan tentang navbar path changes
- ✅ **SOLUSI Dynamic Adjustment** - Dokumentasi cara navbar menyesuaikan path
- ✅ **PERINGATAN UNTUK AI/DEVELOPER** - Panduan pencegahan kesalahan

### v1.0 - Initial Context
- ✅ Dokumentasi entry point dan architecture
- ✅ URL patterns untuk JavaScript
- ✅ Common issues dan solutions
- ✅ Emergency procedures

---

**🚨 INGAT: Baca file ini SEBELUM melakukan apapun pada sistem BCL! 🚨**

*Last updated: 2026-01-22*
