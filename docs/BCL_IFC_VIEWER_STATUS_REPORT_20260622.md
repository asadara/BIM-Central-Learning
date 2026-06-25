# Report Status IFC Viewer BCL

Tanggal report: 2026-06-22
Sesi terkait: BCL IFC Viewer Prototype - Knowledge Center Integration
Keyword tracking: KW_IFC_VIEWER
Status: Prototype enhanced aktif, sudah terverifikasi dengan sample IFC internal

## Ringkasan Eksekutif

Halaman IFC Viewer BCL saat ini sudah berfungsi sebagai prototype viewer model IFC di bawah Knowledge Center. Prototype sudah melewati tahap minimum viewer dan sudah memiliki beberapa fitur review BIM dasar: load IFC, orbit/pan/zoom, fit model, preset view, grid, section cut, category visibility, selected element inspector, measurement dua titik, metadata, fullscreen, progress/status, download original, serta browse file IFC lokal.

Secara status produk, IFC Viewer sudah layak disebut selesai untuk prototype awal. Sisa pekerjaan berada pada area performance readiness, review BIM lanjutan, dan dokumentasi internal.

## Lokasi Implementasi

Frontend utama:

- `BC-Learning-Main/pages/ifc-viewer.html`
- `BC-Learning-Main/src/ifc-viewer.js`
- `BC-Learning-Main/js/ifc-viewer.bundle.js`
- `BC-Learning-Main/css/ifc-viewer.css`

Integrasi BCL:

- `BC-Learning-Main/components/navbar.html`
- `BC-Learning-Main/pages/projects.html`
- `BC-Learning-Main/js/projects-explorer.js`
- `BC-Learning-Main/css/projects-explorer.css`

Backend/project media:

- `backend/server.js`
- `backend/services/projectCatalogService.js`

Blueprint utama:

- `docs/BCL_IFC_VIEWER_BLUEPRINT_KW_IFC_VIEWER_20260619.md`

## Status Saat Ini

| Area | Status | Catatan |
| --- | --- | --- |
| Halaman IFC Viewer | Done | Halaman tersedia sebagai workspace khusus. |
| Integrasi Knowledge Center | Done | Entry menu IFC Viewer sudah ditambahkan. |
| Integrasi Projects Explorer | Done | File `.ifc` bisa tampil sebagai model dan dibuka ke viewer. |
| Load URL IFC | Done | File IFC bisa dibuka dari URL/path media BCL. |
| Browse IFC lokal | Done | User bisa memilih file `.ifc` langsung dari komputer/browser tanpa upload ke server. |
| That Open viewer core | Done | Menggunakan Components, FragmentsManager, IfcLoader, renderer, scene, camera, grid. |
| UI simplification | Done | Tombol Projects di pojok kanan atas sudah dihapus agar tidak rancu. |
| Enhanced BIM tools dasar | Partial Done | Section cut, category visibility, selected element highlight, isolate/hide selected, property panel dasar, dan measurement dua titik sudah ada; fragment cache dan property panel lanjutan belum. |
| Fragment cache | Later | Belum dibuat. |
| Test file sedang/besar | Open | Belum tercatat sebagai selesai di blueprint. |
| Dokumentasi user internal | Open | Belum dibuat. |

## Kapabilitas Yang Sudah Ada

### 1. File Loading

Kemampuan:

- Membuka IFC dari query URL.
- Membuka IFC dari input Model URL.
- Membuka IFC dari file lokal melalui tombol Browse IFC.
- Menampilkan progress/status saat loading.
- Menampilkan error state jika load gagal.
- Download original jika file berasal dari URL media.

Nilai untuk user:

- User bisa membuka model dari Projects Explorer maupun file lokal.
- Tidak perlu upload file lokal ke server untuk inspeksi cepat.

### 2. Viewer 3D Dasar

Kemampuan:

- Orbit, pan, zoom via camera controls.
- Reset camera.
- Fullscreen.
- Fit model.
- Preset view: Top, Front, Left, Right.
- Toggle grid.

Nilai untuk user:

- Cukup untuk navigasi dan review visual model IFC.
- Preset view membantu user non-teknis mengorientasikan model lebih cepat.

### 3. Model Metadata

Kemampuan:

- Menampilkan nama file.
- Menampilkan proyek.
- Menampilkan tahun.
- Menampilkan sumber file.
- Menampilkan jumlah model.
- Menampilkan jumlah kategori IFC yang terbaca.

Nilai untuk user:

- User tahu konteks model yang sedang dibuka.
- Mengurangi risiko salah membuka file/proyek.

### 4. Section Cut

Kemampuan:

- Membuat section cut pada axis X, Y, Z.
- Menghapus semua section cut.
- Menampilkan jumlah section cut aktif.

Nilai untuk user:

