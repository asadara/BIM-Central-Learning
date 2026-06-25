# PC-BIM02 Direct UNC Monitoring - 2026-05-19

## Tujuan

Mencatat hasil perubahan dan pengujian sebelum folder cloning/mirror besar di PC-BIM1 dihapus. File ini dipakai sebagai referensi review selama monitoring 1 hari.

## Halaman Yang Dicek

- `https://bcl.nke.net/pages/projects.html`
- `https://bcl.nke.net/pages/bim-methode.html`
- `https://bcl.nke.net/pages/audit-2026.html`

## Skema Yang Dipakai Setelah Perubahan

- Backend BCL dijalankan setelah user `PC-BIM1\user` login.
- Sumber data PC-BIM02 diprioritaskan lewat direct UNC:
  - `\\pc-bim02\PROJECT BIM 2025`
  - `\\pc-bim02\PROJECT BIM 2026`
  - `\\pc-bim02\Dokumen Audit 2026`
- Folder mirror lokal tetap ada sebagai fallback sementara, tetapi proses sync mirror PC-BIM02 sudah dinonaktifkan secara default agar tidak cloning ulang file besar.
- Cache runtime tetap boleh dibuat ulang otomatis oleh aplikasi.

## Folder Mirror Besar Yang Belum Dihapus

Jangan hapus folder berikut sebelum monitoring 1 hari selesai dan ada approval eksplisit:

- `C:\BCL\data\pc-bim02-cache\PROJECT BIM 2025` sekitar 37.91 GB
- `C:\BCL\data\pc-bim02-cache\PROJECT BIM 2026` sekitar 1.06 GB
- `C:\BCL\PC-BIM02\20. METHODE ESTIMATE & TENDER` sekitar 6.96 GB

## Cache Runtime Yang Aman Dibersihkan

Folder berikut hanya cache runtime dan bisa dibuat ulang aplikasi:

- `C:\BCL\backend\public\cache\project-media-proxy`
- `C:\BCL\backend\public\cache\bim-methode-files`
- `C:\BCL\backend\public\cache\bim-methode-thumbnails`
- `C:\BCL\backend\public\cache\bim-methode-thumbnails-stable`

Catatan: `C:\BCL\data\projects-explorer-cache` tidak dihapus karena kecil dan berisi metadata/cache statis yang membantu performa.

## Hasil Pengujian Sebelum Cache Dibersihkan

- `projects.html`: HTTP 200.
- `bim-methode.html`: HTTP 200.
- `audit-2026.html`: HTTP 200.
- `api/years`: berhasil membaca sumber `pc-bim02-2025` dan `pc-bim02-2026`.
- `api/projects/2025?sourceId=pc-bim02-2025`: `totalProjects=24`, path project berasal dari `\\pc-bim02\PROJECT BIM 2025`.
- `api/projects/2026?sourceId=pc-bim02-2026`: `totalProjects=6`, path project berasal dari `\\pc-bim02\PROJECT BIM 2026`.
- `api/project-media/2025/07. FT GEDUNG UNP?sourceId=pc-bim02-2025`: `totalMedia=24`, `displayUrl` memakai `/api/media-proxy`, bukan `/data/pc-bim02-cache`.
- Sample `api/media-proxy`: HTTP 200, `X-Media-Source=origin`.
- `api/bim-methode/categories?refresh=1`: `success=true`, root `\\pc-bim02\PROJECT BIM 2025\20. METHODE ESTIMATE & TENDER`, `totalCategories=36`.
- `api/bim-methode/media?type=image&refresh=1`: `success=true`, `totalCount=156`, id media mengarah ke UNC PC-BIM02.
- `api/audit-2026/status`: root `\\pc-bim02\Dokumen Audit 2026`, `rootExists=true`.
- `api/audit-2026/browse`: HTTP 200, `totalEntries=8`.

## Hasil Pengujian Setelah Cache Runtime Dibersihkan

Waktu uji: 2026-05-19, setelah folder cache runtime dihapus dan dibuat ulang.

