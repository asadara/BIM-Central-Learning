# BCL Media Fallback Audit

Tanggal audit: 2026-06-25
Sesi: BCL Media Fallback Audit
Keyword tracking: KW_MEDIA_FALLBACK_AUDIT
Status: Audit source-code selesai, P0 broken fallback sudah diperbaiki

## Ringkasan

Audit ini memeriksa halaman dan renderer yang menampilkan media: image, video, thumbnail, cover PDF, sample image, plugin logo, news image, avatar, dan preview media project.

Metode audit:
- Scan source HTML, JS, CSS, dan backend route dengan `rg`.
- Cek halaman yang memuat renderer JS media.
- Cek path fallback yang muncul di kode terhadap file lokal di workspace.
- Klasifikasi dummy/generic fallback dipisahkan dari fallback fungsional berbasis ikon.

Catatan batasan:
- Audit ini adalah audit source-code, bukan crawl visual browser per halaman.
- Ketersediaan media dinamis dari API/server runtime tidak divalidasi satu per satu.
- Logo/icon UI umum tidak dianggap masalah kecuali dipakai sebagai dummy/sample media.

## Status Fallback Asset Lokal

| Asset fallback | Status file lokal | Dampak |
|---|---:|---|
| `BC-Learning-Main/img/ready.jpg` | Ada | Dipakai sebagai fallback generic news/instructor. |
| `BC-Learning-Main/img/course-default.svg` | Ada | Dipakai sebagai fallback course di home dan backend course admin. |
| `BC-Learning-Main/img/undercon.gif` | Ada | Dipakai untuk halaman under construction dan loading video BIM. |
| `BC-Learning-Main/img/fallback-thumb.png` | Tidak ada | Berpotensi broken image di tutorial, elearning, dan plugin fallback. |
| `BC-Learning-Main/img/course-default.jpg` | Tidak ada | Berpotensi broken image di `elearning-assets/js/courses.js`. |
| `BC-Learning-Main/img/default.jpg` | Tidak ada | Berpotensi broken image di `elearning-assets/js/courses.js`, dashboard, dan learning path. |
| `BC-Learning-Main/img/user-default.png` | Tidak ada | Berpotensi broken avatar fallback pada signup/auth. |
| `BC-Learning-Main/elearning-assets/images/default-course.jpg` | Tidak ada | Berpotensi broken image di profile course list. |
| `BC-Learning-Main/img/media-thumbnail.svg` | Ada | Ditambahkan 2026-06-25 sebagai fallback thumbnail internal untuk media/course/plugin. |
| `BC-Learning-Main/img/user-default.svg` | Ada | Ditambahkan 2026-06-25 sebagai fallback avatar internal. |

## Prioritas Temuan

### P0 - Fallback menunjuk file yang tidak ada

1. `BC-Learning-Main/pages/elearning.html`
   - Fallback: `/img/fallback-thumb.png`, `../img/fallback-thumb.png`
   - Bukti: `pages/elearning.html:667`, `1055`, `1065`, `1121`
   - Risiko: thumbnail course/video dapat menjadi broken image jika thumbnail asli gagal.

2. `BC-Learning-Main/pages/tutorial.html` via `BC-Learning-Main/js/tutorials.js`
   - Fallback: `../img/fallback-thumb.png`
   - Bukti: `js/tutorials.js:1261`, `1272`, `1295`
   - Risiko: video thumbnail gagal dan fallback juga tidak tersedia.

3. `BC-Learning-Main/pages/plugins.html` via `BC-Learning-Main/js/plugins.js`
   - Fallback: `/img/fallback-thumb.png`
   - Bukti: `js/plugins.js:3`, `86`
   - Risiko: plugin tanpa logo atau logo error menampilkan broken image.

4. `BC-Learning-Main/elearning-assets/courses.html` via `BC-Learning-Main/elearning-assets/js/courses.js`
   - Fallback: `/img/course-default.jpg`, `/img/default.jpg`
   - Bukti: `courses.js:1088`, `1098`, `1345`, `1371`, `1876`
   - Risiko: course/video card dapat broken image setelah thumbnail generation gagal.

5. `BC-Learning-Main/elearning-assets/dashboard.html` via `BC-Learning-Main/elearning-assets/js/dashboard.js`
   - Fallback: `../img/default.jpg`
   - Bukti: `dashboard.js:675`
   - Risiko: course progress card dapat broken image.

