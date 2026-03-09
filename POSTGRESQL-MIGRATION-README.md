# 🗄️ PostgreSQL Migration Guide for BCL

Panduan lengkap migrasi database dari MySQL ke PostgreSQL untuk sistem BC Learning.

---

## 📋 **DAFTAR ISI**
1. [Mengapa PostgreSQL?](#mengapa-postgresql)
2. [Prasyarat](#prasyarat)
3. [Langkah Migrasi](#langkah-migrasi)
4. [Testing & Validasi](#testing--validasi)
5. [Rollback Plan](#rollback-plan)
6. [Troubleshooting](#troubleshooting)

---

## 🤔 **MENGAPA POSTGRESQL?**

### ✅ **Keunggulan untuk BCL:**
1. **JSONB Support**: Perfect untuk metadata video & BIM data
2. **Concurrent Performance**: Handle 100+ concurrent users
3. **Advanced Features**: Full-text search, geospatial, arrays
4. **ACID Compliance**: Data integrity untuk learning progress
5. **Extensible**: Custom functions & data types

### 📊 **Performance Comparison:**
```
MySQL (Current): 12.46 req/sec, 1547ms avg response
PostgreSQL (Target): 100-200 req/sec, <300ms avg response
Improvement: 8-16x faster untuk 20+ concurrent users
```

---

## ⚙️ **PRASYARAT**

### **System Requirements:**
- **RAM**: Minimum 8GB (Recommended 16GB+)
- **Disk**: 50GB free space untuk database
- **Docker**: Version 20.10+
- **Node.js**: Version 18+

### **Environment Variables:**
```bash
# Set environment variables
export DB_PASSWORD="your_secure_password_2025"
export DB_HOST="localhost"
export DB_PORT="5432"
export DB_NAME="bcl_database"
export DB_USER="bcl_user"
```

---

## 🚀 **LANGKAH MIGRASI**

### **Phase 1: Setup PostgreSQL (30 menit)**

#### **1. Jalankan Setup Script**
```bash
# Pastikan environment variables sudah diset
echo $DB_PASSWORD

# Jalankan setup PostgreSQL dengan Docker
./setup-postgres.bat
```

#### **2. Verifikasi Setup**
```bash
# Test PostgreSQL connection
node postgres-config.js

# Check Docker containers
docker ps

# Access pgAdmin di browser
# http://localhost:5050
# Email: admin@bcl.local
# Password: admin123
```

#### **3. Initialize Schema**
```bash
# Schema sudah auto-dibuat saat container start
# Cek di pgAdmin atau via psql
docker exec -it bcl-postgres psql -U bcl_user -d bcl_database -c "\dt"
```

### **Phase 2: Data Migration (45 menit)**

#### **1. Backup MySQL Data**
```bash
# Backup existing MySQL data
mysqldump -u root -p bcl-elearning > mysql_backup_$(date +%Y%m%d).sql
```

#### **2. Jalankan Migration Script**
```bash
# Jalankan migration JSON ke PostgreSQL
node import-json-to-postgres.js
```

#### **3. Monitor Progress**
Script akan menampilkan progress:
```
📊 Migrating table: users
📥 Found 150 records in MySQL users
🔄 Processing batch 1/2 (100 records)
✅ users: 150 migrated, 0 failed

📊 Migrating table: user_progress
📥 Found 120 records in MySQL user_progress
✅ user_progress: 120 migrated, 0 failed
```

### **Phase 3: Application Update (15 menit)**

#### **1. Update server.js Connection**
```javascript
// Ganti import di server.js
// const mysql = require('mysql'); // ❌ Remove
const { pool } = require('../postgres-config'); // ✅ Add

// Ganti dbPool definition
// const dbPool = mysql.createPool({...}); // ❌ Remove
// dbPool sudah tersedia dari postgres-config.js // ✅ Auto
```

#### **2. Update Query Methods**
```javascript
// Old MySQL queries
dbPool.query('SELECT * FROM users WHERE ?', [params], callback);

// New PostgreSQL queries
pool.query('SELECT * FROM users WHERE id = $1', [userId]);
```

#### **3. Test Application**
```bash
# Restart server
npm start

# Test API endpoints
curl http://localhost:5051/api/login
curl http://localhost:5051/api/users
```

### **Phase 4: Monitoring Setup (10 menit)**

#### **1. Health Check**
```bash
# Jalankan health monitoring
node postgres-monitoring.js health
```

#### **2. Backup Setup**
```bash
# Create initial backup
node postgres-monitoring.js backup

# Setup automated backup (optional)
# Add to crontab: 0 2 * * * node postgres-monitoring.js maintenance
```

---

## 🧪 **TESTING & VALIDASI**

### **Functional Testing:**
```bash
# 1. Test user authentication
curl -X POST http://localhost:5051/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# 2. Test data retrieval
curl http://localhost:5051/api/users
curl http://localhost:5051/api/courses

# 3. Test video endpoints
curl http://localhost:5051/api/tutorials
```

### **Performance Testing:**
```bash
# Jalankan load test dengan 20 concurrent users
node backend/load-test.js 20 30 1000

# Expected result: >95% success rate, <500ms avg response
```

### **Data Integrity Check:**
```bash
# Compare record counts
# MySQL: SELECT COUNT(*) FROM users;
# PostgreSQL: SELECT COUNT(*) FROM users;

# Test complex queries
node postgres-monitoring.js health
```

---

## 🔄 **ROLLBACK PLAN**

### **Jika Ada Masalah:**
```bash
# 1. Stop PostgreSQL containers
docker-compose -f docker-compose.postgres.yml down

# 2. Restore MySQL dari backup
mysql -u root -p bcl-elearning < mysql_backup_20241215.sql

# 3. Revert server.js ke MySQL connection
# (uncomment MySQL code, comment PostgreSQL code)

# 4. Restart server
npm start
```

### **Downtime Estimate:**
- **Detection**: 5 minutes
- **Rollback**: 15 minutes
- **Total Downtime**: <30 minutes

---

## 🔧 **TROUBLESHOOTING**

### **Common Issues:**

#### **1. Connection Failed**
```bash
# Check if PostgreSQL is running
docker ps

# Check logs
docker logs bcl-postgres

# Test connection manually
docker exec -it bcl-postgres psql -U bcl_user -d bcl_database
```

#### **2. Migration Errors**
```bash
# Check MySQL connection
mysql -u root -p -e "SELECT 1;"

# Check PostgreSQL schema
docker exec -it bcl-postgres psql -U bcl_user -d bcl_database -c "\dt"

# Re-run migration with verbose logging
DEBUG=1 node import-json-to-postgres.js
```

#### **3. Performance Issues**
```bash
# Check PostgreSQL configuration
docker exec -it bcl-postgres psql -U bcl_user -d bcl_database -c "SHOW ALL;"

# Monitor active connections
node postgres-monitoring.js health

# Check slow queries
docker exec -it bcl-postgres psql -U bcl_user -d bcl_database -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

#### **4. Memory Issues**
```bash
# Increase Docker memory limit
# Edit docker-compose.postgres.yml
services:
  postgres:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
```

---

## 📊 **MONITORING & MAINTENANCE**

### **Daily Monitoring:**
```bash
# Health check
node postgres-monitoring.js health

# Check disk usage
docker system df

# Monitor logs
docker logs --tail 100 bcl-postgres
```

### **Weekly Maintenance:**
```bash
# Vacuum database
docker exec -it bcl-postgres psql -U bcl_user -d bcl_database -c "VACUUM ANALYZE;"

# Backup database
node postgres-monitoring.js backup

# Update statistics
docker exec -it bcl-postgres psql -U bcl_user -d bcl_database -c "ANALYZE;"
```

### **Monthly Reports:**
```bash
# Generate performance report
node postgres-monitoring.js health > monthly_report_$(date +%Y%m).txt

# Check for bloat
docker exec -it bcl-postgres psql -U bcl_user -d bcl_database -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size FROM pg_tables ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 10;"
```

---

## 🎯 **SUCCESS CRITERIA**

### **Migration Successful When:**
- ✅ All data migrated (100% success rate)
- ✅ Application starts without errors
- ✅ API endpoints return correct data
- ✅ Load test passes (>95% success, <500ms avg)
- ✅ User authentication works
- ✅ Video streaming functions
- ✅ Admin panel accessible

### **Performance Targets:**
```
✅ Requests/sec: >100 (dari 12.46)
✅ Avg Response: <500ms (dari 1547ms)
✅ Success Rate: >99%
✅ Concurrent Users: 50+ (dari 20)
```

---

## 📞 **SUPPORT & NEXT STEPS**

### **Post-Migration Tasks:**
1. **Monitor 24-48 hours** untuk stability
2. **Optimize queries** berdasarkan slow logs
3. **Setup automated backups**
4. **Train team** pada PostgreSQL features

### **Advanced Features to Explore:**
- **Full-text search** untuk video content
- **JSONB queries** untuk metadata filtering
- **Partitioning** untuk large tables
- **Replication** untuk high availability

### **Need Help?**
- Check logs: `docker logs bcl-postgres`
- Health check: `node postgres-monitoring.js health`
- Documentation: PostgreSQL official docs

---

## 🎉 **MIGRATION COMPLETE!**

Setelah migration berhasil, sistem BCL akan memiliki:
- **8-16x performance improvement**
- **Advanced JSON capabilities**
- **Better concurrent user handling**
- **Enterprise-grade reliability**

**PostgreSQL siap menggantikan MySQL sebagai database utama BCL!** 🚀

---

*Migration Guide Version: 1.0 | Date: December 2024 | Author: BCL Development Team*
