# Audit Task Scheduler dan KPI — 16 September 2026

Halaman: https://bcl.nke.net/pages/divisi-bim-workspace.html

## Kesimpulan

Task `approved_done` belum memberi skor KPI sebelum realisasinya diajukan dan diverifikasi Kepala Divisi. Data saat pemeriksaan berhenti sebelum tahapan tersebut. Kalkulasi individu dan divisi berhasil menghasilkan skor dalam pengujian terisolasi. KPI Departemen memang tidak dihitung di BCL menurut kontrak implementasi saat ini.

## Bukti data

Database lokal `bcl_database` diperiksa dalam transaksi `BEGIN READ ONLY`, kemudian `ROLLBACK`. Angka di bawah merupakan snapshot saat audit, bukan angka yang akan selalu tetap.

| Temuan | Jumlah |
| --- | ---: |
| Task selesai disetujui, intake approved, selain master | 35 |
| Task selesai dengan mapping indikator Divisi | 8 |
| Task selesai dengan mapping kontribusi Individu | 0 |
| Task selesai dengan evidence link terisi | 0 |
| Kontribusi individu berstatus approved | 4 |
| Actual diajukan / actual diverifikasi | 0 / 0 |
| Klaim task pada tabel assignment task claims | 0 |
| Task September 100% tetapi masih submitted_for_review | 3 |

Distribusi task selesai selain master: Juli 8, Agustus 17, September 10. Satu master yang selesai tidak dihitung kembali agar output subtask tidak terduplikasi.

Keempat kontribusi individu masih `approved`, seluruhnya untuk satu PIC. Target kontribusi tersimpan adalah `0.0001 request`, `0.0101 project`, `0.0101 innovation`, dan `0.0201 scope`. Beberapa target program juga memiliki akhiran `0.0001`. Nilai ini perlu ditinjau pemilik KPI; audit tidak mengubah target atau menebak satuan dan jumlah output yang benar.

## Alur yang berlaku

1. Tentukan indikator Divisi dan kontribusi Individu yang sesuai PIC, tahun, target, dan bobot.
2. Kepala Divisi menyetujui kontribusi. Approval kontribusi belum merupakan verifikasi actual.
3. Task selesai disetujui dapat diklaim lewat KPI → Langkah Berikutnya; staff memeriksa actual dan melampirkan evidence.
4. Kepala Divisi memverifikasi actual. Pada tahap ini status menjadi `achieved`, skor individu disimpan, dan skor Divisi dihitung dari actual terverifikasi.
5. Kontribusi Divisi dapat diekspor untuk konsolidasi Departemen. BCL mengembalikan skor Departemen `null` dengan pemilik kalkulasi `external_department_platform`.

Pemilihan indikator Divisi pada task tanpa kontribusi Individu diperbolehkan oleh `resolveKpiTaskLink`; ini belum memberikan kredit individu. Panduan Kepala Divisi hanya menampilkan usulan dan actual yang sudah diajukan, sehingga belum ada antrean review KPI ketika staff belum mengajukan klaim.

Rujukan implementasi: `backend/routes/bimWorkspaceRoutes.js`, fungsi `resolveKpiTaskLink`, `loadKpiGuidance`, `loadKpiOperations`, `calculateDivisionProgramResult`, `buildDivisionContributionPackage`, serta route completion-review, submit-actual, dan verify. Aturan ini juga dinyatakan dalam blueprint Workspace bagian 4.1–4.3.

## Bug formulir yang diperbaiki

Enam field target memakai `min=0.0001` dan `step=0.01`. Browser menghitung kelipatan step dari min, sehingga target bulat seperti `2` mengalami step mismatch sedangkan `2.0001` valid. Perilaku ini direproduksi di browser. Ini dapat menjelaskan pola pecahan target, tetapi tidak membuktikan bagaimana setiap nilai historis dimasukkan.

Step diselaraskan menjadi `0.0001`, sesuai presisi empat desimal target database. Target bulat dan pecahan yang sesuai presisi sekarang valid, sementara nol tetap ditolak. Versi JavaScript halaman diperbarui menjadi `20260916a`. Data target lama tidak diubah.

Perubahan berlaku pada target program, target kontribusi, revisi usulan, dan target pada review. Actual serta aturan approval tetap seperti sebelumnya.

## Pengujian

Jalankan ulang: `node scripts/test-bim-kpi-workflow.js`.

Sebelas pemeriksaan lulus:

1. Mapping indikator Divisi saja tidak membentuk kredit individu.
2. Pengajuan dan approval penyelesaian task tidak otomatis menaikkan KPI.
3. Task selesai yang belum diklaim muncul dalam guidance staff.
4. Pengajuan actual tanpa evidence ditolak.
5. Actual menunggu verifikasi belum menaikkan skor.
6. Staff tidak dapat memverifikasi actual sendiri.
7. Task tertaut yang belum selesai memblokir verifikasi.
8. Verifikasi actual menaikkan skor individu dan Divisi serta menautkan klaim task.
9. Task yang sudah tertaut tidak dapat diklaim ulang.
10. Paket kontribusi tersedia, skor Departemen tetap null.
11. Pembagi Divisi kosong menghasilkan belum terukur; achievement dibatasi 120%.

Contoh sintetis: actual 2, target individu 2, bobot individu 15%, target program Divisi 10, bobot indikator Divisi 15%, faktor performa task 0.96. Skor individu berubah dari 0 menjadi **14.4%**; skor Divisi menjadi **2.88%**. Nilai ini hanya hasil pengujian, bukan skor pegawai sebenarnya.

Pengujian memanggil handler backend asli dan menjalankan SQL pada tabel temporer PostgreSQL. `search_path` hanya `pg_temp`, resolusi setiap tabel diperiksa, dan transaksi selalu di-rollback. Katalog indikator dibaca dari tabel publik. Bootstrap schema, middleware login, serta pencatatan audit/event tidak dijalankan dalam pengujian handler ini.

Validasi browser terhadap aset publik yang diperbarui: keenam konfigurasi step menjadi `0.0001`; sampel `0.0001`, `0.5`, `1`, `2`, dan `2.0001` diterima, sedangkan `0` ditolak. JavaScript dan HTML terbaru berhasil diambil dari domain publik dengan permintaan tanpa cache. Syntax JavaScript dan `git diff --check` lulus.

## Batas pemeriksaan dan tindak lanjut

Browser baru diarahkan ke login, sehingga audit ini tidak mengklaim pengujian klik sampai verifikasi dengan sesi pengguna produksi. Sebelum perubahan, hash JavaScript domain publik sama dengan file workspace. Bukti data berasal dari database runtime lokal; tidak ada perubahan atau persetujuan terhadap task, evidence, actual, dan skor pegawai produksi.

Pemilik KPI perlu meninjau target dan mapping, kemudian staff mengajukan actual dengan evidence dan Kepala Divisi memverifikasinya. Untuk task pelatihan yang sudah memilih BIM-08 tetapi belum memiliki kontribusi Individu, kontribusi tersebut perlu diajukan atau didelegasikan dahulu. Jumlah task tidak selalu sama dengan jumlah output KPI; kegiatan yang dipecah menjadi beberapa task perlu diperiksa agar tidak dihitung ganda.