6. `BC-Learning-Main/elearning-assets/profile.html` via `BC-Learning-Main/elearning-assets/js/profile.js`
   - Fallback: `/elearning-assets/images/default-course.jpg`
   - Bukti: `profile.js:859`
   - Risiko: enrolled course image dapat broken image.

7. `BC-Learning-Main/pages/learning-path.html` via `BC-Learning-Main/js/learning-path.js`
   - Fallback/static image: `/BC-Learning-Main/img/default.jpg`
   - Bukti: `learning-path.js:10`
   - Risiko: module thumbnail kemungkinan broken karena file tidak ada dan path mengandung prefix app yang tidak konsisten.

8. `BC-Learning-Main/pages/signup.html` dan backend auth routes
   - Fallback avatar: `/img/user-default.png`
   - Bukti: `pages/signup.html:385`, `515`; `backend/routes/userAuthRoutes.js`
   - Risiko: fallback avatar user dapat broken image. Ini fallback yang wajar, tetapi asset-nya perlu tersedia.

### P1 - Dummy/generic visual masih muncul

1. `BC-Learning-Main/pages/training.html`
   - Dummy external: `https://via.placeholder.com/500x300?text=BIM+Indonesia`
   - Bukti: `pages/training.html:57`
   - Rekomendasi: ganti dengan asset BCL/training asli atau hilangkan visual hero jika belum ada.

2. `BC-Learning-Main/components/image.html`
   - Dummy external: `https://picsum.photos/400/250`
   - Bukti: `components/image.html:6`
   - Rekomendasi: ganti dengan asset internal atau hapus component jika tidak dipakai.

3. `BC-Learning-Main/pages/updates.html`
   - Generic fallback: `../img/ready.jpg`
   - Bukti: `pages/updates.html:367`, `398`, `416`, `434`
   - Catatan: ini berada pada fallback content saat feed live tidak tersedia.
   - Rekomendasi: buat 3-4 news placeholder bertema BIM/NKE, bukan satu image generic berulang.

4. `BC-Learning-Main/js/news.js` dan `backend/routes/news.js`
   - Generic fallback: `/img/ready.jpg`
   - Bukti: `js/news.js:2`, `3`; `backend/routes/news.js:11`
   - Dampak: semua news tanpa image akan memakai gambar generic yang sama.
   - Rekomendasi: fallback per kategori news atau render card tanpa image saat source tidak punya image valid.

5. `BC-Learning-Main/js/admin/modules/news.js`
   - Generic fallback admin: `/img/ready.jpg`
   - Bukti: `js/admin/modules/news.js:9`
   - Rekomendasi: samakan dengan strategi news publik agar admin preview tidak menormalisasi gambar dummy.

6. `BC-Learning-Main/pages/instructor.html`
   - Generic image: `../img/ready.jpg`
   - Bukti: `pages/instructor.html:207`
   - Catatan: dua image lain sudah spesifik: `instructor-1.jpg`, `instructor-2.jpg`.
   - Rekomendasi: ganti section ketiga dengan foto trainer/kelas/workshop aktual.

7. `BC-Learning-Main/pages/projectsbu.html`
   - Under-construction image: `/img/undercon.gif`
   - Bukti: `pages/projectsbu.html:122`
   - Rekomendasi: jika halaman masih bisa diakses user, redirect ke `pages/projects.html` atau beri pesan non-media yang jelas.

8. `BC-Learning-Main/pages/bim.html`
   - Loading background video: `../img/undercon.gif`
   - Bukti: `pages/bim.html:184-185`
   - Catatan: dipakai saat video loadstart, bukan fallback akhir.
   - Rekomendasi: pakai skeleton/loading neutral, bukan GIF under-construction.

9. `BC-Learning-Main/js/searchengine.js`
   - Dummy external empty/error state: Unsplash construction image
   - Bukti: `js/searchengine.js:35`, `98`
   - Catatan: di `pages/elearning.html` script ini sedang commented out, tetapi tetap menjadi risiko bila diaktifkan kembali.
   - Rekomendasi: ganti dengan empty-state icon/internal illustration atau teks tanpa image.

