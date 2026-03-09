# BCL LAN Mount Management - Dokumentasi Lengkap

## Pengenalan

Fitur LAN Mount Management memungkinkan Anda untuk mengakses direktori dan file dari PC lain yang terhubung ke jaringan yang sama (LAN). Ini sangat berguna untuk:

- **Akses kolaboratif**: Berbagi proyek, dokumentasi, dan file media antar lokasi
- **Sentralisasi data**: Akses file dari server di kantor pusat atau lapangan
- **Multi-site management**: Kelola proyek dari berbagai lokasi dalam satu platform

---

## Arsitektur

### Komponen Utama

```
┌─────────────────────────────────────────────────────────────┐
│                    BCL Frontend (Port 5051)                  │
│              /pages/projects.html + admin panel              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTP/HTTPS
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   Express Backend (server.js)                │
│  Route Handler: /api/lan/* (lanMountRoutes.js)               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ JavaScript
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              LAN Mount Manager (lanMountManager.js)          │
│   - Config Management (lan-mounts.json)                      │
│   - SMB/Network Connection via net use (Windows)             │
│   - Mount Point Validation                                   │
│   - Directory Listing & Access Testing                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Windows net use / CIFS mount
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              Network Shares (Other PCs)                      │
│   \\192.168.1.100\projects                                   │
│   \\192.168.1.50\site-docs                                   │
│   \\fileserver.company.local\archive                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Cara Setup LAN Mounting

### Prasyarat

1. **Windows PC dengan Node.js** — Backend harus berjalan di Windows untuk dukungan penuh
2. **Network Access** — PC target harus accessible via LAN (UNC path atau IP address)
3. **Credentials** — Username & password untuk akses network share (jika diperlukan)
4. **Drive Letter Available** — Pada Windows: drive letter kosong untuk mount point (default Z:, X:, dll)

### Step 1: Edit Konfigurasi `lan-mounts.json`

File konfigurasi berada di: `c:\BCL\backend\lan-mounts.json`

**Contoh konfigurasi untuk multiple PC:**

```json
{
  "mounts": [
    {
      "id": "kantor-pusat",
      "name": "Kantor Pusat - Server Proyek",
      "host": "192.168.1.100",
      "shareName": "projects",
      "remotePath": "\\\\192.168.1.100\\projects",
      "localMountPoint": "Z:",
      "enabled": true,
      "username": "admin",
      "password": "secure-password",
      "status": "disconnected",
      "lastConnected": null,
      "notes": "Server proyek utama - auto-connect di startup"
    },
    {
      "id": "lapangan-a",
      "name": "Lapangan Site A",
      "host": "192.168.1.50",
      "shareName": "site-docs",
      "remotePath": "\\\\192.168.1.50\\site-docs",
      "localMountPoint": "X:",
      "enabled": false,
      "username": "site-user",
      "password": "site-password",
      "status": "disconnected",
      "lastConnected": null,
      "notes": "Dokumentasi lapangan - manual connect"
    },
    {
      "id": "fileserver-main",
      "name": "File Server - Arsip",
      "host": "fileserver.company.local",
      "shareName": "archive",
      "remotePath": "\\\\fileserver.company.local\\archive",
      "localMountPoint": "Y:",
      "enabled": false,
      "username": "domain\\username",
      "password": "domain-password",
      "status": "disconnected",
      "lastConnected": null,
      "notes": "Arsip proyek lama - backup & archive"
    }
  ],
  "settings": {
    "autoMount": false,
    "autoMountOnStartup": false,
    "reconnectInterval": 30000,
    "timeoutMs": 10000,
    "maxRetries": 3
  }
}
```

### Step 2: Konfigurasi Settings

Dalam `settings` di `lan-mounts.json`:

| Opsi | Default | Penjelasan |
|------|---------|-----------|
| `autoMount` | `false` | Auto-reconnect saat server restart |
| `autoMountOnStartup` | `false` | Koneksi otomatis pada startup (set enabled mounts) |
| `reconnectInterval` | 30000ms | Interval untuk retry koneksi gagal |
| `timeoutMs` | 10000ms | Timeout untuk operasi koneksi |
| `maxRetries` | 3 | Jumlah retry maksimal untuk koneksi |

---

## API Endpoints

### Base URL
```
http://localhost:5051/api/lan
```

### 1. Get All Mounts
```http
GET /api/lan/mounts
```

**Response:**
```json
{
  "success": true,
  "mounts": [
    {
      "id": "kantor-pusat",
      "name": "Kantor Pusat - Server Proyek",
      "host": "192.168.1.100",
      "localMountPoint": "Z:",
      "status": "connected",
      "lastConnected": "2025-11-28T10:30:45.123Z"
    }
  ],
  "count": 1,
  "settings": { ... }
}
```

### 2. Add New Mount
```http
POST /api/lan/mounts
Header: x-admin-token: AdminBCL2025!
Content-Type: application/json
```

**Request Body:**
```json
{
  "id": "new-mount",
  "name": "New Network Share",
  "remotePath": "\\\\192.168.1.200\\shared-folder",
  "username": "user@domain",
  "password": "password",
  "enabled": false,
  "notes": "Deskripsi mount"
}
```

### 3. Connect to Mount
```http
POST /api/lan/mounts/{id}/connect
Header: x-admin-token: AdminBCL2025!
```

**Response:**
```json
{
  "success": true,
  "message": "Connected successfully",
  "mount": {
    "id": "kantor-pusat",
    "status": "connected",
    "localMountPoint": "Z:",
    "lastConnected": "2025-11-28T10:35:20.456Z"
  }
}
```

### 4. List Mount Contents
```http
GET /api/lan/mounts/{id}/contents?path=subfolder/path
```

**Response:**
```json
{
  "success": true,
  "mount": "kantor-pusat",
  "path": "/",
  "contents": [
    {
      "name": "2025 Projects",
      "isDirectory": true,
      "path": "2025 Projects"
    },
    {
      "name": "site_survey.dwg",
      "isDirectory": false,
      "path": "site_survey.dwg"
    }
  ]
}
```

### 5. Check Mount Status
```http
GET /api/lan/mounts/{id}/status
```

**Response:**
```json
{
  "success": true,
  "mount": { ... },
  "isConnected": true,
  "accessTest": {
    "accessible": true,
    "readable": true,
    "isDirectory": true,
    "path": "Z:",
    "message": "Mount dapat diakses"
  }
}
```

### 6. Disconnect Mount
```http
POST /api/lan/mounts/{id}/disconnect
Header: x-admin-token: AdminBCL2025!
```

### 7. Get LAN Info
```http
GET /api/lan/info
```

**Response:**
```json
{
  "success": true,
  "info": {
    "platform": "win32",
    "totalMounts": 3,
    "connectedMounts": 1,
    "enabledMounts": 1,
    "autoMountEnabled": false,
    "config": { ... }
  }
}
```

---

## Contoh Penggunaan

### PowerShell Script untuk Connect

```powershell
# Connect ke mount
$token = "AdminBCL2025!"
$headers = @{ "x-admin-token" = $token }

