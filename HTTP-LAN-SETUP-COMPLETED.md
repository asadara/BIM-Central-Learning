# HTTP LAN Setup - BCL Environment Configuration

## 📋 Overview
BCL menggunakan konfigurasi HTTP-only untuk environment LAN guna memastikan akses yang bersih tanpa redirect HTTPS yang tidak diinginkan.

## ✅ Current Configuration

### 1. Nginx Reverse Proxy (Port 80)
- **Status**: ✅ Active
- **Configuration**: Direct proxy to backend (no HTTPS redirect)
- **HSTS**: Disabled for LAN environment
- **Domain**: `bcl.nke.net` → `10.0.0.90`

### 2. Backend Server (Port 5051)
- **Status**: ✅ Active
- **Protocol**: HTTP only
- **Environment**: `USE_HTTPS=false`

### 3. DNS Resolution
- **Hosts File**: `10.0.0.90 bcl.nke.net`
- **Status**: ✅ Configured

## 🚨 Common Issues & Solutions

### Issue 1: Browser Shows HTTPS Instead of HTTP
**Symptom**: `http://bcl.nke.net` redirects to `https://bcl.nke.net`

**Root Cause**: HSTS (HTTP Strict Transport Security) cache in browser

**Solution**:
```bash
# Chrome HSTS Clear
1. Open chrome://net-internals/#hsts
2. Enter bcl.nke.net in "Delete domain"
3. Click Delete
4. Restart browser
```

**Prevention**: Nginx config already includes `add_header Strict-Transport-Security "" always;` to disable HSTS

### Issue 2: Cannot Access bcl.nke.net
**Symptom**: Connection refused or DNS resolution failed

**Check**:
1. Verify hosts file: `type C:\Windows\System32\drivers\etc\hosts | findstr bcl.nke.net`
2. Test DNS: `ping bcl.nke.net`
3. Check nginx: `netstat -an | findstr :80`

### Issue 3: Backend Server Not Responding
**Symptom**: `localhost:5051` not accessible

**Check**:
1. Process status: `powershell -NoProfile -Command "Get-Process node"`
2. Logs: Check `server.log`
3. Port binding: `netstat -an | findstr 5051`

## 🛠️ Environment Setup Commands

### Initial Setup
```batch
# 1. Update hosts file
echo 10.0.0.90 bcl.nke.net >> C:\Windows\System32\drivers\etc\hosts

# 2. Start services
.\start-bcl-fixed.bat
```

### Troubleshooting
```batch
# Clear DNS cache
ipconfig /flushdns

# Restart services
powershell -NoProfile -Command "Stop-Process -Name node,nginx -Force"
.\start-bcl-fixed.bat
```

### Browser Reset
```bash
# Chrome complete reset for bcl.nke.net
1. Clear browsing data (last 24 hours)
2. Clear HSTS cache (chrome://net-internals/#hsts)
3. Restart browser
```

## 📊 Architecture Summary

```
User Request → bcl.nke.net:80 (Nginx) → localhost:5051 (Node.js Backend) → Frontend Files
                      ↓
              Hosts File Resolution
              10.0.0.90 bcl.nke.net
```

## 🔒 Security Notes

- **LAN Environment**: HTTP-only, no SSL required
- **HSTS Disabled**: Prevents unwanted HTTPS redirects
- **Local Access**: Optimized for internal network use
- **No Certificates**: Self-signed certs not needed for LAN

## 📝 Maintenance Checklist

- [ ] Hosts file contains correct IP for bcl.nke.net
- [ ] Nginx config has HSTS disabled
- [ ] Backend server starts on port 5051
- [ ] Browser HSTS cache cleared if HTTPS issues occur
- [ ] All services restart properly after reboot

## 🎯 Access URLs

- **Main Platform**: http://bcl.nke.net or http://10.0.0.90
- **Admin Panel**:   http://bcl.nke.net/admin.html
- **API Endpoints**: http://bcl.nke.net/api/*
- **Direct Backend**: http://localhost:5051 (for debugging)

## 🚨 Network Access Troubleshooting

### Issue: 502 Bad Gateway from other devices

**Symptoms:**
- `http://bcl.nke.net` works on local machine
- `502 Bad Gateway nginx/1.28.0` from other devices on same network

**Root Causes & Solutions:**

#### 1. Windows Firewall Blocking Network Access
```cmd
# Run as Administrator
netsh advfirewall firewall add rule name="BCL HTTP Port 80" dir=in action=allow protocol=TCP localport=80
netsh advfirewall firewall add rule name="BCL Backend Port 5051" dir=in action=allow protocol=TCP localport=5051
```

#### 2. Backend Server Not Responding to Network Requests
- ✅ Backend binds to `0.0.0.0:5051` (all interfaces)
- ✅ Port 5051 LISTENING on all interfaces
- ❌ May not respond to HTTP requests from network

**Test Commands:**
```cmd
# Check if ports are open
netstat -an | findstr :80
netstat -an | findstr :5051

# Test backend directly
curl http://127.0.0.1:5051/ping
```

#### 3. DNS Resolution Issues on Client Devices
Ensure client devices can resolve `bcl.nke.net` to `10.0.0.90`

