# BCL IFC Viewer Prototype - Knowledge Center

Tanggal sesi: 2026-06-19
Status: Prototype enhanced terpasang dan terverifikasi dengan sample IFC internal
Owner arah produk: BCL Knowledge Center
Keyword tracking: KW_IFC_VIEWER

## Judul Sesi Diskusi

BCL IFC Viewer Prototype - Knowledge Center Integration

Gunakan judul ini untuk melanjutkan diskusi atau meminta status:

`Lanjutkan sesi BCL IFC Viewer Prototype - Knowledge Center Integration`

## Tujuan

Membuat prototype IFC Viewer pada platform BCL sebagai halaman khusus di bawah menu Knowledge Center. Viewer harus bisa membuka file `.ifc` dari sumber proyek BCL, terutama Projects Explorer dan project sources lokal/LAN seperti PC-BIM02.

Target prototype awal:

- Halaman khusus IFC Viewer tersedia di Knowledge Center.
- File `.ifc` dapat ditemukan dari project sources BCL.
- User dapat membuka file `.ifc` dari halaman viewer atau shortcut Projects Explorer.
- Viewer mendukung orbit, pan, zoom, reset view, fit view, view preset, grid, fullscreen, section cut, category visibility, dan progress loading.
- Desain mengikuti gaya BCL yang sudah ada.

## Referensi Teknis

- That Open Company: https://thatopen.com/
- IfcLoader docs: https://docs.thatopen.com/Tutorials/Components/Core/IfcLoader
- FragmentsManager docs: https://docs.thatopen.com/Tutorials/Components/Core/FragmentsManager
- Clipper docs: https://docs.thatopen.com/Tutorials/Components/Core/Clipper
- Hider docs: https://docs.thatopen.com/Tutorials/Components/Core/Hider
- BoundingBoxer docs: https://docs.thatopen.com/Tutorials/Components/Core/BoundingBoxer

Catatan teknis penting:

- That Open merekomendasikan IFC dikonversi ke Fragments untuk performa.
- Prototype boleh memuat IFC langsung dengan `IfcLoader`.
- Untuk penggunaan harian, target berikutnya adalah cache `.frag` agar file besar tidak dikonversi ulang setiap sesi.

## Lokasi Integrasi BCL

Frontend:

- `BC-Learning-Main/pages/ifc-viewer.html`
- `BC-Learning-Main/src/ifc-viewer.js`
- `BC-Learning-Main/js/ifc-viewer.bundle.js`
- `BC-Learning-Main/css/ifc-viewer.css`
- `BC-Learning-Main/pages/projects.html`
- `BC-Learning-Main/js/projects-explorer.js`

Backend:

- `backend/server.js`
- `backend/routes/projectCatalogRoutes.js`
- `backend/services/projectCatalogService.js`
- `backend/services/projectMediaUtilityService.js`
- `backend/services/projectPathResolverService.js`

Menu/navigation yang perlu dicek:

- `BC-Learning-Main/js/loadComponents.js`
- `BC-Learning-Main/components/`
- Navbar/sidebar Knowledge Center terkait.

## Keputusan Produk

1. IFC Viewer menjadi halaman khusus di bawah Knowledge Center.
2. Projects Explorer tetap menjadi sumber file dan shortcut.
3. Nama menu awal: `IFC Viewer`.
4. Jika nanti support format lebih luas, nama dapat dinaikkan menjadi `BIM Model Viewer`.
5. Prototype fokus pada file IFC, bukan Revit `.rvt`, DWG, atau format native proprietary.

## Arsitektur Prototype

Flow utama:

1. User membuka Knowledge Center -> IFC Viewer.
2. Halaman menampilkan daftar file IFC dari project sources atau form input URL file.
3. User memilih file IFC.
4. Viewer mengambil file melalui URL media BCL.
5. That Open `IfcLoader` mengonversi IFC ke Fragments di browser.
6. `FragmentsManager` menampilkan model di scene.
7. UI menampilkan progress, status, dan kontrol kamera.