- User bisa inspeksi interior model secara sederhana.
- Berguna untuk review slab, wall, ruang, dan elemen yang tertutup.

### 5. Category Visibility

Kemampuan:

- Membaca kategori model yang memiliki geometri.
- Menampilkan daftar kategori IFC.
- Isolate kategori.
- Hide kategori.
- Show all kategori.

Nilai untuk user:

- User bisa fokus pada kategori tertentu, misalnya wall, slab, column, furniture.
- Ini membuat viewer mulai berguna sebagai alat review, bukan hanya model preview.

### 6. Project Discovery

Kemampuan:

- Scanner project media mengenali `.ifc`.
- Projects Explorer memiliki filter model IFC.
- Card IFC punya shortcut Open IFC.

Nilai untuk user:

- IFC menjadi bagian dari knowledge/project media BCL, bukan halaman terpisah yang harus diisi manual.

### 7. Selected Element Inspector

Kemampuan:

- Klik elemen model untuk memilih item IFC.
- Highlight elemen terpilih.
- Menampilkan Model ID, Local ID, Item ID, Category, Global ID, Name, ObjectType, Tag, dan property dasar lain jika tersedia.
- Isolate selected element.
- Hide selected element.
- Clear selected element.

Nilai untuk user:

- User bisa mulai melakukan inspeksi elemen, bukan hanya melihat model secara global.
- Ini menjadi fondasi untuk property review, issue/comment, dan measurement per elemen.

### 8. Measurement Dua Titik

Kemampuan:

- Mode Measure dapat diaktifkan dari sidebar.
- Klik titik awal dan titik akhir pada permukaan model.
- Viewer membuat marker titik, line 3D, dan daftar hasil pengukuran.
- Clear measurement untuk menghapus marker/line dan daftar hasil.

Nilai untuk user:

- User bisa melakukan pengecekan jarak cepat di model tanpa keluar dari BCL.
- Saat ini hasil ditampilkan dalam `unit model`; kalibrasi unit proyek masih perlu diuji pada IFC lain.

## Verifikasi Terakhir

Berdasarkan blueprint:

- Sample publik `school_str.ifc` berhasil dibuka.
- Sample internal `data/ifc/KIDs Soc Pool.ifc` berhasil dibuka via `/data/ifc/KIDs%20Soc%20Pool.ifc`.
- Browser test enhanced viewer berhasil:
  - 1 model terbaca.
  - 7 kategori terbaca.
  - Section cut create/clear berhasil.
  - Isolate/show all kategori berhasil.
- Browser test selected element inspector berhasil pada 2026-06-25:
  - Elemen model dapat diklik.
  - Panel Selected Element menampilkan IFC MEMBER, Global ID, Name, ObjectType, Tag, dan PredefinedType.
  - Isolate selected element berhasil.
- Browser test measurement berhasil pada 2026-06-25:
  - Mode Measure aktif.
  - Dua titik model dapat diklik.
  - Hasil jarak muncul di daftar measurement.
- Screenshot:
  - `output/playwright/ifc-viewer-sample.png`
  - `output/playwright/ifc-viewer-kids-soc-pool.png`
  - `output/playwright/ifc-viewer-enhanced.png`
  - `output/playwright/ifc-viewer-selected-element.png`
  - `output/playwright/ifc-viewer-measurement.png`

Catatan console:

- 401 dari `/api/users/me/access` muncul saat belum login.
- Itu berasal dari auth endpoint, bukan error IFC Viewer.

## Kelemahan dan Limitasi Saat Ini

### 1. Belum Ada Fragment Cache

Saat ini IFC masih dikonversi ke Fragments di browser setiap sesi. Untuk file kecil masih bisa diterima, tetapi untuk file sedang/besar akan terasa lambat.

Dampak:

- Load pertama dan load berulang sama-sama berat.
- CPU/RAM browser user bisa tinggi.
- Tidak ideal untuk pemakaian harian dengan file proyek besar.

Prioritas:

- Tinggi untuk production readiness.

### 2. Property Panel Masih Dasar

Viewer sudah mendukung klik elemen, highlight, dan property panel dasar. Namun pembacaan property set yang lebih dalam masih perlu dirapikan agar property kompleks seperti Pset dan quantities bisa ditampilkan lebih terstruktur.

Dampak:

- Data identity dasar sudah berguna.
- Audit property lengkap belum ideal.

Prioritas:

- Tinggi untuk Knowledge Center dan BIM review lanjutan.

### 3. Measurement Masih Sederhana

Tool measurement dua titik sudah tersedia, tetapi masih berupa jarak langsung antar dua titik dalam unit model.

Dampak:

- User sudah bisa melakukan pengecekan jarak cepat.
- Kalibrasi unit, snapping lanjutan, label permanen, dan ekspor measurement belum ada.

Prioritas:

- Sedang sampai tinggi, tergantung kebutuhan review internal.

