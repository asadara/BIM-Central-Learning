# BCL Internship Program — Phase 1B Implementation Report

**Tanggal:** 24 September 2026
**Scope:** Participant UI & Native BCL Integration
**Status:** Implemented; menunggu review/acceptance
**Stop point:** Phase 1B saja. Assignment, evidence, dan mentor review tidak diimplementasikan.

## 1. Ringkasan implementasi

Phase 1B menambahkan halaman peserta `Training → Magang / Internship` sebagai lapisan navigasi learning journey di atas konten dan evidence BCL yang sudah ada. Halaman menggunakan shell Elearning BCL, auth context yang sama, empat endpoint read-only Phase 1A, canonical BCL href, serta progress yang berasal langsung dari server.

UI menjawab empat kebutuhan utama dalam satu alur sederhana:

1. identitas program, peserta, mentor, periode, status, dan progress;
2. fokus saat ini dari item wajib pertama yang belum selesai;
3. learning path berurutan dengan status peserta yang ringkas;
4. materi berikutnya yang membuka surface BCL existing.

Tidak ada completion writer, curriculum editor, konten learning baru, mentor action, assignment, upload, scoring, gamification, atau integrasi Projects yang ditambahkan.

## 2. Deskripsi UI dan artefak visual

Visual memakai workspace BCL existing: latar abu muda, panel program navy, aksen teal untuk fokus/action, typography dan spacing Elearning, serta roadmap vertikal sederhana. Desktop memakai area learning path utama dengan ringkasan kecil di sisi kanan. Pada viewport sempit seluruh bagian ditumpuk satu kolom tanpa horizontal overflow.

Artefak validasi browser:

- `output/playwright/internship-phase1b/internship-desktop.png`
- `output/playwright/internship-phase1b/internship-mobile.png`

Font Awesome pada artefak lokal dapat tampil sebagai glyph fallback karena CDN font tidak selesai dimuat di runner; layout, teks, data, link, dan behavior tidak terpengaruh. Halaman mengikuti dependency CDN yang telah digunakan halaman BCL existing.

## 3. File ditambahkan

- `BC-Learning-Main/elearning-assets/internship.html`
- `BC-Learning-Main/elearning-assets/js/internship.js`
- `BC-Learning-Main/elearning-assets/css/internship.css`
- `backend/tests/internship-phase1b-ui.test.js`
- `scripts/serve-internship-ui-fixture.js`
- `docs/BCL_INTERNSHIP_PHASE_1B_IMPLEMENTATION_REPORT_20260924.md`

Fixture preview hanya untuk validasi UI lokal dan tidak dipasang pada runtime backend produksi.

## 4. File dimodifikasi

- `BC-Learning-Main/components/navbar.html`
- `BC-Learning-Main/elearning-assets/components/navbar.html`
- `backend/repositories/internshipRepository.js`
- `backend/services/internshipProgramService.js`
- `backend/tests/internship-phase1a.test.js`
- `package.json`

Perubahan backend Phase 1B bersifat additive: participant display name yang aman ditambahkan pada allowlisted program header dari canonical authenticated user. Tidak ada perubahan completion authority atau write path.

## 5. Perubahan navigasi

Kedua fragment navbar sekarang memiliki label identik `Magang / Internship` di bawah menu Training. Entry tersembunyi secara default dan hanya ditampilkan setelah authenticated `GET /api/training/internships/me` berhasil.

Implikasinya:

- feature off/unmounted, response unauthorized, atau network failure: entry tetap tersembunyi;
- feature on dan request sah, termasuk peserta tanpa enrollment: entry tampil sehingga empty state tetap dapat dilihat;
- link selalu menuju `/elearning-assets/internship.html`.

Sidebar baru tidak ditambahkan untuk menghindari duplikasi navigasi; hubungan dengan Elearning tetap terlihat melalui shell, sidebar existing, dan link ke My Training.

## 6. Endpoint yang dikonsumsi