### P2 - Static sample/template content yang perlu validasi konten

1. `BC-Learning-Main/index.html`
   - Static media: carousel, banner, category, course sample images.
   - Bukti: `index.html:606`, `636`, `665`, `825`, `844`, `942`, `1452-1502`.
   - Fallback course: `./img/course-default.svg` pada `index.html:1545`, `1556`.
   - Status: bukan broken fallback karena SVG ada, tetapi konten course static perlu validasi apakah masih sample/template.

2. `BC-Learning-Main/pages/courses.html`
   - Static sample course/category images: `img/cat*.png`, `img/course-*.jpg/png`.
   - Bukti: `pages/courses.html:128-198`, `224-564`
   - Status: legacy/static course catalog. Perlu keputusan apakah masih dipakai atau diganti dengan data course dinamis.

3. `BC-Learning-Main/pages/team.html`
   - Static team image: `team-1.png`, `team-2.png`, lalu `testimonial-*.jpg` untuk anggota lain.
   - Bukti: `pages/team.html:176`, `204`, `232`, `260`, `288`, `316`
   - Status: kemungkinan sample portrait untuk sebagian anggota. Perlu validasi nama dan foto aktual.

4. `BC-Learning-Main/pages/testimonial.html`
   - Static testimonial image: `testimonial-1.jpg` sampai `testimonial-4.jpg`.
   - Bukti: `pages/testimonial.html:63`, `73`, `83`, `93`
   - Status: sample/template testimonial. Perlu validasi konten aktual.

5. `BC-Learning-Main/pages/single.html`
   - Static sample media: `testimonial-2.jpg`, `course-1.jpg`.
   - Bukti: `pages/single.html:172`, `285`, `326`
   - Status: page template/legacy. Perlu validasi apakah masih aktif di navigasi.

6. `BC-Learning-Main/elearning-assets/profile.html`
   - Static profile avatar awal: `/elearning-assets/images/pic-1.jpg`
   - Bukti: `elearning-assets/profile.html:12`
   - Status: sample avatar awal. Setelah user data load, profile JS bisa mengganti image.

## Halaman Dengan Fallback Yang Dinilai Aman / Fungsional

| Halaman / renderer | Hasil audit |
|---|---|
| `BC-Learning-Main/pages/projects.html` + `js/projects-explorer.js` | Media project memakai thumbnail asli jika ada. Bila gagal, image/video disembunyikan dan diganti ikon file-type, bukan dummy foto. |
| `BC-Learning-Main/pages/bim-methode.html` + `js/bim-methode.js` | Thumbnail memakai cache/API. Bila gagal, pindah ke fallback ikon file-type. Tidak memakai dummy image. |
| `BC-Learning-Main/pages/manual-books.html` + `js/manual-books.js` | Empty state berbasis markup/text. Tidak ditemukan fallback dummy image. |
| `BC-Learning-Main/elearning-assets/courses.html` + `pdf-role-filters.js` | PDF thumbnail memakai endpoint API. Bila gagal, tampil blok fallback PDF dengan ikon dan judul, bukan dummy foto. |
| `BC-Learning-Main/pages/Knowledgehub.html` + `js/showroom-player.js` | Viewer video/image punya error handler, tidak ditemukan fallback dummy image. |
| `BC-Learning-Main/pages/workflow-bim-nke.html` | Memakai asset workflow lokal `pages/img/bim-nke-workflow.png`; file ada. |
| `BC-Learning-Main/pages/sub/adminbcl.html` + `pages/sub/adminbcl.js` | Preview video/image memakai media asli. Thumbnail video yang gagal disembunyikan, tidak diganti dummy image. |
| `BC-Learning-Main/pages/ifc-viewer.html` | Tidak ada fallback dummy image/video yang relevan; halaman fokus canvas IFC dan kontrol viewer. |
| `BC-Learning-Main/pages/bim.html` static BIM images | Asset `bim01.png`, `bim02.png`, `bim03.png`, `bim04.png`, `bim05.png`, `cde.png` ada di lokal. Masalah hanya loading GIF `undercon.gif`. |

## Daftar Halaman Yang Diaudit