### 4. Belum Ada Dokumentasi User

Belum ada panduan singkat untuk user internal.

Dampak:

- Adoption bisa lambat.
- User bisa bingung antara Model URL, Browse IFC, Projects Explorer, dan Download.

Prioritas:

- Sedang, mudah dibuat.

### 5. Belum Test File Sedang/Besar

Blueprint masih mencatat test file sedang dan file besar sebagai open.

Dampak:

- Belum ada baseline performa nyata untuk model proyek aktif.

Prioritas:

- Tinggi sebelum dipakai luas.

## Enhancement That Open Yang Masih Bisa Ditambahkan

### 1. Fragment Cache / Direct `.frag` Loading

Rujukan:

- IfcLoader docs: https://docs.thatopen.com/Tutorials/Components/Core/IfcLoader
- FragmentsManager docs: https://docs.thatopen.com/Tutorials/Components/Core/FragmentsManager
- Fragments overview: https://docs.thatopen.com/fragments/getting-started

Potensi enhancement:

- Setelah IFC dikonversi, simpan hasil `.frag`.
- Load berikutnya memakai `.frag`, bukan parsing IFC ulang.
- Cache key berdasarkan path, size, modified time.

Keunggulan:

- Load ulang jauh lebih cepat.
- Lebih stabil untuk file besar.
- Mengurangi beban browser.

Kelemahan:

- Perlu desain cache backend.
- Perlu invalidasi cache saat file IFC berubah.
- Perlu storage tambahan.

Rekomendasi:

- Ini enhancement paling penting untuk fase production readiness.

### 2. Element Picker / Selection / Highlight

Rujukan:

- Raycasters docs: https://docs.thatopen.com/Tutorials/Components/Core/Raycasters

Potensi enhancement:

- Status 2026-06-25: sudah tersedia sebagai selected element inspector dasar.
- Enhancement lanjutan: multi-select, selected element focus/zoom, dan persist selection state.

Keunggulan:

- Fondasi untuk property inspector, comment, issue, hide selected, isolate selected.
- Membuat viewer lebih interaktif.

Kelemahan:

- Perlu state selection yang rapi.
- Perlu menangani model besar agar highlight tetap ringan.

Rekomendasi:

- Lanjutkan sebagai refinement setelah property panel diperdalam.

### 3. Property Panel / IFC Data Inspector

Rujukan:

- FragmentsManager docs: https://docs.thatopen.com/Tutorials/Components/Core/FragmentsManager
- That Open Components API: https://docs.thatopen.com/api/%40thatopen/components/

Potensi enhancement:

- Status 2026-06-25: panel dasar sudah menampilkan selected element identity dan atribut utama.
- Enhancement lanjutan: panel kanan/bawah untuk property elemen terpilih yang lebih terstruktur.
- Menampilkan GlobalId, Name, Type, Level, Material, Pset, quantity, dan metadata lain secara berkelompok.
- Search/filter property.

Keunggulan:

- Nilai terbesar untuk Knowledge Center karena model menjadi sumber informasi, bukan hanya visual.
- Mendukung audit konten BIM.

Kelemahan:

- Struktur property IFC bervariasi tergantung export authoring tool.
- Perlu UI tabel yang tidak terlalu berat.

Rekomendasi:

- Prioritas tinggi untuk membuat viewer berguna dalam review BIM harian.

### 4. Measurement Tool

Rujukan:

- LengthMeasurement docs: https://docs.thatopen.com/Tutorials/Components/Front/LengthMeasurement
- VolumeMeasurement API: https://docs.thatopen.com/api/%40thatopen/components-front/classes/VolumeMeasurement

Potensi enhancement:

- Status 2026-06-25: ukur jarak dua titik sudah tersedia sebagai tool sederhana.
- Enhancement lanjutan: snap ke vertex/edge.
- Hapus measurement.
- Tampilkan daftar measurement.

Keunggulan:

- Berguna untuk cek clearance, tinggi, lebar, dan jarak antar elemen.
- Fitur yang umum diharapkan dari viewer model.

Kelemahan:

- Membutuhkan package `@thatopen/components-front`.
- Perlu validasi UX agar tidak bentrok dengan orbit/pan.
- Snap pada model berat perlu diuji performanya.

Rekomendasi:

- Prioritas berikutnya adalah validasi unit model dan snapping yang lebih presisi.

### 5. Viewpoints / Saved Views / BCF-Oriented Workflow

Rujukan:

- Viewpoints docs: https://docs.thatopen.com/Tutorials/Components/Core/Viewpoints

Potensi enhancement:

- Simpan camera view.
- Simpan isolate/hide state.
- Simpan screenshot/snapshot.
- Restore viewpoint.
- Basis untuk issue/comment berbasis lokasi model.

Keunggulan:

