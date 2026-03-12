# 🚀 **ADMIN QUICK START GUIDE**
## Panduan Cepat untuk Administrator BCL

---

## 🎯 **ENTRY POINT UTAMA ADMIN**

### **File Utama:** `start-bcl-fixed.bat`

**Lokasi:** `C:\BCL\start-bcl-fixed.bat`

`start-bcl-fixed.bat` sekarang menjadi wrapper ke `start-bcl-http.bat`, jadi entry point lama tetap bisa dipakai tetapi mengikuti alur startup yang terbaru.
Skema operasional akhir adalah:
- Jika PostgreSQL masih Docker Desktop: startup efektif pulih penuh setelah user login
- Jika PostgreSQL sudah native Windows service: Windows startup bisa menjalankan BCL penuh sebelum user login
- Backend dan Nginx jalan di background
- Akses user tetap lewat `http://localhost/` atau `http://bcl.nke.net/`

### **Cara Menjalankan:**

1. **Double-click file** `start-bcl-fixed.bat`
2. **Atau jalankan via Command Prompt:**
   ```bash
   cd C:\BCL
   start-bcl-fixed.bat
   ```

### **Agar Jalan Otomatis Saat PC Menyala:**

Jalankan sekali sebagai Administrator:

```bat
cd C:\BCL
install-bcl-autostart-task.bat
install-bcl-watchdog-task.bat
install-bcl-shutdown-task.bat
```

Task autostart yang benar sekarang memakai trigger `At startup`, berjalan sebagai `SYSTEM`, dan memanggil `start-bcl-http-hidden.bat`.

### **Untuk mode boot-level penuh tanpa user login:**

Jalankan migrasi PostgreSQL native terlebih dahulu:

```bat
cd C:\BCL
install-native-postgres-service.bat
```

Panduan detail ada di `POSTGRES-NATIVE-MIGRATION.md`.

### **Yang Akan Terjadi:**

1. ✅ **Menjalankan stack BCL HTTP yang aktif**
2. ✅ **Menyalakan backend di port 5051 (internal)**
3. ✅ **Menyalakan Nginx di port 80 (akses user)**
4. ✅ **Buka dashboard monitoring**
5. ✅ **Buka halaman utama aplikasi**

---

## 🌐 **URL AKSES SETELAH SERVER START**

| **Pengguna** | **URL** | **Kegunaan** |
|--------------|---------|--------------|
| **Admin** | `http://localhost/admin.html` atau `http://bcl.nke.net/admin.html` | Panel administrasi |
| **User** | `http://localhost/` atau `http://bcl.nke.net/` | Halaman utama |
| **Monitoring** | `http://localhost/elearning-assets/phase4-dashboard.html` | Dashboard sistem |

### **Credentials Admin Default:**

- **Username:** `admin_bcl`
- **Password:** gunakan password admin yang dikonfigurasi di environment aktif
- **Email:** `admin@bcl.local`

---

## 🔧 **TROUBLESHOOTING CEPAT**

### **Problem: Certificate Warning**

**Solusi:**
```bash
# Jalankan sebagai Administrator
cd C:\BCL\backend
.\trust-cert-manual.ps1
```

### **Problem: Server Tidak Start**

**Solusi:**
```bash
# Cek backend port 5051
netstat -ano | findstr :5051

# Start stack utama
cd C:\BCL
start-bcl-http.bat
```

### **Problem: Tidak Bisa Akses**

**Solusi:**
- Gunakan `http://localhost/` atau `http://bcl.nke.net/`
- Backend `http://localhost:5051/` hanya untuk endpoint internal tertentu, bukan homepage utama

---

## 📋 **DAILY ADMIN CHECKLIST**

### **Startup Routine:**
- [ ] Jalankan `start-bcl-fixed.bat`
- [ ] Verifikasi backend running di port 5051
- [ ] Verifikasi web utama terbuka di `http://localhost/`
- [ ] Test akses admin panel
- [ ] Check monitoring dashboard
- [ ] Verify database connection

### **System Checks:**
- [ ] Pastikan HTTP server aktif di port 5051
- [ ] Test file access (video, dokumen)
- [ ] Monitor failed login attempts
- [ ] Review access logs

### **Maintenance:**
- [ ] Backup database mingguan
- [ ] Monitor disk space
- [ ] Update system patches
- [ ] Check antivirus status

---

## 📞 **EMERGENCY CONTACTS**

### **Jika Sistem Bermasalah:**

1. **Stop Server:** `Ctrl+C` di terminal server
2. **Restart:** Jalankan ulang `start-bcl-fixed.bat`
3. **Debug Mode:** `set DEBUG=1 && start-bcl-fixed.bat`
4. **Manual Start:** `cd C:\BCL\backend && node server.js`

### **Logs untuk Troubleshooting:**

- `server.log` - Server application logs
- `error.log` - Error logs
- `server-run.log` - Startup logs

---

## 🎯 **ADMIN RESPONSIBILITIES**

### **Daily Tasks:**
- ✅ Monitor system health
- ✅ Check user access logs
- ✅ Verify backup status
- ✅ Update security patches

### **Weekly Tasks:**
- ✅ Database backup
- ✅ Log file rotation
- ✅ Performance monitoring
- ✅ User account review

### **Monthly Tasks:**
- ✅ Security audit
- ✅ Certificate renewal check
- ✅ System updates
- ✅ Documentation review

---

## 📚 **DOKUMENTASI LENGKAP**

**Baca dokumentasi lengkap:** `BCL-SECURITY-GUIDE.md`

**File-file penting:**
- `BCL-SECURITY-GUIDE.md` - Panduan keamanan lengkap
- `backend/create-tables.sql` - Setup schema PostgreSQL
- `backend/trust-cert-manual.ps1` - Script trust certificate

---

## 🚀 **QUICK COMMANDS**

```bash
# Start server (main command)
start-bcl-fixed.bat

# Trust certificate
cd backend && .\trust-cert-manual.ps1

# Check server status
netstat -ano | findstr :5051

# Kill server process
taskkill /f /im node.exe

# Start manual
cd backend && node server.js
```

---

**🎉 SISTEM BCL SIAP DIGUNAKAN!**

**Entry point admin: `start-bcl-fixed.bat`** 🚀
