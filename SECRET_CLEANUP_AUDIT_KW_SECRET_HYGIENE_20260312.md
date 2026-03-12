# Secret Cleanup Audit

Keyword unik: `KW_SECRET_HYGIENE_20260312`
Tanggal audit: `2026-03-12`
Repo: `BIM-Central-Learning`
Status: `Batches 1-4 largely implemented on 2026-03-12`, sisa cleanup minor

## Ringkasan

Audit ini memeriksa secret, default credential, dan fallback auth/database yang masih tracked di repo git.

Temuan utama:
- Tidak ada file `.env`, `.key`, `.crt`, `.pem`, atau token live baru yang ikut pada commit hari ini.
- Runtime backend aktif sudah dipindahkan ke helper env terpusat dan tidak lagi memakai fallback literal untuk JWT, session, legacy admin token, dan DB password.
- Script bootstrap, utilitas migrasi, frontend test pages, dan dokumentasi utama sudah dibersihkan dari fallback literal yang sebelumnya aktif.
- Karena repo sudah dipush ke GitHub, semua credential fallback yang pernah dipakai harus dianggap `terekspos`.

## Dampak

Risiko tertinggi saat ini:
- credential lama yang pernah dipush tetap harus dianggap bocor secara historis
- file bundle/artefak lama di luar source utama masih perlu sweep berkala

## Batch 1 Sudah Diterapkan

Perubahan yang sudah dilakukan:
- `backend/config/runtimeConfig.js` ditambahkan sebagai helper env terpusat
- runtime aktif sekarang `fail-fast` untuk `JWT_SECRET`, `SESSION_SECRET`, dan `DB_PASSWORD`
- `backend/server.js`, `backend/utils/auth.js`, dan route/controller aktif yang memakai PostgreSQL sudah dipindahkan ke helper ini
- legacy admin token/bearer hanya aktif jika env terkait benar-benar diisi
- default admin bootstrap tidak lagi memakai password literal tracked
- `.env.example` ditambahkan sebagai template aman
- startup backend sudah diverifikasi ulang dan kembali normal setelah loader `.env` diarahkan ke root repo

Catatan transisi lokal:
- `.env` lokal yang di-ignore sudah dilengkapi `JWT_SECRET` dan `SESSION_SECRET` agar runtime tetap hidup
- nilai tersebut tidak masuk git, tetapi tetap sebaiknya dirotasi sesuai prosedur deploy

## File Yang Aman Karena Sudah Di-ignore

Sudah di-ignore oleh repo:
- `.env`
- `.env.*`
- `*.pem`
- `*.key`
- `*.crt`
- `backend/public/thumbnails/`
- `.playwright-cli/`
- berbagai log, upload, cache, dan runtime artifacts

Catatan:
- ignore ini baik, tapi tidak melindungi secret yang sudah hardcoded di file tracked.

## Temuan Prioritas Tinggi

### 1. Runtime auth fallback di backend

File:
- `backend/server.js:493`
- `backend/server.js:503`
- `backend/server.js:809`
- `backend/utils/auth.js:3`
- `backend/utils/auth.js:4`
- `backend/utils/auth.js:33`
- `backend/elearning/routes/progressRoutes.js:7`
- `backend/routes/organizations.js:10`

Nilai yang terekspos:
- JWT fallback lama
- session secret fallback lama
- admin token/password fallback lama

Risiko:
- siapapun yang tahu nilai fallback bisa membuat token valid, mempertahankan session, atau lolos legacy admin header jika environment production tidak dipasang benar.

Tindakan cleanup:
- hapus semua fallback literal untuk `JWT_SECRET`, `SESSION_SECRET`, dan `ADMIN_TOKEN`
- ubah ke `fail-fast`: server tidak boleh start jika env wajib tidak tersedia
- hapus jalur `legacy admin token` jika tidak lagi dibutuhkan

### 2. Runtime database password fallback

File:
- `backend/server.js:1106`
- `backend/routes/tutorialRoutes.js:18`
- `backend/routes/competencyRoutes.js:21`
- `backend/routes/news.js:17`
- `backend/routes/organizations.js:18`
- `backend/routes/pdfDisplayRoutes.js:18`
- `backend/routes/plugins.js:16`
- `backend/routes/users.js:14`
- `backend/routes/videos.js:15`
- `backend/elearning/routes/progressRoutes.js:14`
- `backend/elearning/controllers/quizController.js:13`
- `backend/elearning/controllers/certificateController.js:8`
- `backend/create-video-tables.js:9`
- `backend/scripts/db-ping.js:8`
- `backend/migrate-content-to-postgres.js:16`
- `backend/migrate-video-tags-to-postgres.js:11`
- `migrate-remaining-data.js:20`

Nilai yang terekspos:
- password database default lama

Risiko:
- bila environment belum dipasang benar, aplikasi akan mencoba memakai password default yang sekarang sudah publik di repo.

Tindakan cleanup:
- hilangkan fallback password database literal
- buat helper konfigurasi database tunggal
- semua process yang butuh DB harus membaca env yang sama dan gagal start jika kosong

### 3. Script bootstrap menulis atau memakai password default

File:
- `start-bcl-http.bat:680`
- `install-native-postgres-service.bat:4`
- `restore-native-postgres.ps1:7`
- `restore-native-postgres.ps1:10`
- `docker-compose.postgres.yml:8`
- `docker-compose.postgres.yml:30`
- `setup-postgres.bat:69`
- `setup-postgres.bat:75`

Nilai yang terekspos:
- password PostgreSQL default lama
- password pgAdmin default lama

Risiko:
- operator bisa tanpa sadar menjalankan bootstrap dengan password default lama
- default password pgAdmin lama sangat lemah

