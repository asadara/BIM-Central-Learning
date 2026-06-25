# BCL DWG Viewer Blueprint - Knowledge Center

Tanggal sesi: 2026-06-22
Status: Blueprint only, belum implementasi
Owner arah produk: BCL Knowledge Center
Keyword tracking: KW_DWG_VIEWER

## Judul Sesi Diskusi

BCL DWG Viewer Feasibility - Knowledge Center Integration

Gunakan judul ini untuk melanjutkan diskusi atau meminta status:

`Lanjutkan sesi BCL DWG Viewer Feasibility - Knowledge Center Integration`

## Tujuan

Mempelajari apakah skema IFC Viewer yang sudah dibuat di BCL dapat dipakai untuk DWG Viewer, tanpa implementasi terlebih dahulu. Fokus blueprint ini adalah arsitektur, opsi teknologi, keunggulan, kelemahan, risiko, dan fase kerja jika nanti diputuskan lanjut.

## Kesimpulan Awal

Skema IFC Viewer bisa dipakai ulang di level produk dan integrasi BCL:

- Halaman khusus di bawah Knowledge Center.
- Shortcut dari Projects Explorer.
- URL/file picker dari storage BCL.
- Panel metadata, status/progress, toolbar, fullscreen, dan download original.
- Monitoring blueprint dan verifikasi browser.

Namun mesin viewer IFC tidak bisa dipakai langsung untuk DWG:

- IFC adalah format BIM terbuka yang didukung oleh That Open melalui `IfcLoader` dan Fragments.
- DWG adalah format CAD proprietary; browser tidak punya parser DWG native bawaan.
- That Open cocok sebagai BIM/IFC stack, tetapi tidak tersedia sebagai DWG native viewer berdasarkan dokumentasi yang dicek.
- Untuk DWG diperlukan layer adapter khusus: cloud translation, self-hosted SDK, atau server-side conversion.

Rekomendasi awal:

1. Jika BCL butuh DWG preview cepat dan aman secara data internal, mulai dari **2D preview via server-side conversion ke PDF/SVG/PNG**.
2. Jika BCL butuh viewer kaya fitur dengan layer, properties, measurement, dan 2D/3D CAD lengkap, evaluasi **Autodesk Platform Services Viewer** atau **Open Design Alliance SDK**.
3. Jangan memaksa That Open IFC stack untuk membaca DWG native; lebih tepat membuat `BIM/CAD Viewer shell` dengan engine berbeda per format.

## Referensi Teknis

- That Open docs: https://docs.thatopen.com/intro
- Autodesk Platform Services Viewer SDK: https://aps.autodesk.com/en/docs/viewer/v7
- Autodesk Model Derivative API: https://aps.autodesk.com/en/docs/model-derivative/v2
- Autodesk supported translations: https://aps.autodesk.com/en/docs/model-derivative/v2/developers_guide/supported-translations
- ODA Drawings SDK: https://www.opendesign.com/products/drawings
- ODA Visualize SDK: https://www.opendesign.com/products/visualize

## Perbandingan IFC Viewer vs DWG Viewer

| Area | IFC Viewer saat ini | DWG Viewer rencana |
| --- | --- | --- |
| Format utama | `.ifc` | `.dwg`, opsional `.dxf` |
| Nature format | Open BIM | Proprietary CAD |
| Engine saat ini | That Open Components + IfcLoader + Fragments | Perlu engine berbeda |
| Client-side direct load | Bisa, via browser + WASM `web-ifc` | Tidak direkomendasikan tanpa SDK khusus |
| Cache performa | `.frag` | SVF/SVF2, internal raster/vector derivative, atau SDK cache |
| Metadata | IFC categories/properties | CAD layers, blocks, layouts, xrefs, object properties |
| Risiko utama | File besar lambat konversi | Lisensi, akurasi konversi, cloud/data security, DWG version/proxy objects |

## Opsi Arsitektur

### Opsi A - Autodesk Platform Services Viewer

Ringkas:

- File DWG di-upload/diakses oleh backend BCL.
- Backend mengirim file ke Autodesk Platform Services.
- Model Derivative API menerjemahkan DWG ke format viewer seperti SVF/SVF2.
- Frontend BCL memakai Autodesk Viewer SDK untuk menampilkan 2D/3D model.

Keunggulan:

- Paling matang untuk pengalaman web CAD.
- Mendukung 2D/3D viewing, object tree, properties, layer/object visibility, measurement, markup/extension ecosystem.
- Tidak perlu membuat parser DWG sendiri.
- Cocok jika workflow cloud Autodesk diterima oleh kebijakan data BCL/NKE.

Kelemahan:

- File DWG harus diproses di platform cloud Autodesk, kecuali ada strategi khusus/proxy sesuai ketentuan APS.
- Ada kebutuhan credential, token, bucket/object storage, job translation, polling manifest, dan manajemen derivative.
- Ada potensi biaya API dan ketergantungan vendor.
- Perlu review legal/data governance karena dokumen proyek bisa sensitif.
- Load pertama bergantung pada waktu upload dan translation.

Kecocokan BCL:

- Cocok untuk pilot cepat jika data governance mengizinkan cloud.
- Kurang ideal untuk project confidential yang wajib tetap di jaringan internal.

### Opsi B - Open Design Alliance SDK / InWeb / Visualize

Ringkas:

- BCL memakai SDK ODA untuk membaca/menampilkan DWG.
- Bisa diarahkan ke self-hosted/private cloud model.
- Engine dapat mendukung native DWG/DGN/DXF dan potensi edit/save jika lisensi dan scope memungkinkan.

Keunggulan:

- Lebih selaras dengan kebutuhan data internal/self-hosted.
- ODA Drawings SDK menyasar DWG/DGN native, termasuk view, create, edit, save.
- ODA Visualize menyediakan fitur viewer seperti measurement, cutting/sectioning, selection/highlight, native properties access, dan large model support.
- Lebih kuat untuk roadmap CAD serius jangka panjang.

Kelemahan:

- Perlu procurement/lisensi SDK dan evaluasi teknis vendor.
- Integrasi lebih berat dibanding meng-embed viewer cloud.
- Kemungkinan memerlukan build chain khusus, server component, atau web SDK yang tidak sesederhana bundle JavaScript biasa.
- Butuh engineer CAD/graphics lebih dalam untuk produksi.

Kecocokan BCL:

- Cocok untuk target production internal bila data tidak boleh keluar dari environment BCL/NKE.
- Cocok jika BCL ingin viewer CAD bukan sekadar preview.

### Opsi C - Server-Side Conversion Preview

Ringkas:

- Backend BCL mendeteksi file `.dwg`.
- Backend membuat derivative preview internal, misalnya PDF/SVG/PNG per layout.
- Frontend menampilkan preview 2D dengan viewer ringan milik BCL.

Keunggulan:

- Paling sederhana untuk MVP.
- Data tetap dapat dijaga di environment internal jika converter dijalankan lokal.
- Bisa memakai pola yang mirip dengan project media/pdf preview yang sudah ada.
- Tidak butuh cloud viewer untuk tahap awal.
- Cocok untuk kebutuhan "lihat gambar kerja" cepat.

Kelemahan:

- Bukan DWG viewer penuh.
- Layer, block, xref, object properties, selection, dan measurement CAD bisa hilang atau terbatas.
- Akurasi tergantung converter, font/plot style/CTB/STB, xref, dan versi DWG.
- 3D DWG tidak menjadi prioritas.
- Jika converter berbasis aplikasi desktop, automation/server licensing harus dicek.

Kecocokan BCL:

- Cocok sebagai fase awal paling aman sebelum investasi SDK.
- Tidak cukup jika targetnya CAD review interaktif penuh.

### Opsi D - Hybrid BIM/CAD Viewer Shell

Ringkas:

