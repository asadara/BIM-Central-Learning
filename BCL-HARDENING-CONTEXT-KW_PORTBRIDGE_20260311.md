# BCL Hardening Context

Keyword unik untuk pencarian konteks ini:

`KW_PORTBRIDGE_20260311`

Jika sesi baru perlu melanjutkan pekerjaan ini, cari keyword di atas atau buka file ini.

## Ringkasan kondisi saat ini

- Backend resmi BCL sekarang diperlakukan sebagai `5052`.
- `nginx` live dan jalur runtime browser sudah diarahkan agar memakai `same-origin` atau `5052`.
- Port `5151` sudah dibersihkan dari jalur runtime aktif.
- Port `5051` tidak lagi menjadi backend utama. Saat ini `5051` dijadikan compatibility proxy ke `5052`.
- Proxy kompatibilitas `5051` menambahkan header `x-bcl-legacy-proxy: 5051->5052`.
- Akses ke `5051` sekarang direkam ke `C:\BCL\logs\legacy-5051-access.log`.

## Perbaikan utama yang sudah dilakukan

### Step 1-2

- Menyamakan startup, watchdog, dan backend utama ke port `5052`.
- Membersihkan mismatch `nginx -> 5052` versus backend lama `5051`.
- Memperbaiki fallback API frontend agar memprioritaskan `same-origin` dan `5052`.

### Step 3

- Membersihkan `5151` dari jalur runtime aktif.
- Menambahkan route kompatibilitas `POST /api/update-profile` di backend utama.
- Memperbaiki halaman profile/update lama agar bicara ke backend utama, bukan port mati.

### Step 4

- Menghapus fallback `5051` dari halaman runtime aktif:
  - `pages/elearning.html`
  - `elearning-assets/js/user.js`
  - `js/projects-explorer.js`
  - `js/bim-methode.js`
  - `elearning-assets/update.html`
  - `elearning-assets/phase4-dashboard.html`
- Menggeser script operator/test agar default ke `5052` atau env-configurable.

### Step 5

- Menemukan bahwa proses `5051` lama berasal dari startup warisan pagi hari.
- Menurunkan backend penuh di `5051`.
- Mengganti `5051` menjadi proxy kompatibilitas ke `5052` melalui:
  - `backend/legacy-port-proxy.js`
  - `start-legacy-5051-proxy.bat`
- Menghubungkan startup/watchdog agar proxy `5051` tetap dijaga:
  - `start-backend-public.bat`
  - `start-bcl-http.bat`
  - `watchdog-bcl.bat`
- Menambahkan laporan audit:
  - `scripts/report-legacy-5051-usage.ps1`

## Verifikasi terakhir

- `https://bcl.nke.net/ping` = `200`
- `https://bcl.nke.net/api/search/ping` = `200`
- File live runtime aktif tidak lagi memuat referensi `5051`.
- `5051 /ping` = `200` dengan header `x-bcl-legacy-proxy: 5051->5052`
- `5052 /ping` = `200`

## Residual risk yang masih ada

- Port `5051` masih listen karena masih dipakai sebagai compatibility proxy sementara.
- Untuk pensiun total `5051`, perlu observasi log `legacy-5051-access.log` selama beberapa waktu dan memastikan tidak ada klien nyata yang masih bergantung pada port itu.
- Worktree masih punya perubahan lain yang sengaja tidak diikutkan ke commit hardening ini:
  - `BC-Learning-Main/elearning-assets/components/header.html`
  - `BC-Learning-Main/elearning-assets/js/component-loader.js`
  - `BC-Learning-Main/elearning-assets/js/mobile-first-architecture.js`
  - `BC-Learning-Main/elearning-assets/js/script.js`
  - `BC-Learning-Main/elearning-assets/favorites.html`
  - `BC-Learning-Main/elearning-assets/js/practice-backup.js`

## Langkah lanjutan yang direkomendasikan

1. Observasi `C:\BCL\logs\legacy-5051-access.log`.
2. Jika tidak ada klien nyata selain localhost/testing, pensiunkan listener `5051` sepenuhnya.
3. Setelah itu hapus shim kompatibilitas dan sederhanakan startup menjadi single-port clean.
