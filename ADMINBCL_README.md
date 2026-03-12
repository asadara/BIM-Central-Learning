# AdminBCL - Tagline Management System

## Overview
Sistem ini memungkinkan AdminBCL untuk mengelola tagline materi kursus secara manual, sehingga pengelompokan materi menjadi lebih akurat dan sesuai kebutuhan pembelajaran.

## Fitur Utama

### 1. User AdminBCL
- **Username**: AdminBCL
- **Password**: gunakan password admin yang dikonfigurasi di environment aktif
- **Role**: Administrator dengan full access
- **Permissions**:
  - Manage users
  - Manage content
  - Manage tags
  - View analytics
  - System settings

### 2. Tagline Management
- Tambahkan tagline manual untuk video, PDF, dan file lainnya
- Kelompokkan materi berdasarkan kategori yang ditentukan
- Override pengelompokan otomatis berdasarkan nama file

### 3. Category System
Sistem kategori yang dapat dikustomisasi:
- **beginner**: Pemula
- **intermediate**: Menengah
- **advanced**: Lanjutan
- **modeling**: Teknik Modeling 3D
- **coordination**: Koordinasi Proyek BIM
- **analysis**: Analisis dan Simulasi
- **documentation**: Dokumentasi Proyek
- **workflow**: Proses Kerja BIM

## Cara Menggunakan

### 1. Akses Admin Panel
1. Login sebagai AdminBCL
2. Akses `http://localhost:5051/admin.html`

### 2. Mengelola Tagline
1. Pilih tab "Manage Materials"
2. Klik tombol "Edit" pada materi yang ingin diberi tagline
3. Masukkan tagline yang deskriptif
4. Pilih kategori yang sesuai
5. Klik "Save Tagline"

### 3. Menambah Kategori Baru
1. Pilih tab "Categories"
2. Klik "Add Category"
3. Isi informasi kategori:
   - Category ID (slug)
   - Category Name
   - Description
   - Color (hex code)
   - Icon (FontAwesome class)

### 4. API Endpoints

#### Authentication
Semua API admin memerlukan header:
```
x-admin-token: <ADMIN_TOKEN dari environment>
```

#### Endpoints:
- `GET /api/admin/tags` - Mendapatkan semua tagline
- `POST /api/admin/tags/video` - Menambah tagline video
- `POST /api/admin/tags/pdf` - Menambah tagline PDF
- `DELETE /api/admin/tags/:type/:filename` - Menghapus tagline
- `GET /api/admin/materials` - Mendapatkan semua materi dengan tagline
- `POST /api/admin/categories` - Menambah kategori baru

## Contoh Tagline

### Video BIM Dasar:
```
Tagline: "Pengenalan komprehensif Building Information Modeling untuk pemula"
Category: beginner
```

### Tutorial Advanced:
```
Tagline: "Teknik modeling kompleks menggunakan parametric design di Revit"
Category: advanced
```

### Workflow Training:
```
Tagline: "Panduan lengkap proses kerja BIM dari konsep hingga delivery"
Category: workflow
```

## Prioritas Pengelompokan

1. **Tagline Manual** (jika tersedia) - Prioritas tertinggi
2. **Ekstraksi Otomatis** dari nama file - Fallback

## File Structure

```
c:\BCL\
├── backend\
│   ├── users.json                 # AdminBCL user data
│   ├── tags.json                  # Manual taglines database
│   ├── routes\
│   │   ├── adminRoutes.js         # Admin API endpoints
│   │   └── tutorialRoutes.js      # Updated with tagline priority
│   └── server.js                  # Updated with admin routes
├── BC-Learning-Main\
│   ├── admin.html                 # Admin management interface
│   ├── courses.html               # Course listing with admin features
│   ├── course-detail.html         # Course detail with tagline display
│   ├── learning-path.html         # Learning paths with admin integration
│   ├── phase3-dashboard.html      # Dashboard with admin controls
│   └── index.html                 # Main landing page
└── ADMINBCL_README.md             # This documentation
```

## UI Components

### Admin Banner
- Displays welcome message for AdminBCL users
- Quick access to admin panel
- Shows only when user has admin privileges

### Admin Controls
- **Manage Taglines**: Direct link to admin panel
- **Tagline Stats**: View tagline statistics
- **Quick Actions**: Fast access to common admin tasks

### Tagline Indicators
- **Manual Tag Badge**: Shows when material has manual tagline
- **Category Display**: Visual category indicators
- **Priority Highlighting**: Manual tags highlighted over automatic

## Integration Points

### 1. Tutorial Routes (`tutorialRoutes.js`)
```javascript
// Priority system for taglines
const tagline = manualTags[videoPath] || autoExtractedTagline;
```

### 2. Course Display
- Manual taglines displayed prominently
- Category-based filtering
- Admin controls for tagline management

### 3. Learning Paths
- Materials categorized by experience level
- Manual tags influence path recommendations
- Progress tracking with tagline awareness

### 4. Dashboard Analytics
- Tagline usage statistics
- Manual vs automatic categorization metrics
- Admin activity monitoring

## Usage Instructions

### For AdminBCL Users

1. **Login**: Use AdminBCL credentials
2. **Access Admin Panel**: Click "Admin Panel" in navigation or banner
3. **Manage Taglines**:
   - Browse existing taglines
   - Add new manual taglines
   - Edit existing taglines
   - Delete outdated taglines
4. **Monitor System**: View dashboard with tagline statistics

### For Regular Users

1. **Browse Courses**: Visit courses.html to see available materials
2. **View Taglines**: Manual taglines are highlighted with badges
3. **Learning Paths**: Choose paths based on experience level
4. **Track Progress**: Dashboard shows learning progress

## Technical Implementation

### Authentication Flow
```
1. User logs in with AdminBCL credentials
2. Server validates against users.json
3. JWT token generated and returned
4. Token stored in localStorage
5. Subsequent requests include token in headers
6. Server verifies token for admin operations
```

### Tagline Priority System
```
Manual Tagline (Highest Priority)
    ↓
Auto-Extracted Tagline (Fallback)
    ↓
Default Categorization (Lowest Priority)
```

### Demo Admin Mode
For testing purposes, all pages include a demo admin toggle button (bottom-right corner) that allows switching to admin mode without full authentication. **Remove this in production.**

---

## Keamanan

- Semua endpoint admin memerlukan token autentikasi
- User AdminBCL memiliki permissions penuh
- Logging untuk semua perubahan tagline
- Backup otomatis file tags.json

## Troubleshooting

### Tidak bisa mengakses admin panel:
1. Pastikan server berjalan di port 5051
2. Periksa token autentikasi
3. Cek console browser untuk error

### Tagline tidak tersimpan:
1. Periksa koneksi ke server
2. Pastikan format data benar
3. Cek permission file tags.json

### Kategori tidak muncul:
1. Refresh halaman admin
2. Periksa file tags.json
3. Restart server jika diperlukan

## Support

Untuk bantuan teknis atau pertanyaan:
- Email: admin@bcl.nusakonstruksi.com
- Sistem logging: Cek server logs untuk error details

---

**Last Updated**: January 2025
**Version**: 1.1.0 - Enhanced UI Integration
**Admin**: AdminBCL
**Status**: ✅ Production Ready with Full UI Integration