- BCL membuat halaman umum `Model Viewer` atau tetap memisahkan `IFC Viewer` dan `DWG Viewer`.
- Shell UI sama: source selector, metadata, status, fullscreen, download, toolbar.
- Engine dipilih berdasarkan format:
  - IFC: That Open.
  - DWG: APS, ODA, atau preview conversion.

Keunggulan:

- UX konsisten untuk user BCL.
- Projects Explorer dapat punya satu entry point `Open Model` dengan routing format.
- Tidak mencampur dependency dan lifecycle IFC dengan DWG.
- Lebih mudah memperluas ke DXF, DGN, PDF, NWD, atau RVT derivative di masa depan.

Kelemahan:

- Abstraksi viewer perlu dirancang rapi agar tidak menjadi kompleks.
- Setiap engine punya metadata dan event model berbeda.
- Testing lebih luas karena tiap format punya jalur load yang berbeda.

Kecocokan BCL:

- Ini arah desain yang paling sehat jika BCL akan mendukung multi-format.

## Rekomendasi Roadmap

### Phase 0 - Feasibility Decision

Status: Proposed

Tasks:

- Kumpulkan 5-10 sample DWG internal: kecil, sedang, besar, xref, layout banyak, AutoCAD Architecture/Civil jika ada.
- Klasifikasi kebutuhan user: preview gambar kerja, layer toggle, measurement, property inspect, markup, atau editing.
- Konfirmasi kebijakan data: boleh cloud Autodesk atau wajib internal.
- Putuskan jalur MVP: APS, ODA, atau server-side conversion.

Acceptance criteria:

- Keputusan engine MVP tertulis.
- Sample test DWG tersedia.
- Risiko data governance jelas.

### Phase 1 - DWG Discovery di Projects Explorer

Status: Proposed

Tasks:

- Tambahkan `.dwg` dan opsional `.dxf` ke scanner project media.
- Tambahkan media kind `cad` atau `drawing`.
- Tambahkan filter `CAD/DWG`.
- Tambahkan card DWG dengan metadata ukuran/source/path.
- Tambahkan tombol `Open DWG` atau `Preview DWG`.

Acceptance criteria:

- File DWG muncul di Projects Explorer.
- User dapat membuka DWG ke halaman viewer/preview.

### Phase 2 - DWG Viewer Shell

Status: Proposed

Tasks:

- Buat halaman `dwg-viewer.html` atau perluas menjadi `model-viewer.html`.
- Reuse pola IFC: topbar, side panel, URL input, Browse, status/progress, metadata, download original.
- Sediakan empty/error state.
- Sediakan adapter interface agar engine DWG bisa diganti.

Acceptance criteria:

- Shell viewer bisa dibuka tanpa engine final.
- UX konsisten dengan IFC Viewer.

### Phase 3A - APS Proof of Concept

Status: Optional

Tasks:

- Setup APS app credentials di backend.
- Upload DWG ke APS Object Storage.
- Trigger Model Derivative translation.
- Poll manifest sampai ready.
- Render hasil dengan Autodesk Viewer SDK.

Acceptance criteria:

- Satu DWG sample berhasil tampil di browser.
- Layer/properties/measurement dasar dievaluasi.
- Catatan biaya, security, dan data retention ditulis.

### Phase 3B - ODA Proof of Concept

Status: Optional

Tasks:

- Minta trial/evaluasi ODA Drawings/Visualize/InWeb.
- Uji load DWG internal di environment lokal/private.
- Uji layer, layout, xref, properties, measurement, section jika ada.
- Estimasi effort integrasi BCL.

Acceptance criteria:

- Satu DWG sample berhasil tampil tanpa cloud publik.
- Kebutuhan lisensi dan deployment jelas.

### Phase 3C - Conversion Preview Proof of Concept

Status: Recommended MVP if cloud is not approved

Tasks:

- Pilih converter DWG ke PDF/SVG/PNG yang legal untuk server/internal use.
- Generate derivative preview per layout.
- Simpan cache derivative berdasarkan path, size, modified time.
- Tampilkan preview di halaman BCL.

Acceptance criteria:

