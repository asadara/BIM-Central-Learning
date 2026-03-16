# App Cleanup Audit

Date: 2026-03-13
Keyword: `KW_APP_CLEANUP_20260313`
Scope:

- `C:\BCL\backend`
- `C:\BCL\BC-Learning-Main`

## Execution Status

- Batch A executed on 2026-03-13
- Batch B executed on 2026-03-13
- Runtime verification after execution:
  - `https://bcl.nke.net/api/server/status` = `running`
  - `node .\backend\scripts\db-ping.js` = `ok`
- Quarantine folder created:
  - `C:\BCL\_retired\2026-03-app-cleanup\`

## Goal

Memilah kandidat cleanup level aplikasi tanpa menyentuh runtime aktif, middleware aktif, atau data produksi.

## Runtime Notes

- Backend aktif: `backend\server.js`
- Port compatibility proxy masih aktif: `backend\legacy-port-proxy.js`
- Frontend aktif: `BC-Learning-Main\index.html`, `pages\*`, `elearning-assets\*`
- Tidak ada folder `middleware` terpisah yang berdiri sendiri.

Middleware aktif saat ini tersebar di:

- `backend\server.js`
- `backend\modules\activeUserTracking.js`
- helper middleware di beberapa route file seperti:
  - `backend\routes\competencyRoutes.js`
  - `backend\routes\learningMaterialsAdmin.js`

Kesimpulan:

- jangan cleanup area middleware aktif dulu

## Backend Findings

### Keep

- `backend\server.js`
- `backend\legacy-port-proxy.js`
- `backend\modules\activeUserTracking.js`
- seluruh route/service yang benar-benar dimount oleh `server.js`
- `backend\routes\testUtilityRoutes.js`

Catatan:
- `testUtilityRoutes.js` namanya terdengar test-only, tetapi saat ini masih dimount langsung di `server.js`, jadi tidak boleh dibersihkan sembarangan.

### Quarantine First

- `backend\server.backup_20260312_113101.js`
Reason: backup file besar, jelas bukan entry point aktif.

- `backend\start-backend-autorestart.bat`
- `backend\start-http.bat`
- `backend\start-http.ps1`
Reason: wrapper startup lokal/operator, perlu audit operator workflow sebelum dipensiunkan.

- `backend\users.json.backup.*`
Reason: backup data user berbasis file. Bukan runtime aktif utama, tetapi menyentuh data historis sehingga lebih aman dipindah ke karantina atau backup terstruktur, bukan delete langsung.

### Safe Delete

- `backend\debug_startup.log`
- `backend\server.err.log`
- `backend\server.out.log`
- `backend\temp_backend_check.txt`
- `backend\test-api.js`
- `backend\load-test.js`

Reason:

- log/temp/test utility lokal
- tidak terlihat dirujuk runtime aktif

### Defer

- `backend\public\cache\*`
Reason: cache besar yang bisa diregenerasi, tetapi sedang dipakai untuk `bim-methode` dan project/media proxy. Perlu audit cache policy terpisah.

- `backend\plugin-packages\`
Reason: perlu cek apakah ada plugin nyata yang sedang dipakai.

- `backend\converted\`
- `backend\uploads\`
- `backend\data\`
- `backend\public\`
Reason: berpotensi menyimpan artefak operasional atau data yang masih dibutuhkan.

## Frontend Findings

### Keep

- `BC-Learning-Main\index.html`
- `BC-Learning-Main\pages\*`
- `BC-Learning-Main\js\*` yang jelas dipakai halaman aktif
- `BC-Learning-Main\components\*`
- `BC-Learning-Main\elearning-assets\components\*`
- `BC-Learning-Main\elearning-assets\js\component-loader.js`
- `BC-Learning-Main\elearning-assets\js\auth-guard.js`

### Quarantine First

- `BC-Learning-Main\index.html.backup.2026-12-01`
Reason: backup tunggal, jelas bukan halaman aktif.

- `BC-Learning-Main\js\xx.js`
Reason: hanya dirujuk dokumentasi enhancement projects, bukan runtime aktif yang terlihat.

- `BC-Learning-Main\elearning-assets\js\component-loader_20251219_144932_backup.js`
- `BC-Learning-Main\elearning-assets\js\sidebar-loader_20251219_144932_backup.js`
- `BC-Learning-Main\elearning-assets\js\courses.js.bak`
- `BC-Learning-Main\elearning-assets\js\practice-backup.js`
Reason: backup/alternate file yang tidak seharusnya tinggal di jalur aplikasi aktif.

- seluruh file `.bak`, `.bak2`, `.bak3`, `.bak4`, `.backup` di:
  - `BC-Learning-Main\elearning-assets\`

Reason:

- jumlahnya banyak dan jelas historis
- aman dikarantina terlebih dahulu

### Safe Delete

- `BC-Learning-Main\js\show`
Reason: file 2-byte tanpa peran jelas, terlihat seperti artefak salah tulis.

- `BC-Learning-Main\test-api.html`
Reason: halaman uji root frontend, tidak terlihat dirujuk runtime aktif.

### Defer

- `BC-Learning-Main\phase3-dashboard.html`
- `BC-Learning-Main\phase3-testing.html`
Reason: masih punya referensi silang dari file lama root seperti `courses.html` dan `course-detail.html`. Perlu audit apakah root pages lama itu masih punya nilai.

- `BC-Learning-Main\elearning-assets\sample-elearning-page.html`
Reason: masih dirujuk langsung dari `elearning-assets\home.html`.

- `BC-Learning-Main\elearning-assets\test\`
Reason: folder ini berisi dokumen soal/post-test. Secara teknis terlihat seperti bahan uji/training, bukan sekadar sampah. Jangan hapus sampai diputuskan nilai bisnisnya.

- `BC-Learning-Main\img\waste old\`
Reason: nama folder menunjukkan kandidat cleanup, tetapi perlu scan apakah ada referensi asset lama yang masih tersisa.

- `BC-Learning-Main\css\style_CLEAN.css`
Reason: kemungkinan CSS eksperimen lama, tetapi perlu cek apakah ada halaman yang masih memuatnya sebelum dikarantina.

## Recommended Next Batch

### Batch A: Safe Delete

Backend:

- `backend\debug_startup.log`
- `backend\server.err.log`
- `backend\server.out.log`
- `backend\temp_backend_check.txt`
- `backend\test-api.js`
- `backend\load-test.js`

Frontend:

- `BC-Learning-Main\js\show`
- `BC-Learning-Main\test-api.html`

Status:

- executed

### Batch B: Quarantine First

Backend:

- `backend\server.backup_20260312_113101.js`
- `backend\start-backend-autorestart.bat`
- `backend\start-http.bat`
- `backend\start-http.ps1`
- `backend\users.json.backup.*`

Frontend:

- `BC-Learning-Main\index.html.backup.2026-12-01`
- `BC-Learning-Main\js\xx.js`
- `BC-Learning-Main\elearning-assets\js\component-loader_20251219_144932_backup.js`
- `BC-Learning-Main\elearning-assets\js\sidebar-loader_20251219_144932_backup.js`
- `BC-Learning-Main\elearning-assets\js\courses.js.bak`
- `BC-Learning-Main\elearning-assets\js\practice-backup.js`
- semua file `.bak*` dan `.backup` di `BC-Learning-Main\elearning-assets\`

Status:

- executed
- moved to:
  - `C:\BCL\_retired\2026-03-app-cleanup\backend\`
  - `C:\BCL\_retired\2026-03-app-cleanup\frontend\`
  - `C:\BCL\_retired\2026-03-app-cleanup\elearning-assets-backups\`

## Not Recommended Yet

- membersihkan route/service aktif hanya karena namanya mengandung `test`, `legacy`, atau `public`
- menghapus cache `backend\public\cache` sebelum ada policy regen/size target
- menghapus `phase3-*` sebelum memutuskan nasib root learning pages lama
- menyentuh middleware aktif di `server.js` dan `backend\modules\activeUserTracking.js`