| Halaman / area | Status |
|---|---|
| `BC-Learning-Main/index.html` | Static/sample media + fallback `course-default.svg` tersedia. Perlu validasi konten, bukan bug utama. |
| `BC-Learning-Main/pages/training.html` | Ada dummy external placeholder. Prioritas P1. |
| `BC-Learning-Main/pages/updates.html` | Ada `ready.jpg` berulang untuk fallback news. Prioritas P1. |
| `BC-Learning-Main/pages/instructor.html` | Ada `ready.jpg` sebagai image section. Prioritas P1. |
| `BC-Learning-Main/pages/projectsbu.html` | Halaman under construction dengan GIF. Prioritas P1 jika masih bisa diakses. |
| `BC-Learning-Main/pages/bim.html` | Video dan gambar lokal OK; loading video memakai `undercon.gif`. Prioritas P1/P2. |
| `BC-Learning-Main/pages/elearning.html` | Fallback thumbnail menuju `fallback-thumb.png` yang tidak ada. Prioritas P0. |
| `BC-Learning-Main/pages/tutorial.html` | Fallback thumbnail menuju `fallback-thumb.png` yang tidak ada. Prioritas P0. |
| `BC-Learning-Main/pages/plugins.html` | Plugin logo fallback menuju `fallback-thumb.png` yang tidak ada. Prioritas P0. |
| `BC-Learning-Main/pages/learning-path.html` | Thumbnail menuju `default.jpg` yang tidak ada. Prioritas P0. |
| `BC-Learning-Main/pages/Knowledgehub.html` | Tidak ditemukan dummy fallback. OK. |
| `BC-Learning-Main/pages/projects.html` | Fallback fungsional ikon file-type. OK. |
| `BC-Learning-Main/pages/bim-methode.html` | Fallback fungsional ikon file-type. OK. |
| `BC-Learning-Main/pages/manual-books.html` | Tidak ditemukan dummy fallback. OK. |
| `BC-Learning-Main/pages/workflow-bim-nke.html` | Asset lokal ada. OK. |
| `BC-Learning-Main/pages/courses.html` | Static sample course/category image. Perlu validasi konten. |
| `BC-Learning-Main/pages/team.html` | Static team/testimonial image. Perlu validasi konten. |
| `BC-Learning-Main/pages/testimonial.html` | Static testimonial sample image. Perlu validasi konten. |
| `BC-Learning-Main/pages/single.html` | Static legacy/sample image. Perlu validasi apakah page masih aktif. |
| `BC-Learning-Main/pages/signup.html` | Avatar fallback wajar, tapi asset `user-default.png` tidak ada. Prioritas P0 minor. |
| `BC-Learning-Main/pages/sub/adminbcl.html` | Preview media OK; admin news module masih memakai `ready.jpg`. |
| `BC-Learning-Main/elearning-assets/courses.html` | Course/video thumbnail fallback menuju file tidak ada. Prioritas P0. PDF fallback OK. |
| `BC-Learning-Main/elearning-assets/dashboard.html` | Course dashboard fallback menuju `default.jpg` yang tidak ada. Prioritas P0. |
| `BC-Learning-Main/elearning-assets/profile.html` | Course fallback menuju `default-course.jpg` yang tidak ada; avatar awal masih sample. Prioritas P0/P2. |
| `BC-Learning-Main/components/image.html` | Dummy external `picsum.photos`. Prioritas P1 jika component dipakai. |

## Rekomendasi Perbaikan Bertahap

1. Buat fallback asset internal yang konsisten dan benar-benar ada:
   - `/img/fallback-thumb.png`
   - `/img/default.jpg`
   - `/img/course-default.jpg`
   - `/img/user-default.png`
   - `/elearning-assets/images/default-course.jpg`

2. Ganti fallback image generic menjadi UI fungsional:
   - Untuk video/course tanpa thumbnail, gunakan block dengan ikon, judul, dan label "Thumbnail belum tersedia".
   - Untuk news tanpa image, render card tanpa image atau gunakan fallback per kategori.
   - Untuk plugin tanpa logo, gunakan badge/inisial plugin, bukan gambar dummy.

3. Hapus dummy external:
   - `via.placeholder.com` di training.
   - `picsum.photos` di component image.
   - Unsplash empty/error di `searchengine.js`.

4. Kurangi pemakaian `ready.jpg`:
   - News publik/backend/admin.
   - Fallback static updates.
   - Section instructor.