- `projects.html`: HTTP 200.
- `bim-methode.html`: HTTP 200.
- `audit-2026.html`: HTTP 200.
- `api/projects/2025?sourceId=pc-bim02-2025`: `totalProjects=24`, path project berasal dari `\\pc-bim02\PROJECT BIM 2025`.
- `api/projects/2026?sourceId=pc-bim02-2026`: `totalProjects=7`, path project berasal dari `\\pc-bim02\PROJECT BIM 2026`.
- `api/project-media/2025/07. FT GEDUNG UNP?sourceId=pc-bim02-2025`: `totalMedia=24`, `mediaDetails.displayUrl` memakai `/api/media-proxy`, bukan `/data/pc-bim02-cache`.
- Sample `api/media-proxy`: HTTP 200, `Content-Type=image/png`, `X-Media-Source=origin`.
- `api/bim-methode/categories?refresh=1`: `success=true`, root `\\pc-bim02\PROJECT BIM 2025\20. METHODE ESTIMATE & TENDER`, `refreshError` kosong.
- `api/bim-methode/media?type=image&refresh=1`: `success=true`, `totalCount=156`.
- `api/audit-2026/status`: root `\\pc-bim02\Dokumen Audit 2026`, `rootExists=true`.
- `api/audit-2026/browse`: HTTP 200, `totalEntries=8`.

## Status Cache Setelah Uji

- `project-media-proxy`: terisi ulang 1 file kecil karena sample media proxy diuji; ini normal.
- `bim-methode-files`: kosong.
- `bim-methode-thumbnails`: kosong.
- `bim-methode-thumbnails-stable`: kosong.

## Hasil Test Tambah-Kurang Data PC-BIM02

Waktu uji: 2026-05-19.

Marker sementara yang dibuat:

- Project test: `\\pc-bim02\PROJECT BIM 2026\ZZZ_BCL_SYNC_TEST_20260519_101454`
- BIM Methode category test: `\\pc-bim02\PROJECT BIM 2025\20. METHODE ESTIMATE & TENDER\99. BCL_SYNC_TEST_20260519_101454`
- Audit test: `\\pc-bim02\Dokumen Audit 2026\ZZZ_BCL_SYNC_TEST_20260519_101454`

Saat marker ditambahkan:

- Project API `api/projects/2026?sourceId=pc-bim02-2026`: marker terbaca, total project menjadi `8`.
- BIM Methode `api/bim-methode/categories?refresh=1`: marker terbaca sebagai kategori baru, total kategori menjadi `37`, `mediaCount=1`.
- Audit `api/audit-2026/browse`: marker terbaca di root, total entry menjadi `9`.
- Audit search dengan token marker: `totalResults=1`.
- Static cache Project Explorer setelah `sync-projects-explorer-cache.ps1`: marker terbaca di cache, `present=true`.

Saat marker dihapus:

- Project API `api/projects/2026?sourceId=pc-bim02-2026`: marker hilang, total project kembali `7`.
- BIM Methode `api/bim-methode/categories?refresh=1`: marker hilang, total kategori kembali `36`.
- Audit `api/audit-2026/browse`: marker hilang, total entry kembali `8`.
- Audit search dengan token marker: `totalResults=0`.
- Static cache Project Explorer setelah sync ulang: marker hilang, `present=false`.

Temuan tambahan:

- Setelah project test dihapus, sempat ditemukan 7 file JSON media cache yatim di `C:\BCL\data\projects-explorer-cache\media`.
- `sync-project-media-cache.ps1` sudah diperbaiki agar menghapus media cache JSON yang tidak lagi ada di daftar project aktif.
- Setelah script diperbaiki dan dijalankan ulang: `removed stale=7`, tidak ada lagi referensi `BCL_SYNC_TEST_20260519_101454` di `data` atau `backend\public\cache`.
- Semua marker test di PC-BIM02 sudah terhapus.
- Cache runtime sudah dibersihkan ulang setelah test dan kembali kosong.

## Kriteria Monitoring 1 Hari

Selama 2026-05-19 sampai 2026-05-20, pantau:

- Ketiga halaman tetap terbuka normal.
- Project explorer tetap menampilkan project 2025 dan 2026 dari PC-BIM02.
- Preview/media project tetap muncul lewat `/api/media-proxy`.
- BIM Methode tetap menampilkan kategori dan media.
- Audit 2026 tidak lagi menampilkan HTTP 500/404 untuk status, search, browse, atau index.
- Tidak ada proses sync yang menulis ulang mirror besar di `C:\BCL\data\pc-bim02-cache` atau `C:\BCL\PC-BIM02`.

## Audit Cepat Source Eksternal Selain 3 Halaman Utama

Waktu uji: 2026-05-19, sebelum rencana restart PC server.

Kesimpulan:

- Tidak ditemukan halaman publik aktif lain yang membaca langsung source eksternal selain tiga halaman utama (`projects`, `bim-methode`, `audit-2026`).
- `G:\BIM CENTRAL LEARNING` terdeteksi sebagai drive lokal PC-BIM1 (`DriveType=3`), jadi halaman berbasis `G:` bukan source luar PC-BIM1.
- Halaman/API berbasis `G:` yang dicek dan normal:
  - `manual-books.html`: HTTP 200.
  - `tutorial.html`: HTTP 200.
  - `search.html`: HTTP 200.
  - `library.html`: HTTP 200.
  - `api/manual-books`: HTTP 200.
  - `api/tutorials`: HTTP 200.
  - `api/search`: HTTP 200.
