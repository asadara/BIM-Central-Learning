# Tindak lanjut KPI untuk Kepala Divisi — 16 September 2026

## Perubahan yang aktif

Dashboard Kepala Divisi sekarang menampilkan ringkasan realisasi menunggu verifikasi, usulan kontribusi, dan task selesai belum diklaim, beserta tombol **Buka tindak lanjut KPI**.

Pada menu KPI, tab awal Kepala Divisi menjadi **Tindak Lanjut** dengan empat tahapan yang dapat dipilih:

1. **Setujui kontribusi**: periksa program, PIC, target, satuan, bobot, dan bukti yang diharapkan. Formulir menjelaskan bahwa persetujuan ini menetapkan rencana dan belum menghitung skor.
2. **Staff ajukan realisasi**: task selesai yang belum diklaim ditampilkan per PIC, dengan rincian judul, periode, mapping KPI Divisi, dan ketersediaan bukti. Kepala Divisi dapat membuka pengaturan target/kontribusi dan daftar kontribusi individu.
3. **Verifikasi realisasi**: daftar pengajuan memperlihatkan PIC, program, target, actual diajukan, bobot, dan status lampiran. Tombol **Periksa & verifikasi** membuka rincian pemeriksaan.
4. **Skor terhitung**: jumlah kontribusi terverifikasi dan akses ke skor individu. Penjelasan menyebutkan batas konsolidasi Departemen di platform eksternal.

Antrean kosong menjelaskan mengapa belum ada yang dapat diverifikasi serta tindakan berikutnya. Pada snapshot data audit: 35 task selesai belum diklaim, 4 kontribusi approved belum diajukan realisasinya, dan 0 realisasi menunggu verifikasi. Seluruh hitungan ini berasal dari data API, bukan angka tetap pada UI. Periode KPI dinyatakan Januari–Desember tahun terpilih.

## Dialog verifikasi

- Menampilkan PIC, program, target, dan actual diajukan.
- Memperlihatkan bukti yang diharapkan, catatan PIC, tautan bukti realisasi, serta bukti task jika tersedia.
- Menampilkan status task pendukung, performa, keterlambatan, revisi, dan jumlah worklog. Tidak menampilkan jam kerja privat.
- Nilai yang disetujui memperbarui perkiraan skor kontribusi individu secara langsung. Perkiraan memakai cap achievement, faktor performa, dan bobot yang sama dengan backend.
- Tombol persetujuan dinonaktifkan jika ada task tertaut yang belum selesai/dibatalkan; pemeriksaan backend tetap berlaku saat submit.
- Pengembalian revisi meminta catatan yang dapat ditindaklanjuti PIC.
- Skor Divisi dijelaskan sebagai perhitungan ulang menurut target program dan bobot indikator; UI tidak menyamakan skor individu dengan skor Divisi.

Endpoint baca-saja baru: `GET /api/bim-workspace/kpi/assignments/:id/verification-preview`. Endpoint ini hanya untuk role `division_head` dan hanya untuk assignment `verification_pending`. Ringkasan task seluruh Divisi pada `guidance.workflow` juga hanya diberikan kepada Kepala Divisi.

## Validasi

**14 pemeriksaan backend lulus** melalui `node scripts/test-bim-kpi-workflow.js`. Data uji menggunakan tabel temporer PostgreSQL dan di-rollback. Tambahan cakupan: daftar persiapan Kepala Divisi, pengecualian task yang sudah masuk claim, perpindahan antrean setelah pengajuan/verifikasi, pembatasan role, preview pengajuan stale, serta rincian faktor task.

**10 skenario browser lulus** pada pratinjau lokal yang memblokir operasi tulis:

1. Antrean verifikasi kosong menjelaskan tindakan berikutnya.
2. Rincian task per PIC dapat dibuka.
3. Tindakan pengaturan target membuka tab program.
4. Layout mobile 390 px tanpa overflow horizontal halaman.
5. Dialog menampilkan bukti/task dan memperbarui skor dari 14,4% menjadi 7,2% ketika actual uji diubah dari 2 menjadi 1.
6. Revisi tanpa catatan tidak mengirim request atau menutup dialog.
7. Task belum selesai menonaktifkan approval, sementara revisi tetap tersedia.
8. Form persetujuan kontribusi menjelaskan konteks penetapan rencana.
9. Pintasan Dashboard membuka Tindak Lanjut dengan ringkasan kebutuhan KPI.
10. Tampilan khusus Kepala Divisi tidak ditampilkan untuk role staff.

Tidak ada error runtime pada skenario akhir. Syntax JavaScript dan pemeriksaan whitespace lulus. Screenshot tersimpan di `output/playwright/kpi-head-workflow-desktop.png`, `kpi-head-workflow-mobile.png`, `kpi-head-verification-desktop.png`, dan `kpi-head-verification-mobile.png`.

Backend telah dimuat ulang dan `/ping` kembali 200. Endpoint KPI dan verification-preview menolak akses tanpa autentikasi dengan 401. HTML, JavaScript, dan CSS terbaru terkonfirmasi tersaji dari domain publik. Browser publik tetap memerlukan login; interaksi role diuji pada pratinjau lokal, bukan dengan menyetujui data produksi.

Tidak ada perubahan manual pada target, task, actual, evidence, atau persetujuan KPI produksi.