Flow shortcut:

1. User membuka Projects Explorer.
2. File `.ifc` muncul sebagai media tipe model.
3. User klik `Open IFC`.
4. Browser diarahkan ke `ifc-viewer.html?file=...&name=...`.

## Fase Implementasi

### Phase 0 - Baseline Check

Status: Done

- Cek struktur navbar Knowledge Center.
- Cek alur load component navbar/footer.
- Cek `projects-explorer.js` untuk struktur card media.
- Cek service katalog proyek yang membatasi ekstensi media.
- Tentukan cara build dependency That Open.

Acceptance criteria:

- Lokasi menu dan file yang perlu diedit sudah jelas.
- Risiko dependency dan build sudah dipilih.

### Phase 1 - IFC Discovery di Projects Explorer

Status: Done

Tasks:

- Tambahkan ekstensi `.ifc` ke scanning project media.
- Tambahkan kategori media `model` atau `ifc`.
- Tambahkan opsi filter `Model IFC`.
- Tambahkan card IFC dengan icon/model preview placeholder.
- Tambahkan tombol `Open IFC`.

Acceptance criteria:

- File `.ifc` muncul di Projects Explorer.
- File bisa difilter.
- Tombol mengarah ke halaman IFC Viewer dengan query file yang benar.

### Phase 2 - Halaman IFC Viewer di Knowledge Center

Status: Done

Tasks:

- Buat `ifc-viewer.html`.
- Buat `ifc-viewer.css`.
- Buat `ifc-viewer.js`.
- Integrasikan navbar/footer BCL.
- Tambahkan menu Knowledge Center -> IFC Viewer.
- Sediakan layout viewer: top bar, viewport, side panel metadata, status/progress.

Acceptance criteria:

- Halaman bisa dibuka langsung.
- Menu Knowledge Center menampilkan entry IFC Viewer.
- Layout responsif dan tidak bentrok dengan navbar/footer.

### Phase 3 - That Open Viewer Minimal

Status: Done

Tasks:

- Install dan lock dependency:
  - `three`
  - `@thatopen/components`
  - `@thatopen/fragments`
  - `web-ifc`
- Siapkan bundling untuk script viewer.
- Setup scene, renderer, camera, grid.
- Setup `FragmentsManager`.
- Setup `IfcLoader` dan WASM path.
- Load IFC dari query `file`.
- Tampilkan progress loading.
- Handle error file tidak bisa diakses, CORS, atau WASM gagal.

Acceptance criteria:

- Satu file IFC kecil berhasil tampil.
- Orbit, pan, zoom bekerja.
- Resize viewport bekerja.
- Error state jelas saat load gagal.

### Phase 4 - UX Prototype

Status: Done

Tasks:

- Tombol reset camera.
- Tombol fullscreen.
- Tombol download original saat URL file tersedia.
- Tombol Projects di topbar dihapus agar user tidak rancu antara halaman Projects dan IFC Viewer.
- Tampilkan nama file, sumber, ukuran jika tersedia.
- Loading overlay dengan progress.
- Empty state untuk halaman tanpa file.

Acceptance criteria:

- Viewer nyaman dipakai oleh user internal.
- User tahu status file sedang dibuka, gagal, atau selesai.

### Phase 5 - Fragment Cache

Status: Later

Tasks:

- Rancang cache `.frag` di backend.
- Cache key berdasarkan path, size, dan modified time.
- Jika `.frag` tersedia dan valid, load `.frag`.
- Jika tidak tersedia, load IFC dan opsi simpan hasil konversi.

Acceptance criteria:

- Model yang sama tidak perlu dikonversi ulang setiap sesi.
- Load kedua lebih cepat dari load pertama.

### Phase 6 - BIM Tools Dasar

Status: Partial Done

Tasks:

- Fit model dan view preset Top/Front/Left/Right.
- Toggle grid.
- Section clipping X/Y/Z dan Clear Cuts.
- Category visibility: isolate, hide, show all.
- Select/highlight element.
- Property panel dasar.
- Measurement sederhana jika stabil.

Acceptance criteria:

- Viewer mulai berguna untuk review BIM, bukan hanya visualisasi model.
- Status saat ini: category visibility, section cut dasar, selected element highlight, hide/isolate selected, property panel dasar, dan measurement sederhana sudah tersedia.

## Monitoring Board

Update bagian ini setiap selesai satu langkah besar.

| Tanggal | Area | Status | Catatan |
| --- | --- | --- | --- |
| 2026-06-19 | Blueprint | Done | Blueprint awal dibuat untuk sesi KW_IFC_VIEWER. |
| 2026-06-19 | Implementasi Phase 1 | Done | `.ifc` ditambahkan ke scanner project media dan Projects Explorer memiliki filter Model IFC serta tombol Open IFC. |
| 2026-06-19 | Implementasi Phase 2 | Done | Halaman `ifc-viewer.html`, CSS, source viewer, bundle, dan menu Knowledge Center -> IFC Viewer ditambahkan. |
| 2026-06-19 | Implementasi Phase 3 | Done | That Open viewer dibundle dengan `@thatopen/components`, `@thatopen/fragments`, `web-ifc`, dan `three`. |
| 2026-06-19 | Implementasi Phase 4 | Done | UI viewer memiliki input URL, Browse IFC, status/progress, metadata, reset camera, fullscreen, dan download original. |
| 2026-06-19 | Verifikasi | Done | Browser test berhasil membuka sample publik `school_str.ifc`; screenshot tersimpan di `output/playwright/ifc-viewer-sample.png`. |
| 2026-06-19 | Browse IFC lokal | Done | Tombol Browse IFC ditambahkan; user dapat memilih file `.ifc` lokal dan model dibaca langsung oleh browser tanpa upload server. |
| 2026-06-19 | Sample IFC internal | Done | File `data/ifc/KIDs Soc Pool.ifc` berhasil dibuka via `/data/ifc/KIDs%20Soc%20Pool.ifc`; screenshot tersimpan di `output/playwright/ifc-viewer-kids-soc-pool.png`. |
| 2026-06-19 | Layout spacing | Done | Padding atas halaman IFC Viewer dirapatkan karena body global sudah memiliki offset navbar; screenshot cek tersimpan di `output/playwright/ifc-viewer-spacing-fixed.png`. |
| 2026-06-19 | Layout spacing tighter | Done | Padding atas IFC Viewer dirapatkan lagi ke 8px untuk mengurangi ruang kosong; screenshot cek tersimpan di `output/playwright/ifc-viewer-spacing-tighter.png`. |
| 2026-06-19 | UI simplification | Done | Tombol Projects di pojok kanan atas halaman IFC Viewer dihapus; topbar hanya menampilkan Download saat URL file tersedia. |
| 2026-06-19 | That Open feature enhancement | Done | Ditambahkan Fit, Grid toggle, Top/Front/Left/Right view, Section Cut X/Y/Z, Clear Cuts, serta category isolate/hide/show all berbasis komponen That Open. |
| 2026-06-19 | Verifikasi enhanced viewer | Done | Browser test pada `data/ifc/KIDs Soc Pool.ifc` berhasil: 1 model, 7 kategori, section cut create/clear, isolate/show all kategori; screenshot `output/playwright/ifc-viewer-enhanced.png`. Console hanya menampilkan 401 auth `/api/users/me/access` saat belum login. |
| 2026-06-19 | Limitasi | Open | Fragment cache belum dibuat. Belum test IFC sedang/besar dari PC-BIM source. |
| 2026-06-25 | Selected element inspector | Done | Ditambahkan klik elemen model, highlight selected element, panel property dasar, serta isolate/hide/clear selected. Verifikasi pada `data/ifc/KIDs Soc Pool.ifc`; screenshot `output/playwright/ifc-viewer-selected-element.png`. |
| 2026-06-25 | Simple measurement | Done | Ditambahkan mode Measure dua titik dengan marker/line 3D dan daftar hasil jarak dalam unit model. Verifikasi pada `data/ifc/KIDs Soc Pool.ifc`; screenshot `output/playwright/ifc-viewer-measurement.png`. |