#### 4. Nginx Configuration Conflicts
- ✅ HSTS disabled for LAN
- ✅ Default server configured
- ✅ Proxy timeout settings adequate

## 🔧 Quick Network Access Setup

1. **Run Firewall Configuration** (as Administrator):
   ```cmd
   .\configure-firewall.bat
   ```

2. **Restart All Services**:
   ```cmd
   .\start-bcl-fixed.bat
   ```

3. **Test Access from Another Device**:
   - Open browser on another device
   - Navigate to: `http://10.0.0.90`
   - Or: `http://bcl.nke.net` (if hosts file configured on client)

## 📱 Mobile/Tablet Responsiveness

### Issue: Navbar Menu Not Visible on Tablet 11"

**Symptoms:**
- Main page loads successfully on tablet
- Navbar menu items not visible on tablet 11"
- Hamburger button may not be visible or functional

**Root Cause:** Bootstrap navbar using `navbar-expand-lg` breakpoint (992px)

**Solution Applied:**
- ✅ Changed breakpoint from `navbar-expand-lg` to `navbar-expand-md` (768px)
- ✅ Added tablet-specific CSS for 1024px-1366px screens
- ✅ Enhanced hamburger button with better touch interaction
- ✅ Added JavaScript for dynamic navbar behavior

**Navbar Changes:**
```html
<!-- Before -->
<nav class="navbar navbar-expand-md ...">

<!-- After -->
<nav class="navbar navbar-expand-lg ...">
```

**Hamburger Menu Implementation:**
- **Breakpoint**: `navbar-expand-lg` (992px) - Expand di desktop, hamburger di tablet
- **Tablet 11" (1024px)**: ✅ **Hamburger menu WAJIB** (menu tersembunyi)
- **Desktop (>992px)**: ✅ Full navbar expand (menu terlihat)

**Hamburger Menu Features:**
- **Forced hamburger**: `!important` override untuk memastikan hamburger muncul
- **Touch-friendly hamburger button**: 44x44px minimum (50x50px recommended)
- **Full-screen overlay menu**: Positioned below navbar dengan backdrop blur
- **Smooth animations**: Scale dan transform effects saat hover
- **Enhanced dropdown menus**: Dalam hamburger dengan proper touch interaction
- **Touch-optimized menu items**: 48px minimum height untuk semua items
- **Compact logo**: Optimized untuk space efficiency di mobile/tablet

**Tablet-Specific Features:**
- Landscape tablets (1024px-1366px): Hamburger menu with overlay
- Portrait tablets (768px-1024px): Touch-optimized hamburger interface
- Enhanced dropdown menus with proper touch interaction
- Logo stays prominent while menu is hidden

### Testing Responsiveness

**On Tablet 11":**
1. Open `http://10.0.0.90` or `http://bcl.nke.net`
2. Navbar menu should be visible without hamburger button
3. All dropdown menus should work with touch
4. Content should be properly sized for tablet screen

**Responsive Breakpoints:**
- **Desktop (>1024px)**: Full navbar always visible
- **Tablet Landscape (1024px-1366px)**: Navbar always expanded, no hamburger
- **Tablet Portrait (768px-1024px)**: Touch-optimized menu items
- **Mobile (<768px)**: Collapsible menu with enhanced hamburger

## 🎬 Video Access Troubleshooting

### Issue: Video Not Loading on Network Devices

**Symptoms:**
- Main page loads successfully
- Video list appears but clicking play shows "Gagal memuat video!"
- Video streaming fails from tablets/phones

**Root Cause:** JavaScript hardcoded to use HTTPS instead of HTTP for LAN environment

**Solution Applied:**
- ✅ Fixed all `fetch()` calls to use `window.location.protocol` (HTTP for LAN)
- ✅ Updated video URL generation to use correct protocol
- ✅ Fixed thumbnail URLs to use HTTP protocol
- ✅ Updated API endpoints to use dynamic protocol detection

**JavaScript Changes Made:**
```javascript
// Before (BROKEN):
fetch(`https://${window.location.hostname}/api/tutorials`)

// After (FIXED):
const protocol = window.location.protocol; // 'http:' or 'https:'
fetch(`${protocol}//${window.location.hostname}/api/tutorials`)
```

### Testing Video Access

**From Local Machine:**
```bash
# Test video API access
curl http://localhost:5051/api/tutorials
```

**From Network Device:**
1. Open `http://10.0.0.90/pages/tutorial.html`
2. Video list should load
3. Clicking video should play (not show error)

### Common Video Issues

#### Issue 1: CORS Errors
- **Cause**: Browser blocking cross-origin requests
- **Solution**: Already fixed with dynamic protocol detection

#### Issue 2: Video Stream URL Wrong
- **Cause**: Hardcoded HTTPS URLs
- **Solution**: All video URLs now use `window.location.protocol`

#### Issue 3: API Calls Fail
- **Cause**: Frontend trying to call HTTPS API
- **Solution**: All API calls now use HTTP for LAN environment

## 📞 Support

If issues persist:
1. Check this document first
2. Verify all services are running
3. Clear browser cache and HSTS
4. Restart all services
5. Check logs for error details
