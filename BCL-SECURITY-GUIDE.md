# 🛡️ BCL Security Implementation Guide
## Panduan Lengkap Keamanan Sistem BC Learning

---

## 📋 **DAFTAR ISI**

1. [Ringkasan Implementasi Keamanan](#ringkasan-implementasi-keamanan)
2. [Cara Menjalankan Server](#cara-menjalankan-server)
3. [Mengatasi Warning SSL Certificate](#mengatasi-warning-ssl-certificate)
4. [Akses Aplikasi](#akses-aplikasi)
5. [Konfigurasi Database](#konfigurasi-database)
6. [Monitoring dan Maintenance](#monitoring-dan-maintenance)
7. [Troubleshooting](#troubleshooting)
8. [Security Best Practices](#security-best-practices)

---

## 🔒 **RINGKASAN IMPLEMENTASI KEAMANAN**

### **✅ Keamanan yang Telah Diperbaiki:**

| **Komponen** | **Status** | **Implementasi** |
|--------------|------------|------------------|
| **HTTPS Encryption** | ✅ **AKTIF** | SSL/TLS dengan self-signed certificate |
| **Database Security** | ✅ **AMAN** | Dedicated user `bcl_user` dengan password kuat |
| **Session Management** | ✅ **SECURE** | HttpOnly cookies, secure flags |
| **Authentication** | ✅ **ENHANCED** | JWT tokens, bcrypt hashing, rate limiting |
| **Input Validation** | ✅ **ACTIVE** | SQL injection protection, XSS prevention |
| **File Upload Security** | ✅ **PROTECTED** | Path traversal prevention |
| **Server Binding** | ✅ **CORRECT** | Bound to IP `10.0.0.90` |

### **🔧 File yang Telah Dimodifikasi:**

- `backend/server.js` - Server configuration dengan HTTPS
- `backend/create-tables.sql` - Schema PostgreSQL utama
- `start-bcl-fixed.bat` - Admin entry point dengan HTTPS
- `backend/trust-certificate.bat` - Certificate trust script

---

## 🚀 **CARA MENJALANKAN SERVER**

### **Persiapan Awal:**

1. **Setup Database:**
   ```bash
   # Jalankan schema PostgreSQL
   psql -h localhost -U bcl_user -d bcl_database -f C:\BCL\backend\create-tables.sql
   ```

2. **Trust SSL Certificate (Opsional - untuk menghilangkan warning):**
   ```bash
   # Jalankan sebagai Administrator
   cd C:\BCL\backend
   .\trust-certificate.bat
   ```

### **Menjalankan Server:**

**Opsi 1: Menggunakan Batch File (Recommended)**
```bash
# Double-click file ini:
start-bcl-fixed.bat
```

**Opsi 2: Manual Command Line**
```bash
cd C:\BCL\backend
node server.js
```

### **Verifikasi Server Running:**

```bash
# Cek port 5051 aktif
netstat -ano | findstr :5051

# Output yang benar:
# TCP    10.0.0.90:5051         0.0.0.0:0              LISTENING       [PID]
```

---

## 🔐 **MENGATASI WARNING SSL CERTIFICATE**

### **Opsi 1: Trust Certificate (Recommended)**

1. **Jalankan sebagai Administrator:**
   - Klik kanan Start Menu → "Command Prompt (Admin)"
   - Atau "Windows PowerShell (Admin)"

2. **Jalankan script:**
   ```bash
   cd C:\BCL\backend
   .\trust-certificate.bat
   ```

3. **Restart browser** dan akses aplikasi

**Hasil:** Address bar akan hijau dengan gembok 🔒

### **Opsi 2: Manual Import Certificate**

1. **Buka Certificate Manager:**
   ```
   Win + R → ketik "certlm.msc" → Enter
   ```

2. **Navigate:**
   ```
   Trusted Root Certification Authorities → Certificates
   ```

3. **Import Certificate:**
   - Right-click → All Tasks → Import
   - File: `C:\BCL\backend\bcl.crt`
   - Place in: "Trusted Root Certification Authorities"

4. **Restart browser**

### **Opsi 3: Accept Warning (Sementara)**

1. **Klik warning** di address bar
2. **Pilih "Advanced"**
3. **Klik "Proceed to 10.0.0.90 (unsafe)"**
4. **Aplikasi akan load dengan HTTPS aktif**

---

## 🌐 **AKSES APLIKASI**

### **URL Akses:**

| **Halaman** | **URL** | **Kegunaan** |
|-------------|---------|--------------|
| **Main Platform** | `https://10.0.0.90:5051/` | Halaman utama BCL |
| **Admin Panel** | `https://10.0.0.90:5051/admin.html` | Panel administrasi |
| **Dashboard** | `https://10.0.0.90:5051/elearning-assets/phase4-dashboard.html` | Monitoring sistem |
| **E-Learning** | `https://10.0.0.90:5051/elearning-assets/` | Platform pembelajaran |

### **Default Credentials:**

**Admin Account:**
- Username: `admin_bcl`
- Password: gunakan password admin yang dikonfigurasi di environment aktif
- Email: `admin@bcl.local`

### **User Registration:**
- User dapat mendaftar sendiri melalui halaman signup
- Password akan di-hash dengan bcrypt
- Email validation aktif

---

## 🗄️ **KONFIGURASI DATABASE**

### **Database Information:**

- **Host:** `localhost`
- **Database:** `bcl_database`
- **User:** `bcl_user`
- **Password:** `BclSecure2025!`

### **Tabel yang Dibuat:**

1. `users` - Data user dengan password ter-hash
2. `user_progress` - Progress pembelajaran
3. `learning_materials` - Materi pembelajaran
4. `exam_materials` - Soal ujian
5. `user_exam_attempts` - Riwayat ujian
6. `level_requests` - Request kenaikan level
7. `bim_media_tags` - Tag media BIM

### **Security Features Database:**

- ✅ **Prepared statements** - Mencegah SQL injection
- ✅ **Password hashing** - bcrypt dengan salt
- ✅ **Input validation** - Validasi data input
- ✅ **Foreign keys** - Data integrity

---

## 📊 **MONITORING DAN MAINTENANCE**

### **Server Health Check:**

```bash
# Health check endpoint
curl -k https://10.0.0.90:5051/ping
```

### **Monitoring Dashboard:**

Akses: `https://10.0.0.90:5051/elearning-assets/phase4-dashboard.html`

**Features:**
- ✅ System status monitoring
- ✅ Memory usage tracking
- ✅ Database connection status
- ✅ Active user sessions
- ✅ API endpoint status

### **Log Files:**

- `server.log` - Server application logs
- `error.log` - Error logs
- `server-run.log` - Startup logs

### **Regular Maintenance:**

1. **Backup database weekly:**
   ```bash
   pg_dump -h localhost -U bcl_user -d bcl_database > backup.sql
   ```

2. **Monitor disk space** untuk logs

3. **Update SSL certificate** sebelum expired

4. **Review user access logs**

---

## 🔧 **TROUBLESHOOTING**

### **Problem: ERR_CONNECTION_REFUSED**

**Solusi:**
```bash
# Cek apakah server running
netstat -ano | findstr :5051

# Jika tidak ada, start server
cd C:\BCL\backend
node server.js
```

### **Problem: Port 5051 Already in Use**

**Solusi:**
```bash
# Kill process yang menggunakan port
netstat -ano | findstr :5051
taskkill /f /pid [PID_NUMBER]

# Start server lagi
node server.js
```

### **Problem: Certificate Trust Failed**

**Solusi:**
- Pastikan menjalankan sebagai Administrator
- Atau import manual melalui certlm.msc
- Restart browser setelah import

### **Problem: Database Connection Failed**

**Solusi:**
- Cek service PostgreSQL running
- Verifikasi kredensial environment variable `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`
- Pastikan database `bcl_database` ada

### **Problem: Cannot Access localhost**

**Solusi:**
- Server bound to `10.0.0.90`, bukan `127.0.0.1`
- Gunakan `https://10.0.0.90:5051/` bukan `https://localhost:5051/`

---

## 🛡️ **SECURITY BEST PRACTICES**

### **Untuk Administrator:**

1. **Change default passwords** setelah setup
2. **Enable firewall** dan restrict port access
3. **Regular backup** database dan certificates
4. **Monitor access logs** untuk suspicious activity
5. **Keep system updated** dengan security patches

### **Untuk Users:**

1. **Use strong passwords** (min 8 characters, mixed case, numbers, symbols)
2. **Enable 2FA** jika tersedia
3. **Don't share credentials**
4. **Log out** setelah selesai menggunakan
5. **Report suspicious activity**

### **Network Security:**

1. **Use HTTPS only** - HTTP disabled
2. **SSL certificate trusted** di semua client devices
3. **Network isolation** - server dalam segment terpisah jika memungkinkan
4. **VPN access** untuk remote administration

### **Data Protection:**

1. **Encrypted database** untuk data sensitif
2. **Regular backups** dengan encryption
3. **Access controls** - principle of least privilege
4. **Audit logging** semua access dan changes

---

## 📞 **SUPPORT & CONTACT**

### **Jika Ada Masalah:**

1. **Cek server logs:** `server.log`
2. **Verify database connection**
3. **Test certificate trust**
4. **Check firewall settings**

### **Emergency Procedures:**

1. **Stop server:** `Ctrl+C` di terminal server
2. **Kill process:** `taskkill /f /im node.exe`
3. **Restart dengan debug:** `set DEBUG=1 && start-bcl-fixed.bat`

---

## 🎉 **KESIMPULAN**

**Sistem BCL sekarang telah dikonfigurasi dengan standar keamanan enterprise untuk environment LAN:**

- ✅ **HTTPS encryption** aktif
- ✅ **Database security** enhanced
- ✅ **User authentication** secure
- ✅ **Session management** proper
- ✅ **Input validation** comprehensive
- ✅ **File upload protection** active
- ✅ **Monitoring & logging** enabled

**Sistem siap digunakan untuk production dengan keamanan yang memadai untuk environment internal perusahaan.** 🚀🔐