## Checklist Teknis

- [x] Confirm file IFC contoh tersedia.
- [x] Confirm ukuran file IFC contoh.
- [x] Confirm source path file IFC, lokal atau LAN.
- [x] Update scanner project media untuk `.ifc`.
- [x] Tambah halaman `ifc-viewer.html`.
- [x] Tambah JS viewer.
- [x] Tambah CSS viewer.
- [x] Tambah menu Knowledge Center.
- [x] Tambah tombol Browse IFC lokal.
- [x] Hilangkan tombol Projects di topbar IFC Viewer.
- [x] Tambah Fit, Grid toggle, dan view preset.
- [x] Tambah Section Cut X/Y/Z dan Clear Cuts.
- [x] Tambah Category Visibility isolate/hide/show all.
- [x] Tambah selected element picker dan highlight.
- [x] Tambah property panel dasar untuk elemen terpilih.
- [x] Tambah isolate/hide/clear selected element.
- [x] Tambah measurement sederhana dua titik.
- [x] Install dependency viewer.
- [x] Build bundle viewer.
- [x] Test halaman viewer langsung.
- [x] Test shortcut dari Projects Explorer.
- [x] Test file kecil.
- [x] Test sample internal `data/ifc/KIDs Soc Pool.ifc`.
- [x] Test fitur enhanced pada sample internal.
- [x] Test selected element inspector pada sample internal.
- [x] Test measurement sederhana pada sample internal.
- [ ] Test file sedang.
- [ ] Dokumentasi cara pakai untuk user internal.

## Risiko dan Mitigasi

1. File IFC besar lambat dibuka.
   - Mitigasi: mulai dari file kecil, lalu lanjut cache `.frag`.

2. WASM gagal load.
   - Mitigasi: pastikan MIME `.wasm` benar dan path `web-ifc` valid.

3. LAN source lambat atau tidak tersedia.
   - Mitigasi: tampilkan error state dan metadata source; jangan biarkan UI blank.

4. Dependency That Open bentrok dengan stack lama BCL.
   - Mitigasi: bundle viewer sebagai modul terpisah, tidak mengubah global script BCL.

5. Percakapan atau konteks terputus.
   - Mitigasi: gunakan dokumen ini sebagai checkpoint resmi. Lanjutkan dengan judul sesi dan keyword `KW_IFC_VIEWER`.

## Protokol Resume

Jika sesi chat terputus atau kuota habis, lanjutkan dengan prompt:

`Lanjutkan sesi BCL IFC Viewer Prototype - Knowledge Center Integration. Baca docs/BCL_IFC_VIEWER_BLUEPRINT_KW_IFC_VIEWER_20260619.md dan teruskan dari Monitoring Board terakhir.`

Instruksi kerja saat resume:

1. Baca blueprint ini terlebih dahulu.
2. Cek `git status`.
3. Jangan revert perubahan user.
4. Update Monitoring Board setelah menyelesaikan fase atau task penting.
5. Jika implementasi dimulai, jalankan verifikasi browser untuk halaman viewer.

## Definisi Done Prototype

Prototype dianggap selesai jika:

- Menu Knowledge Center memiliki entry IFC Viewer.
- Halaman IFC Viewer bisa dibuka.
- Projects Explorer dapat menampilkan file `.ifc`.
- File `.ifc` bisa dibuka dari Projects Explorer ke halaman viewer.
- Minimal satu IFC test berhasil tampil di browser.
- Loading, error, dan empty state tersedia.
- Catatan limitasi prototype terdokumentasi.