Tindakan cleanup:
- semua bootstrap harus minta input atau membaca `.env`
- ganti docs dan compose example ke placeholder, bukan nilai nyata
- jangan pernah menulis `.env` berisi password default dari script startup

## Temuan Prioritas Menengah

### 4. Frontend / test pages mengandung password dan token lama

File:
- `simple-login-test.html:70`
- `simple-login-test.html:79`
- `test-login.html:63`
- `test-login.html:198`
- `BC-Learning-Main/elearning-assets/js/component-loader.js:585`
- `BC-Learning-Main/elearning-assets/js/component-loader.js:704`
- `BC-Learning-Main/elearning-assets/home.html:744`

Nilai yang terekspos:
- admin token/password lama
- bearer secret legacy lama

Risiko:
- halaman test HTML bisa dipakai untuk menemukan credential lama
- frontend code memeriksa `admin_token` literal sehingga pola auth lama tetap hidup

Tindakan cleanup:
- hapus atau untrack halaman test yang mengandung credential
- ganti seluruh pemeriksaan literal admin token ke session/JWT server-side
- cari dan hapus bearer secret legacy literal

Status implementasi:
- selesai dibersihkan pada `2026-03-12`

### 5. Script utilitas LAN mount masih memakai fallback token

File:
- `add-lan-mount-for-projects.js:10`
- `connect-bim02-mount.js:6`

Nilai yang terekspos:
- admin token lama

Risiko:
- script utilitas bisa tetap berfungsi dengan token legacy yang sudah publik

Tindakan cleanup:
- wajibkan `ADMIN_TOKEN` dari env atau parameter runtime
- berhenti hardcode token default dalam utilitas

Status implementasi:
- selesai dibersihkan pada `2026-03-12`

## Temuan Prioritas Rendah

### 6. Dokumentasi publik masih menyalin nilai credential lama

File:
- `ADMINBCL_README.md:10`
- `ADMINBCL_README.md:63`
- `ADMIN-QUICK-START.md:73`
- `BCL-SECURITY-GUIDE.md:146`
- `LAN-MOUNT-QUICKSTART.md:30`
- `LAN-MOUNT-DOCUMENTATION.md:171`
- `LAN-MOUNT-DOCUMENTATION.md:191`
- `LAN-MOUNT-DOCUMENTATION.md:258`
- `LAN-MOUNT-DOCUMENTATION.md:289`
- `LAN-MOUNT-DOCUMENTATION.md:323`
- `LAN-MOUNT-DOCUMENTATION.md:504`
- `LAN-MOUNT-DOCUMENTATION.md:508`
- `LAN-MOUNT-DOCUMENTATION.md:515`
- `manual-setup-lan-mount.md:12`
- `manual-setup-lan-mount.md:35`
- `HOW-TO-RUN-ALL-SYSTEMS.md:177`
- `POSTGRESQL-MIGRATION-README.md:79`

Risiko:
- walau bukan runtime, dokumentasi ini menyebarkan nilai yang sama ke operator baru

Tindakan cleanup:
- ganti semua credential literal menjadi placeholder:
  - `CHANGE_ME_ADMIN_TOKEN`
  - `CHANGE_ME_DB_PASSWORD`
  - `CHANGE_ME_SESSION_SECRET`
- tambahkan catatan bahwa semua nilai contoh tidak boleh dipakai di production

Status implementasi:
- sebagian besar dokumentasi utama sudah disanitasi pada `2026-03-12`
- audit ini tetap menyimpan kategori temuan tanpa menuliskan nilai lama secara verbatim

## Klasifikasi Cleanup Yang Direkomendasikan

### Batch 1: runtime auth dan DB

Target:
- `backend/server.js`
- `backend/utils/auth.js`
- `backend/elearning/routes/progressRoutes.js`
- `backend/routes/organizations.js`
- seluruh route/controller yang masih pakai fallback `DB_PASSWORD`

Output yang diinginkan:
- tidak ada fallback secret aktif
- app gagal start bila env wajib tidak ada
- helper config terpusat

### Batch 2: bootstrap dan operator scripts

Target:
- `start-bcl-http.bat`
- `install-native-postgres-service.bat`
- `restore-native-postgres.ps1`
- `setup-postgres.bat`
- `docker-compose.postgres.yml`

Output yang diinginkan:
- tidak ada script yang menulis password default
- semua script membaca env / prompt input

### Batch 3: frontend test pages dan legacy admin token

Target:
- `simple-login-test.html`
- `test-login.html`
- `BC-Learning-Main/elearning-assets/js/component-loader.js`
- `BC-Learning-Main/elearning-assets/home.html`
- utilitas LAN mount

Output yang diinginkan:
- tidak ada credential literal di frontend tracked files
- auth admin hanya lewat jalur backend resmi

### Batch 4: docs sanitization

Target:
- seluruh `.md` yang masih menulis nilai credential lama

Output yang diinginkan:
- docs aman dibagikan
- tidak ada contoh token/password nyata

## Rekomendasi Operasional

Lakukan rotasi segera untuk semua kategori nilai berikut bila pernah dipakai:
- admin token/password lama
- password database default lama
- password pgAdmin default lama
- JWT fallback lama
- session secret fallback lama
- bearer secret legacy lama

Urutan aman:
1. set env baru di server
2. deploy kode yang tidak lagi menerima fallback lama
3. restart service
4. uji login, DB, dan admin flow
5. baru sanitasi docs/test pages

## Kesimpulan

Repo saat ini tidak bocor lewat file ignored, tetapi masih menyimpan terlalu banyak secret fallback dan credential contoh di file tracked.

Cleanup berikutnya yang masih masuk akal hanyalah sweep artefak lama non-source dan file bundle turunan yang belum dipakai runtime utama.