- Satu DWG sample berhasil dipreview.
- Layout dan font umum tampil cukup akurat.
- Load kedua memakai cache derivative.

### Phase 4 - User Review Tools

Status: Later

Tasks:

- Layer toggle jika engine mendukung.
- Layout selector.
- Pan/zoom/fit.
- Measurement 2D.
- Markup/comment basic.
- Print/export PDF.

Acceptance criteria:

- Viewer berguna untuk review drawing harian.

## Monitoring Board

Update bagian ini setiap selesai satu langkah besar.

| Tanggal | Area | Status | Catatan |
| --- | --- | --- | --- |
| 2026-06-22 | Blueprint | Done | Blueprint DWG Viewer dibuat sebagai studi kelayakan; belum ada implementasi kode. |
| 2026-06-22 | Feasibility | Open | Skema IFC bisa dipakai untuk shell/alur BCL, tetapi engine DWG perlu APS, ODA, atau conversion preview. |
| 2026-06-22 | Decision Needed | Open | Perlu keputusan apakah DWG boleh diproses cloud atau wajib self-hosted/internal. |

## Keunggulan Jika Skema Ini Dipakai

- User BCL mendapat pengalaman konsisten antara IFC dan DWG.
- Projects Explorer tetap menjadi sumber dokumen/model.
- Knowledge Center menjadi pusat viewer teknis.
- Metadata, status, progress, download, dan error handling bisa dipakai ulang.
- Roadmap multi-format lebih mudah dibuat karena shell viewer dipisahkan dari engine.

## Kelemahan Jika Skema Ini Dipakai

- Jika terlalu dipaksa menjadi satu viewer universal, kompleksitas bisa naik cepat.
- DWG tidak membawa semantik BIM seperti IFC; category/property UX harus berbeda.
- Dependency viewer DWG dapat jauh lebih berat dari IFC.
- Untuk viewer penuh, kemungkinan ada biaya lisensi/API.
- Untuk data proyek sensitif, cloud translation dapat menjadi blocker.
- Server-side conversion lebih aman dan sederhana, tetapi fitur CAD interaktif terbatas.

## Risiko dan Mitigasi

1. File proyek tidak boleh keluar dari environment BCL/NKE.
   - Mitigasi: prioritaskan ODA/self-hosted atau conversion preview internal.

2. Akurasi preview DWG tidak sama dengan AutoCAD.
   - Mitigasi: test font, CTB/STB, xref, layout, viewport, proxy objects, dan versi DWG berbeda.

3. Biaya vendor/API tidak sesuai.
   - Mitigasi: lakukan POC terbatas dengan sample nyata sebelum membeli atau mengunci arsitektur.

4. Load file besar lambat.
   - Mitigasi: derivative cache berdasarkan path, size, modified time; pre-generate preview untuk project aktif.

5. User berharap editing DWG.
   - Mitigasi: tetapkan scope awal sebagai viewer/preview, bukan editor.

## Checklist Keputusan Sebelum Implementasi

- [ ] Apakah DWG boleh dikirim ke cloud Autodesk/third-party?
- [ ] Apakah target hanya preview 2D atau viewer CAD interaktif?
- [ ] Apakah perlu layer toggle?
- [ ] Apakah perlu properties/object selection?
- [ ] Apakah perlu measurement?
- [ ] Apakah perlu layout selector?
- [ ] Apakah perlu support xref?
- [ ] Apakah ada sample DWG kecil/sedang/besar?
- [ ] Apakah ada DWG dari AutoCAD Architecture/Civil 3D?
- [ ] Apakah BCL siap dengan lisensi/API vendor jika memilih APS/ODA?

## Definisi Done untuk Blueprint Ini

Blueprint ini dianggap selesai jika:

- Perbedaan IFC dan DWG sudah jelas.
- Opsi arsitektur DWG sudah dibandingkan.
- Keunggulan dan kelemahan sudah tercatat.
- Fase rencana implementasi sudah tersedia.
- Belum ada perubahan implementasi frontend/backend.
