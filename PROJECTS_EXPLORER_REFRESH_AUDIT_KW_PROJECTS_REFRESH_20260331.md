# Projects Explorer Refresh Audit

Date: 2026-03-31
Keyword: `KW_PROJECTS_REFRESH_20260331`

## Scope

- sync cache `Projects Explorer` untuk sumber `pc-bim02`
- perbaikan preview media agar memakai mirror lokal untuk `pc-bim02`
- penambahan tombol `Refresh` pada halaman `Projects`
- penambahan endpoint backend untuk sinkronisasi manual cache explorer

## Main Outcomes

### 1. Cache explorer sekarang ikut menyinkronkan mirror `pc-bim02`

- `sync-projects-explorer-cache.ps1` sekarang memanggil `scripts/sync-pcbim02-cache.js` sebelum rebuild cache explorer.
- Mirror lokal berikut ikut diperbarui:
  - `data/pc-bim02-cache/PROJECT BIM 2025`
  - `data/pc-bim02-cache/PROJECT BIM 2026`

### 2. Preview media `pc-bim02` tidak lagi bergantung langsung pada share jaringan

- `BC-Learning-Main/js/projects-explorer.js` menulis ulang URL preview `pc-bim02` ke mirror lokal jika sumber media berasal dari `/media-bim02` atau `/media-bim02-2026`.
- Fallback tetap tersedia ke `/api/media-proxy` untuk sumber lain.
- `sync-project-media-cache.ps1` juga mulai mengisi `displayUrl` yang mengarah ke mirror lokal untuk jalur `pc-bim02`.

### 3. Halaman `Projects` sekarang punya tombol refresh manual

- `BC-Learning-Main/pages/projects.html` menambahkan tombol `Refresh` dan area status sinkronisasi.
- `BC-Learning-Main/js/projects-explorer.js` menambahkan state loading, pesan status, dan reload data yang mempertahankan pilihan tahun/project aktif.
- Jika endpoint backend belum aktif, tombol tetap memuat ulang data dari cache statis terbaru agar user masih punya opsi refresh di browser.

### 4. Backend sudah disiapkan untuk sinkronisasi manual

- `backend/routes/projectCatalogRoutes.js` menambahkan `POST /api/projects/refresh-cache`.
- Endpoint tersebut menjalankan `sync-projects-explorer-cache.ps1` lewat `powershell.exe` dan mencegah sinkronisasi paralel ganda.
- `backend/server.js` sudah mengalirkan `backendDir` dan `spawn` ke route factory.

### 5. Resolver mount backend sekarang memprioritaskan mount lokal

- `backend/services/projectPathResolverService.js` memeriksa `localMountPoint` terlebih dahulu jika mount tersedia dan path lokal dapat diakses.
- Jika tidak valid, resolver tetap fallback ke `remotePath`.

## Verification Snapshot

- halaman publik `pages/projects.html` sudah memuat tombol `Refresh`
- asset `projects-explorer.js?v=20260331a` sudah live
- preview media `pc-bim02` berhasil diarahkan ke mirror lokal
- project baru tahun 2026 dari `pc-bim02` sudah muncul setelah refresh cache

## Operational Notes

1. Refresh cache explorer manual dari terminal:

```powershell
powershell -ExecutionPolicy Bypass -File C:\BCL\sync-projects-explorer-cache.ps1
```

2. Endpoint backend `POST /api/projects/refresh-cache` sudah ada di source, tetapi instance backend aktif di port `5052` masih memerlukan restart service/proses yang benar agar route baru termuat penuh.
