# Manual Setup: Tambahkan PC-BIM02 sebagai Source Data Project

## 📋 Langkah-langkah Setup

### 1. **Konfigurasi LAN Mount**

Gunakan API call berikut untuk menambahkan PC-BIM02:

```bash
curl -X POST "http://localhost:5051/api/lan/mounts" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: AdminBCL2025!" \
  -d '{
    "id": "pc-bim02",
    "name": "PC-BIM02 PROJECT BIM 2025",
    "host": "pc-bim02",
    "shareName": "PROJECT BIM 2025",
    "remotePath": "\\\\pc-bim02\\PROJECT BIM 2025",
    "localMountPoint": "X:",
    "enabled": true,
    "username": "user",
    "password": "nke86",
    "notes": "Network share dari PC-BIM02 untuk project 2025"
  }'
```

**⚠️ PENTING:**
- Ganti `username` dan `password` dengan kredensial yang benar untuk akses PC-BIM02
- Pastikan PC-BIM02 dapat diakses di network dan folder `PROJECT BIM 2025` sudah dibagikan

### 2. **Connect ke LAN Mount**

```bash
curl -X POST "http://localhost:5051/api/lan/mounts/pc-bim02/connect" \
  -H "x-admin-token: AdminBCL2025!"
```

### 3. **Verifikasi Connection**

```bash
curl "http://localhost:5051/api/lan/mounts/pc-bim02/status"
```

### 4. **Manual Integration dengan Projects API**

Tambahkan code ini ke `backend/server.js` setelah bagian `PROJECT_SOURCES`:

```javascript
// Helper function untuk scan multiple sources
async function getYearsFromMultipleSources() {
    const allYears = new Set();

    for (const source of PROJECT_SOURCES) {
        if (!source.enabled) continue;

        try {
            const sourcePath = source.mountId ?
                await getMountedPath(source.mountId) :
                source.path;

            if (!sourcePath || !fs.existsSync(sourcePath)) continue;

            const items = fs.readdirSync(sourcePath, { withFileTypes: true });
            const sourceYears = items
                .filter(item => item.isDirectory() && item.name.startsWith(PROJECT_PREFIX))
                .map(item => item.name.replace(PROJECT_PREFIX, ''));

            sourceYears.forEach(year => allYears.add(year));
        } catch (err) {
            console.warn(`⚠️ Error scanning ${source.id}:`, err.message);
        }
    }

    return Array.from(allYears).sort((a, b) => b.localeCompare(a));
}

// Helper untuk get mounted path
async function getMountedPath(mountId) {
    try {
        const LANMountManager = require('./utils/lanMountManager');
        const lanManager = new LANMountManager();
        const mount = lanManager.getMountById(mountId);
        return mount && mount.status === 'connected' ? mount.localMountPoint : null;
    } catch (err) {
        return null;
    }
}
```

### 5. **Update API Endpoints**

Update `/api/years` endpoint untuk support multi-source:

```javascript
// 🔹 UPDATE: GET /api/years → ambil semua folder tahun dari multiple sources
app.get('/api/years', async (req, res) => {
    try {
        const years = await getYearsFromMultipleSources();
        res.json({
            years,
            sources: PROJECT_SOURCES.filter(s => s.enabled)
        });
    } catch (err) {
        console.error('Error reading years from multiple sources:', err);
        res.status(500).json({
            error: 'Failed to read year folders',
            detail: err.message
        });
    }
});
```

### 6. **Enable PC-BIM02 Source**

Setelah mount terhubung, enable source:

```javascript
// Dalam PROJECT_SOURCES, ubah enabled menjadi true untuk pc-bim02-2025
PROJECT_SOURCES.find(s => s.id === 'pc-bim02-2025').enabled = true;
```

## 🧪 Testing

### Test LAN Mount
```bash
# List semua mounts
curl "http://localhost:5051/api/lan/mounts"

# Test akses folder PC-BIM02
curl "http://localhost:5051/api/lan/mounts/pc-bim02/contents"
```

### Test Projects Page
1. Buka: `http://localhost:5051/pages/projects.html`
2. Cek apakah project dari PC-BIM02 muncul
3. Verify media dapat diakses

## 🔧 Troubleshooting

### 1. **PC-BIM02 Tidak Dapat Diakses**
```cmd
REM Manual connection test
net use X: \\pc-bim02\PROJECT BIM 2025 /user:username password
```

### 2. **Mount Connection Failed**
- Pastikan PC-BIM02 aktif dan network reachable
- Cek sharing permissions pada PC-BIM02
- Verify IP address 10.0.0.122 reachable: `ping 10.0.0.122`

### 3. **Projects Tidak Muncul**
- Restart server setelah enable source baru
- Check server logs untuk error messages
- Verify folder structure di PC-BIM02 mirip dengan G:/ (PROJECT 2025/[project-folders])

## 📋 API Cheat Sheet

```bash
# Manage LAN mounts
GET    /api/lan/mounts                    # List mounts
GET    /api/lan/mounts/{id}              # Mount details
POST   /api/lan/mounts                   # Add mount
PUT    /api/lan/mounts/{id}              # Update mount
DELETE /api/lan/mounts/{id}              # Delete mount
POST   /api/lan/mounts/{id}/connect      # Connect mount
POST   /api/lan/mounts/{id}/disconnect   # Disconnect mount
GET    /api/lan/mounts/{id}/status       # Mount status
GET    /api/lan/mounts/{id}/contents     # List contents

# Projects (updated to multi-source)
GET    /api/years                        # All years from all sources
GET    /api/projects/{year}              # Projects for specific year
GET    /api/project-media/{year}/{proj}  # Media for specific project