- Cocok untuk Knowledge Center dan koordinasi BIM.
- Bisa menjadi fondasi "temuan model" atau "lesson learned berbasis view".

Kelemahan:

- Perlu storage data viewpoint.
- Perlu definisi alur issue/comment.

Rekomendasi:

- Prioritas sedang setelah property panel.

### 6. IDS / Model Compliance Check

Rujukan:

- IDSSpecifications docs: https://docs.thatopen.com/Tutorials/Components/Core/IDSSpecifications

Potensi enhancement:

- Cek apakah elemen tertentu punya property wajib.
- Visualisasi pass/fail dengan warna.
- Gunakan IDS untuk quality gate BIM.

Keunggulan:

- Sangat relevan untuk governance BIM dan QA/QC.
- Bisa dikaitkan dengan standar BCL/NKE.

Kelemahan:

- Perlu definisi standar data internal.
- Perlu mapping property yang konsisten antar proyek.

Rekomendasi:

- Prioritas strategis, bukan MVP. Cocok untuk fase setelah viewer stabil.

### 7. Drawing / Annotation / Technical View

Rujukan:

- DrawingEditor docs: https://docs.thatopen.com/Tutorials/Components/Front/DrawingEditor
- Views docs: https://docs.thatopen.com/Tutorials/Components/Core/Views

Potensi enhancement:

- Generate view 2D dari model.
- Annotation/callout.
- Dimension/linear annotation.
- Export drawing/DXF pada scope tertentu.

Keunggulan:

- Bisa menghubungkan model review dengan output dokumentasi.
- Menarik untuk workflow koordinasi dan lesson learned.

Kelemahan:

- Kompleksitas tinggi.
- Perlu UI dan workflow yang matang.

Rekomendasi:

- Later phase, bukan prioritas dekat.

### 8. UI Components That Open

Rujukan:

- UserInterface docs: https://docs.thatopen.com/Tutorials/UserInterface/
- That Open UI API: https://docs.thatopen.com/api/%40thatopen/ui/

Potensi enhancement:

- Panel, toolbar, table, grouping, dan komponen UI BIM bawaan.
- Property table dengan grouping/filter.

Keunggulan:

- Bisa mempercepat pengembangan fitur BIM yang kompleks.

Kelemahan:

- BCL sudah punya design system dan CSS sendiri.
- Perlu dipilih hati-hati agar tidak bentrok visual.

Rekomendasi:

- Gunakan selektif. Jangan mengganti seluruh UI BCL.

## Prioritas Enhancement Rekomendasi

### Prioritas 1 - Production Readiness

1. Fragment cache `.frag`.
2. Test IFC sedang/besar.
3. Dokumentasi user internal.

Alasan:

- Tanpa cache dan test performa, viewer masih berisiko lambat untuk file proyek nyata.

### Prioritas 2 - Review BIM Dasar

1. Perdalam property panel.
2. Focus/zoom selected element.
3. Multi-select atau selection history.
4. Hide/isolate selected refinement.

Alasan:

- Ini membuat viewer berguna sebagai alat inspeksi model, bukan hanya visualisasi.

### Prioritas 3 - Review Tools

1. Validasi unit dan snapping measurement.
2. Saved viewpoints.
3. Comment/issue marker.

Alasan:

- Ini mendekatkan viewer ke workflow koordinasi BIM.

### Prioritas 4 - Governance / Quality

1. IDS compliance checker.
2. Property completeness check.
3. Visual pass/fail.

Alasan:

- Ini mendukung quality gate BIM dan standar data internal BCL/NKE.

## Catatan Keputusan

IFC Viewer saat ini sebaiknya tetap difokuskan sebagai viewer IFC/BIM berbasis That Open. Untuk DWG, gunakan blueprint terpisah karena engine dan isu lisensinya berbeda.

Jika nanti nama produk dinaikkan dari `IFC Viewer` menjadi `BIM Model Viewer`, rekomendasi teknisnya adalah membuat shell multi-format, tetapi tetap memisahkan engine:

- IFC: That Open.
- DWG/DXF: APS, ODA, atau conversion preview.
- PDF/Images: viewer internal BCL.

## Kesimpulan

Halaman IFC Viewer saat ini sudah mencapai status prototype enhanced dan sudah memiliki kapabilitas yang cukup untuk demonstrasi internal serta review visual dasar. Element selection/highlight, property panel dasar, dan measurement dua titik sudah ditambahkan pada 2026-06-25. Fitur That Open yang paling bernilai untuk enhancement berikutnya adalah Fragment cache, property panel lanjutan, measurement snapping/unit validation, saved viewpoints, dan IDS compliance.

Prioritas terdekat yang paling rasional adalah:

1. Test IFC sedang/besar.
2. Implementasi fragment cache.
3. Perdalam property panel dan selected element workflow.
4. Validasi unit dan snapping measurement.
5. Dokumentasi user internal.
