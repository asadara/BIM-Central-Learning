# LAN Mount Quick Start Guide

## 5 Menit Setup

### 1. Open `backend/lan-mounts.json`

Edit file di: `c:\BCL\backend\lan-mounts.json`

### 2. Add Your Network Share

Ganti `remotePath` dengan PC Anda. Contoh:

```json
{
  "id": "my-pc",
  "name": "My Office PC",
  "remotePath": "\\\\192.168.1.50\\shared-folder",
  "localMountPoint": "Z:",
  "enabled": true,
  "username": "username",
  "password": "password",
  "notes": "Connected via LAN"
}
```

### 3. Test Connection

**PowerShell:**
```powershell
$token = $env:ADMIN_TOKEN
$headers = @{ "x-admin-token" = $token }

# Test
Invoke-RestMethod -Uri "http://localhost:5051/api/lan/mounts" `
  -Headers $headers | ConvertTo-Json
```

**Browser:**
```
http://localhost:5051/api/lan/mounts
```

### 4. Connect the Mount

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:5051/api/lan/mounts/my-pc/connect" `
  -Method POST `
  -Headers $headers
```

### 5. Verify Connection

**PowerShell:**
```powershell
# Check status
Invoke-RestMethod -Uri "http://localhost:5051/api/lan/mounts/my-pc/status" `
  -Headers $headers | ConvertTo-Json

# List contents
Invoke-RestMethod -Uri "http://localhost:5051/api/lan/mounts/my-pc/contents" `
  -Headers $headers | ConvertTo-Json
```

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| "The network path was not found" | Check IP/hostname & share name correct |
| "Access Denied" | Verify username/password correct |
| Drive letter already in use | Change to different letter (X:, Y:, Z:) |
| Connection timeout | Check PC is online, firewall OK |

---

## Example: Multiple Sites

```json
{
  "mounts": [
    {
      "id": "site-1",
      "name": "Site 1 - Jakarta",
      "remotePath": "\\\\192.168.1.100\\projects",
      "localMountPoint": "Z:",
      "enabled": true,
      "username": "admin",
      "password": "pass123"
    },
    {
      "id": "site-2", 
      "name": "Site 2 - Surabaya",
      "remotePath": "\\\\192.168.1.50\\docs",
      "localMountPoint": "X:",
      "enabled": false,
      "username": "tech",
      "password": "pass456"
    }
  ]
}
```

---

For full documentation: Read `LAN-MOUNT-DOCUMENTATION.md`