# Connect
Invoke-RestMethod -Uri "http://localhost:5051/api/lan/mounts/kantor-pusat/connect" `
  -Method POST `
  -Headers $headers

# Check status
Invoke-RestMethod -Uri "http://localhost:5051/api/lan/mounts/kantor-pusat/status" `
  -Headers $headers

# List contents
Invoke-RestMethod -Uri "http://localhost:5051/api/lan/mounts/kantor-pusat/contents?path=2025%20Projects" `
  -Headers $headers
```

### JavaScript/Fetch untuk Web UI

```javascript
// Fetch all mounts
async function loadMounts() {
    const response = await fetch('http://localhost:5051/api/lan/mounts');
    const data = await response.json();
    console.log('Mounted shares:', data.mounts);
    return data.mounts;
}

// Connect to mount
async function connectMount(mountId) {
    const response = await fetch(
        `http://localhost:5051/api/lan/mounts/${mountId}/connect`,
        {
            method: 'POST',
            headers: { 'x-admin-token': 'AdminBCL2025!' }
        }
    );
    const data = await response.json();
    console.log('Connection result:', data);
    return data;
}

// List mount contents
async function listContents(mountId, path = '') {
    const url = new URL('http://localhost:5051/api/lan/mounts/' + mountId + '/contents');
    if (path) url.searchParams.append('path', path);
    
    const response = await fetch(url);
    const data = await response.json();
    console.log('Contents:', data.contents);
    return data.contents;
}
```

---

## Integrasi dengan Projects Gallery

### Cara menambahkan mounted shares ke `/pages/projects.html`:

**Backend modification** (`server.js`):

```javascript
// New endpoint to include LAN mounts in project discovery
app.get('/api/all-project-sources', (req, res) => {
    const lanManager = require('./utils/lanMountManager');
    const sources = [];

    // Add local projects
    sources.push({
        type: 'local',
        label: 'Local Projects',
        path: BASE_PROJECT_DIR
    });

    // Add LAN mounts
    const mounts = lanManager.getAllMounts();
    for (const mount of mounts) {
        if (mount.status === 'connected') {
            sources.push({
                type: 'lan',
                id: mount.id,
                label: mount.name,
                path: mount.localMountPoint
            });
        }
    }

    res.json({ success: true, sources });
});
```

**Frontend modification** (`xx.js`):

```javascript
// Modify openYear to include LAN sources
async function openYear(year, source = 'local') {
    if (source === 'local') {
        // Existing logic
        fetch(`/api/projects/${year}`)...
    } else if (source.startsWith('lan-')) {
        // LAN mount source
        const mountId = source.replace('lan-', '');
        fetch(`/api/lan/mounts/${mountId}/contents`)
            .then(r => r.json())
            .then(data => renderProjectsFromLAN(data.contents));
    }
}
```

---

## Troubleshooting

### Problem: "The network path was not found"
**Solusi:**
- Verifikasi UNC path benar: `\\192.168.1.100\sharename` atau `\\servername\sharename`
- Pastikan PC target accessible via ping: `ping 192.168.1.100`
- Check network share permissions

### Problem: "Access Denied"
**Solusi:**
- Verifikasi username & password benar
- Pastikan user punya permission untuk shared folder
- Cek firewall di PC target

### Problem: Mount tidak auto-connect
**Solusi:**
- Set `enabled: true` di konfigurasi
- Set `autoMountOnStartup: true` di settings
- Restart backend server

### Problem: Drive letter sudah terpakai
**Solusi:**
- Disconnect mount yang lama terlebih dahulu
- Atau ubah `localMountPoint` ke drive lain yang available

---

## Best Practices

1. **Security**
   - Jangan hardcode password di file konfigurasi untuk production
   - Use environment variables: `process.env.LAN_PASSWORD`
   - Gunakan service account dengan minimal permissions

2. **Performance**
   - Jangan mount terlalu banyak share sekaligus
   - Set timeout & retry interval yang sesuai
   - Monitor connection health

3. **Maintenance**
   - Regular backup of `lan-mounts.json`
   - Document semua mount configurations
   - Test connectivity sebelum production deployment

4. **Monitoring**
   - Monitor `/api/lan/info` untuk health check
   - Log koneksi success/failure
   - Alert jika critical mount disconnect

---

## Contoh Konfigurasi untuk Multi-Site Project

```json
{
  "mounts": [
    {
      "id": "hq-projects",
      "name": "HQ - All Projects Archive",
      "remotePath": "\\\\HQ-SERVER\\projects",
      "localMountPoint": "P:",
      "enabled": true,
      "username": "domain\\admin",
      "notes": "Central repository - read-only"
    },
    {
      "id": "site-a-current",
      "name": "Site A - Current Work",
      "remotePath": "\\\\SITE-A-PC\\current-projects",
      "localMountPoint": "Q:",
      "enabled": true,
      "username": "site-a\\tech",
      "notes": "Active site operations"
    },
    {
      "id": "site-b-docs",
      "name": "Site B - Documentation",
      "remotePath": "\\\\SITE-B-SERVER\\docs",
      "localMountPoint": "R:",
      "enabled": false,
      "username": "site-b\\manager",
      "notes": "Site B documentation archive"
    }
  ],
  "settings": {
    "autoMount": true,
    "autoMountOnStartup": true,
    "reconnectInterval": 60000,
    "timeoutMs": 15000,
    "maxRetries": 5
  }
}
```

---

## Testing Endpoints (cURL)

```bash
# Get all mounts
curl http://localhost:5051/api/lan/mounts

# Check specific mount status
curl -H "x-admin-token: AdminBCL2025!" \
  http://localhost:5051/api/lan/mounts/kantor-pusat/status

# Connect
curl -X POST -H "x-admin-token: AdminBCL2025!" \
  http://localhost:5051/api/lan/mounts/kantor-pusat/connect

# List contents
curl "http://localhost:5051/api/lan/mounts/kantor-pusat/contents?path=2025"

# Disconnect
curl -X POST -H "x-admin-token: AdminBCL2025!" \
  http://localhost:5051/api/lan/mounts/kantor-pusat/disconnect
```

---

## Status Kode & Responses

| HTTP Status | Keterangan |
|-------------|-----------|
| 200 OK | Success |
| 201 Created | Mount berhasil dibuat |
| 400 Bad Request | Invalid input/configuration |
| 403 Forbidden | Admin token tidak valid |
| 404 Not Found | Mount tidak ditemukan |
| 500 Internal Error | Server/system error |

---

Untuk pertanyaan atau issue, cek logs di: `C:\BCL\backend\logs\`

Last Updated: November 28, 2025  
Version: 1.0.0  
Status: ✅ Production Ready