- Modul tambahan yang memakai PC-BIM02 selain tiga halaman utama adalah BIM Media tagging/showroom:
  - Public API: `api/bim-media/tags`, `api/bim-media/file`.
  - Admin UI/API: `pages/sub/adminbcl.html#bim-media`, `api/admin/bim-media/*`.
- `api/bim-media/tags`: HTTP 200, `totalTagged=9`.
- Sample `api/bim-media/file` untuk file PC-BIM02: HTTP 200, `Content-Type=image/png`, panjang `17376`.

Perbaikan kecil yang dilakukan:

- URL preview PC-BIM02 di `showroom-player.js`, `content-management.js`, dan `adminbcl.js` diarahkan ke `/api/bim-media/file?path=...`.
- Referensi lama `/data/bim-media-public` sudah tidak tersisa di file runtime aktif.
- Ini mengikuti skema utama: frontend tidak membaca share/mirror langsung, frontend meminta backend, backend membaca direct UNC PC-BIM02 saat user PC-BIM1 sudah login.

Catatan:

- `bimassets.html` saat ini masih halaman statis/sampel dan belum memuat `showroom-player.js`, jadi bukan risk utama saat restart.
- Admin BIM Media tetap bergantung pada akses `\\pc-bim02\PROJECT BIM 2025` ketika admin melakukan scan/tagging.
- Skema direct UNC setelah user PC-BIM1 login bisa dijadikan skema utama untuk semua source luar PC-BIM1. Mirror lokal hanya fallback sementara sampai monitoring selesai.

## Insiden Setelah Restart PC Server

Waktu: 2026-05-19 sekitar 11:58-12:18.

Gejala:

- Setelah restart PC-BIM1, halaman Audit 2026 kembali HTTP 500/404.
- `api/audit-2026/status` mengembalikan `rootExists=false`.
- Dari sesi user login, `\\pc-bim02\Dokumen Audit 2026` bisa diakses normal.

Penyebab:

- `BCL Watchdog (5m)` berjalan sebagai `SYSTEM` dan mengambil port backend `5052` lebih dulu.
- Backend yang berjalan di Session 0/SYSTEM tidak bisa membaca UNC PC-BIM02, sehingga Audit 2026 gagal.
- Logon task user tidak bisa mengambil alih karena port `5052` sudah dipakai proses SYSTEM.

Tindakan:

- `watchdog-bcl.bat` diperbaiki agar saat berjalan sebagai SYSTEM tidak melakukan recovery/start backend.
- Deteksi SYSTEM diperkuat memakai `whoami`.
- Forced recycle dijalankan lewat flag `force-backend-reload.flag`.
- Watchdog SYSTEM berhasil mematikan backend Session 0 dan tidak menyalakannya ulang.
- Backend kemudian distart dari sesi login user `PC-BIM1\user`.

Hasil:

- Backend aktif pada port `5052` sebagai `PC-BIM1\user`, Session `1`.
- `api/audit-2026/status`: HTTP 200, `rootExists=true`.
- `api/audit-2026/browse`: HTTP 200.
- `projects.html`: HTTP 200.
- `bim-methode.html`: HTTP 200.
- `audit-2026.html`: HTTP 200.
- Setelah run watchdog berikutnya pukul 12:18, backend tetap berjalan sebagai `PC-BIM1\user` dan Audit tetap `rootExists=true`.

Catatan:

- Task `BCL Watchdog (5m)` masih terdaftar sebagai SYSTEM, tetapi script-nya sekarang tidak lagi men-start backend saat berjalan sebagai SYSTEM.
- Untuk skema final yang lebih bersih, task SYSTEM ini sebaiknya nanti diganti atau dinonaktifkan lewat Task Scheduler admin, dan recovery backend dipindahkan ke task user/logon.

## Keputusan Setelah Monitoring

Jika tidak ada bug selama 1 hari:

- Folder mirror besar bisa dihapus bertahap setelah approval user.
- Disarankan hapus satu kelompok dulu, lalu uji ulang endpoint terkait sebelum menghapus kelompok berikutnya.

Jika ada bug:

- Folder mirror masih tersedia sebagai fallback sementara.
- Periksa apakah backend sedang berjalan sebagai `PC-BIM1\user`, bukan `SYSTEM`.
- Periksa akses UNC dari PC-BIM1 ke PC-BIM02.