5. Audit konten legacy:
   - `courses.html`, `single.html`, `team.html`, `testimonial.html`, `profile.html`.
   - Putuskan apakah halaman masih aktif, diganti data dinamis, atau dihapus dari navigasi.

## Monitoring Board

| Item | Status | Catatan |
|---|---|---|
| Audit source-code media fallback | Done | Selesai 2026-06-25. |
| Cek keberadaan fallback asset lokal | Done | Beberapa fallback tidak ada. |
| Implementasi fallback asset internal thumbnail | Done | `img/media-thumbnail.svg` ditambahkan dan dipakai untuk thumbnail course/video/plugin/learning path. |
| Replace broken thumbnail fallback P0 | Done | `fallback-thumb.png`, `course-default.jpg`, `default.jpg`, dan `default-course.jpg` tidak lagi dipakai pada target thumbnail prioritas. |
| Replace avatar fallback `user-default.png` | Done | Diganti ke `img/user-default.svg` pada frontend dan backend auth route. |
| Replace dummy external image | Open | Training, component image, searchengine. |
| Replace `ready.jpg` generic strategy | Open | News, updates, admin news, instructor. |
| Validasi halaman legacy/sample | Open | Courses, team, testimonial, single, profile. |
| Browser visual regression setelah perbaikan | Open | Perlu dilakukan setelah implementasi. |

## Progress 2026-06-25

Perbaikan yang sudah dilakukan:
- Menambahkan fallback thumbnail internal `BC-Learning-Main/img/media-thumbnail.svg`.
- Menambahkan fallback avatar internal `BC-Learning-Main/img/user-default.svg`.
- Mengganti fallback thumbnail yang sebelumnya menunjuk file tidak ada pada:
  - `BC-Learning-Main/pages/elearning.html`
  - `BC-Learning-Main/pages/tutorial.html` via `BC-Learning-Main/js/tutorials.js`
  - `BC-Learning-Main/pages/plugins.html` via `BC-Learning-Main/js/plugins.js`
  - `BC-Learning-Main/pages/learning-path.html` via `BC-Learning-Main/js/learning-path.js`
  - `BC-Learning-Main/elearning-assets/home.html`
  - `BC-Learning-Main/elearning-assets/courses.html` via `BC-Learning-Main/elearning-assets/js/courses.js`
  - `BC-Learning-Main/elearning-assets/dashboard.html` via `BC-Learning-Main/elearning-assets/js/dashboard.js`
  - `BC-Learning-Main/elearning-assets/profile.html` via `BC-Learning-Main/elearning-assets/js/profile.js`
- Mengganti fallback avatar yang sebelumnya menunjuk `user-default.png` pada:
  - `BC-Learning-Main/js/user.js`
  - `BC-Learning-Main/js/userindex.js`
  - `BC-Learning-Main/pages/login.html`
  - `BC-Learning-Main/pages/signup.html`
  - `BC-Learning-Main/elearning-assets/js/user.js`
  - `BC-Learning-Main/elearning-assets/js/profile.js`
  - `BC-Learning-Main/elearning-assets/js/certifications.js`
  - `BC-Learning-Main/elearning-assets/js/auth-guard.js`
  - `backend/routes/userAuthRoutes.js`

Verifikasi:
- `node --check` lolos untuk file JS yang diubah.
- Scan ulang tidak menemukan sisa `fallback-thumb.png`, `course-default.jpg`, `default.jpg`, atau `default-course.jpg` pada target HTML/JS prioritas thumbnail.
- Scan ulang tidak menemukan sisa `user-default.png` pada source HTML/JS/backend yang diaudit.

Sisa yang belum dikerjakan:
- News/instructor fallback `ready.jpg`.
- Dummy external `via.placeholder.com`, `picsum.photos`, dan Unsplash empty state.
- `undercon.gif` pada halaman under-construction/loading video.

## Next Prompt

Untuk melanjutkan sesi ini:

`Lanjutkan sesi BCL Media Fallback Audit. Baca docs/BCL_MEDIA_FALLBACK_AUDIT_20260625.md. P0 broken fallback sudah dikerjakan; lanjutkan P1 dummy/generic image: ready.jpg, via.placeholder.com, picsum.photos, Unsplash empty state, dan undercon.gif.`