Urutan request halaman:

1. `GET /api/training/internships/me`
2. `GET /api/training/internships/:batchId`
3. `GET /api/training/internships/:batchId/learning-path`
4. `GET /api/training/internships/:batchId/progress`

Tiga request program dijalankan paralel setelah batch dipilih. `batchId` hanya boleh berasal dari daftar `/me`; query string yang dimodifikasi tidak dipakai untuk mengambil batch di luar daftar sah.

## 7. Behavior state peserta

- **Loading:** pesan persiapan program, path, dan progress.
- **No enrollment:** pesan informatif, bukan error, tanpa membocorkan batch lain.
- **Feature disabled:** pesan fitur belum tersedia saat direct URL dibuka.
- **Unauthenticated:** arahan login menggunakan login BCL existing.
- **Unauthorized:** pesan akses aman tanpa detail program.
- **Unavailable program:** pesan program tidak dapat dimuat.
- **Unavailable content:** item non-link berlabel `Belum tersedia`.
- **Backend/network error:** pesan generik tanpa raw backend error.
- **Multiple programs:** selector ringkas; satu program otomatis menjadi default.

## 8. Learning-path rendering

Frontend mengurutkan module dan item menurut `sequenceNumber`, memakai title/outcome yang telah di-allowlist oleh server, lalu memetakan canonical content href ke halaman BCL existing. Hanya prefix BCL yang diizinkan: `/pages/`, `/elearning-assets/`, dan `/public/reader.html`. Scheme asing, traversal, native drive path, dan UNC path ditolak dan menjadi unavailable.

Status peserta yang ditampilkan hanya:

- `Belum Mulai`
- `Sedang Dipelajari`
- `Selesai`
- `Materi selesai · Quiz belum selesai` ketika kondisi itu benar-benar relevan.

Tidak ada technical status atau provenance internal pada DOM.

## 9. Derivasi Current Focus

Current Focus adalah item `required` pertama, mengikuti urutan path, yang authoritative server status-nya belum `completed`. Module dari item tersebut menjadi tahap saat ini dan canonical href item menjadi action `Lanjut belajar`.

Jika href tidak tersedia, action dinonaktifkan. Jika seluruh item wajib selesai, UI menyatakan learning path selesai tetapi tidak menyimpulkan final Internship completion, karena final review/capstone berada di luar Phase 1B.

Tidak ada field current-module baru dan tidak ada state tersebut yang disimpan di browser.

## 10. Progress rendering

Nilai overall percentage, completed, dan required ditampilkan dari response `/progress` tanpa recomputation atau penggabungan dengan localStorage. Lebar visual progress bar saja yang dibatasi ke rentang 0–100 agar CSS aman; angka teks tetap sama persis dengan nilai server, termasuk nilai desimal.

Halaman memuat ulang projection server ketika kembali melalui persisted page navigation. Login ulang atau refresh selalu merekonstruksi state dari endpoint, bukan dari marker lokal.

## 11. Feature flag

`INTERNSHIP_ENABLED=false` tetap menjadi default. Ketika flag false, backend tidak memasang routes Internship. Direct page load menangani 404 `/me` sebagai feature-disabled state, sedangkan navbar tetap menyembunyikan entry.

Tidak ada asumsi bahwa hiding di frontend adalah authorization; object-level authorization Phase 1A tetap menjadi authority.

## 12. Verifikasi dan hasil

### Automated contract/unit tests

`npm run test:internship`

- **25 passed, 0 failed** setelah penambahan coverage Phase 1B.
- Mencakup canonical resolver, server-authoritative evidence, identity, object authorization, feature-off behavior, endpoint contract, selection allowlist, ordering, focus, exact progress, safe href, participant statuses, state mapping, navbar gating, native shell, dan core surface presence.

### Browser validation

Playwright CLI terhadap preview fixture kontrak Phase 1A:

- desktop render berhasil;
- mobile 390 × 844: `documentWidth = 390`, tanpa horizontal overflow;
- overall progress tampil `25%` sesuai response;
- program selector mengganti batch, title, status, dan URL;
- `?batch=forbidden` otomatis kembali ke batch pertama dari `/me`;
- canonical action menuju `/elearning-assets/courses.html`;
- gated navbar entry tampil setelah `/me` berhasil;
- browser console: **0 errors, 0 warnings** pada final run.

### Existing/relevant checks

- `node scripts/smoke-elearning-theory.js`: **passed**.
- `npm run migrate:internship:validate`: **passed**, migration tervalidasi lalu rollback; persistent DB kembali ke state awal.
- `git diff --check`: **passed**; hanya warning line-ending LF/CRLF existing workspace.
- `npm run smoke:unified-learning`: **failed** pada health data existing: optional table `learning_materials` tidak ada dan jumlah SME decision `337` tidak sama dengan canonical content `371`. Phase 1B tidak mengubah catalog, registry, atau SME decision data.

### Matrix minimum Phase 1B

| # | Verifikasi | Hasil |
|---:|---|---|
| 1 | Feature disabled; BCL existing unchanged | Pass — route unmounted test + nav default hidden |
| 2 | Peserta tanpa enrollment | Pass — null selection + safe empty-state contract |
| 3 | Satu Internship | Pass — deterministic default selection |
| 4 | Beberapa Internship | Pass — tested dan browser-switched |
| 5 | Urutan learning path | Pass |
| 6 | Canonical href membuka BCL existing | Pass |
| 7 | Item completed | Pass |
| 8 | Item incomplete/status | Pass |
| 9 | Progress sama persis dengan API | Pass, termasuk `18.5` fixture unit |
| 10 | localStorage tidak override progress | Pass |
| 11 | Refresh/login state server-derived | Pass — token hanya auth; pageshow reloads server |
| 12 | Modified URL tidak membuka batch unauthorized | Pass, unit + browser |
| 13 | Unknown content tidak crash | Pass — rendered unavailable |
| 14 | Tidak ada UNC/native path di response/DOM | Pass |
| 15 | Core BCL learning surfaces tetap ada | Pass; Elearning theory smoke juga lulus |

## 13. Known limitations

1. Live endpoint smoke terhadap database yang sudah di-apply tetap belum dijalankan, sesuai keputusan user untuk melewati gate tersebut pada tahap ini.
2. Model sekarang tidak memiliki month mapping resmi. Roadmap Phase 1B memakai ordered learning stages, tanpa month label atau hard-coded business grouping.
3. Progress disegarkan pada initial load, program switch, refresh, dan persisted page return; belum ada realtime polling, sesuai scope sederhana Phase 1B.
4. Menu melakukan satu lightweight `/me` request untuk feature/auth gate pada fragment load.
5. Health mismatch Unified Learning `337/371` tetap perlu ditangani sebagai pekerjaan data governance terpisah; tidak diperbaiki diam-diam dalam Phase 1B.

## 14. Regression findings

Tidak ditemukan regresi yang disebabkan perubahan Phase 1B pada Elearning theory shell, navbar render, participant routes, atau canonical Internship projection. Browser final run bersih dan file core tetap tersedia.

Satu check Unified Learning gagal karena debt/data parity existing yang berada di luar perubahan ini. Absennya optional `learning_materials` sudah tercatat pada dokumentasi module health existing; selisih baru terhadap 371 canonical item memerlukan review SME queue terpisah.

## 15. Rekomendasi fase berikutnya

Sebelum memulai Assignment/Evidence/Mentor Review, lakukan review UI Phase 1B dan live smoke gate Phase 1A pada environment yang migration-nya telah di-apply. Setelah itu sepakati contract assignment/evidence dan authorization matrix secara eksplisit. Jangan memakai UI Phase 1B sebagai completion writer atau memperluasnya menjadi mentor dashboard tanpa fase desain dan approval baru.
