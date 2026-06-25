# Review Kesiapan BCL untuk Program Training "Upgrading Drafter terhadap Kemampuan BIM"

Dokumen ini disusun berdasarkan review terhadap kemampuan aktual BCL saat ini, dengan fokus pada kebutuhan batch pertama program upgrading drafter menjadi BIM Drafter / Junior BIM Modeler.

Analisis ini berangkat dari kemampuan yang benar-benar aktif di codebase dan alur operasional yang terlihat di backend, frontend e-learning, data learning materials, quiz/progress tracking, serta struktur konten BIM yang sudah tersedia.

---

## A. Ringkasan Kesiapan BCL

### Siap digunakan untuk apa saja

- BCL sudah siap digunakan sebagai platform distribusi materi pembelajaran BIM dasar.
- BCL sudah siap digunakan untuk menampilkan materi dalam bentuk PDF, video, dan konten pembelajaran yang dikurasi.
- BCL sudah siap digunakan untuk tracking progres belajar dasar, terutama:
  - pembukaan materi PDF
  - aktivitas belajar video/modul
  - progress user dasar
  - riwayat quiz, practice, dan exam
- BCL sudah siap digunakan untuk evaluasi teori dasar melalui quiz/post-test berbasis bank soal.
- BCL sudah siap digunakan untuk dashboard progres individual dasar.
- BCL sudah cukup siap menjadi media dokumentasi materi, aktivitas belajar, dan hasil evaluasi teori.

### Belum siap untuk apa saja

- BCL belum siap menjadi LMS praktik penuh untuk training BIM berbasis assignment proyek.
- BCL belum memiliki alur native untuk:
  - penugasan per sesi/modul
  - pengumpulan hasil tugas peserta dalam bentuk file model `.rvt`, `.dwg`, `.zip`
  - penilaian tugas praktik per submission
  - catatan mentor/reviewer per peserta
  - absensi atau kehadiran per sesi
  - rekap batch formal yang langsung siap untuk HC
- BCL juga belum memiliki cohort management yang jelas untuk memisahkan satu batch training dengan batch lainnya.

### Risiko utama jika digunakan untuk training ini

- Risiko pertama: sebagian fitur di BCL terlihat ada di frontend, tetapi tidak semuanya punya backend aktif yang siap operasional.
- Risiko kedua: struktur course saat ini masih cenderung berupa library konten, belum berupa program training batch yang terstruktur per minggu/sesi.
- Risiko ketiga: praktik BIM membutuhkan pengumpulan file model dan review mentor, sementara area ini belum didukung secara native oleh BCL.
- Risiko keempat: jika dipaksakan menjadi LMS end-to-end sejak batch pertama, akan terjadi over-engineering dan beban implementasi yang tidak proporsional.

---

## B. Mapping Kebutuhan Training vs Fitur BCL

| Kebutuhan training | Fitur BCL yang relevan | Status | Catatan teknis | Rekomendasi tindakan |
|---|---|---|---|---|
| Halaman/course khusus untuk program training drafter BIM | `courses.html`, katalog course, halaman e-learning | Perlu penyesuaian | Saat ini course masih berbentuk katalog umum per software/topik | Buat 1 halaman/course khusus `Upgrading Drafter BIM Batch 1` |
| Struktur modul pembelajaran per sesi/minggu | Halaman statis + pengelompokan materi | Perlu penyesuaian | Belum ada module engine yang matang untuk cohort training | Susun modul per minggu secara manual di halaman training |
| Upload materi PDF, video, link, file latihan, template | Learning materials admin + video catalog | Tersedia | Upload file materi sudah didukung; video dan PDF sudah bisa ditampilkan | Gunakan fitur existing, kurasi sesuai silabus |
| Penugasan peserta per modul/sesi | Tidak ada assignment engine aktif | Belum tersedia | Tidak ada entity assignment, due date, atau task per peserta | Gunakan brief tugas manual di setiap modul |
| Upload hasil tugas peserta | Tidak ada student submission endpoint | Belum tersedia | Tidak ada alur upload tugas peserta untuk file model/gambar kerja | Gunakan shared folder/Teams/SharePoint di luar BCL |
| Checklist penyelesaian materi | Activity tracking + progress sync | Perlu penyesuaian | Ada tracking open/completed, tapi belum checklist authored per modul | Gunakan checklist statis dan padankan dengan tracking activity |
| Monitoring progress peserta | Dashboard, user progress, activity summary, quiz stats | Tersedia | Sudah ada progress dasar per user | Pakai untuk monitoring batch pertama |
| Absensi atau tracking kehadiran | Active user tracking publik | Belum tersedia | Yang ada hanya active user tracking, bukan absensi sesi training | Tetap gunakan absensi manual |
| Post-test atau evaluasi pemahaman | Quiz/practice/exam engine | Tersedia | Nilai, riwayat, pass/fail sudah tersimpan | Gunakan sebagai post-test teori |
| Penilaian tugas praktik | Tidak ada grading workflow | Belum tersedia | Tidak ada rubric, score, dan komentar mentor per submission | Nilai praktik tetap di spreadsheet mentor |
| Rekap hasil akhir peserta | User progress + learning attempts + certificates | Perlu penyesuaian | Data ada, tetapi tersebar di beberapa area | Rekap batch disusun semi-manual |
| Rekomendasi status peserta | Competency dashboard + rule manual | Perlu penyesuaian | Belum ada rule khusus training drafter BIM | Buat rule sederhana layak/perlu pendampingan/belum layak |
| Dokumentasi evidence training | Materials, activity logs, attempts, certificates | Perlu penyesuaian | Belum ada dossier batch otomatis | Simpan evidence training dalam folder batch dan tarik data BCL sebagai pelengkap |

---

## C. Struktur Course Training yang Direkomendasikan di BCL

Struktur paling realistis untuk batch pertama adalah course berbasis modul mingguan/sesi, dengan BCL sebagai pusat materi, progress, dan evaluasi teori.

### Rekomendasi struktur modul

1. **M0 - Orientasi Program**
   - tujuan training
   - output yang diharapkan
   - cara penggunaan BCL

2. **M1 - Pengenalan BIM dan Peran Drafter dalam Workflow BIM**
   - BIM mindset
   - peran author, reviewer, approver, user
   - perbedaan drafting konvensional dan workflow BIM

3. **M2 - Transisi CAD ke BIM dan Pengantar Revit**
   - perbedaan CAD drafting vs BIM modeling
   - pengenalan antarmuka Revit
   - logika object-based modeling

4. **M3 - Project Setup Revit**
   - project setup
   - level
   - grid
   - view
   - template dasar

5. **M4 - Modeling Dasar Arsitektur**
   - wall
   - floor
   - roof
   - opening
   - basic family placement

6. **M5 - Modeling Dasar Struktur**
   - grid dan level struktur
   - kolom
   - balok
   - slab
   - elemen struktur sederhana

7. **M6 - Translasi Gambar 2D menjadi Model BIM**
   - membaca gambar kerja 2D
   - menerjemahkan ke model dasar
   - penataan model secara konsisten

8. **M7 - Output Gambar dari Model**
   - plan
   - section
   - elevation
   - sheet
   - annotation

9. **M8 - Quantity Take-Off dan Review Kualitas Model**
   - quantity take-off dasar
   - prinsip QA/QC sederhana
   - pengecekan kualitas model awal

10. **M9 - Final Assignment dan Post-Test**
    - final assignment model sederhana
    - output gambar kerja
    - post-test
    - review akhir mentor

### Format isi tiap modul di BCL

Setiap modul sebaiknya memiliki:

- pengantar singkat
- daftar materi PDF
- daftar video terpilih
- latihan/quiz jika ada
- instruksi tugas praktik
- link ke folder pengumpulan eksternal
- status selesai

---

## D. Data yang Perlu Disiapkan

Sebelum training dimulai, data dan artefak berikut perlu disiapkan:

### Data peserta dan administrasi

- daftar peserta training
- email/login peserta
- unit/departemen peserta
- mentor/reviewer yang mendampingi
- jadwal training batch pertama
- daftar sesi mingguan

### Materi pembelajaran

- daftar materi existing di BCL yang akan dipakai
- daftar materi baru yang perlu dibuat
- PDF pembelajaran per modul
- video pembelajaran per modul
- link referensi tambahan bila diperlukan

### File latihan

- file gambar kerja 2D sumber
- file latihan `.dwg`
- template atau contoh model `.rvt`
- template kerja atau standar penamaan file
- paket latihan dalam `.zip` bila perlu

### Evaluasi

- format pre-test bila digunakan
- format post-test
- bank soal khusus untuk upgrading drafter BIM
- rubrik penilaian tugas praktik
- kriteria kelulusan batch

### Monitoring dan evidence

- format absensi
- format tracking progress peserta
- format catatan mentor/reviewer
- format rekap nilai akhir
- format rekomendasi akhir peserta
- template laporan singkat untuk HC

---

## E. Rekomendasi Implementasi Batch Pertama

Skema paling sederhana dan aman untuk batch pertama adalah:

### Peran BCL pada batch pertama

Gunakan BCL hanya untuk 4 fungsi inti:

- platform pembelajaran
- repository materi dan dokumentasi
- monitoring progress dasar
- evaluasi teori dasar

### Hal yang jangan dipaksakan dulu

- jangan bangun assignment engine baru
- jangan bangun upload submission peserta di BCL
- jangan bangun absensi otomatis
- jangan bangun workflow grading mentor di sistem

### Skema operasional yang direkomendasikan

1. Buat 1 course/halaman khusus: `Upgrading Drafter BIM Batch 1`
2. Kurasi materi existing yang sudah ada di BCL
3. Tambahkan materi baru hanya untuk gap yang benar-benar penting
4. Gunakan quiz existing dan post-test tambahan untuk evaluasi teori
5. Gunakan shared folder/Teams/SharePoint untuk pengumpulan file praktik
6. Gunakan spreadsheet mentor untuk:
   - absensi
   - penilaian tugas praktik
   - catatan reviewer
   - rekomendasi akhir
7. Gunakan data BCL sebagai pelengkap evidence:
   - materi yang diakses
   - progress dasar
   - hasil quiz/post-test
   - certificate bila dipakai

### Rule sederhana status akhir peserta

Status akhir peserta dapat ditentukan dengan kombinasi:

- ketuntasan modul dasar
- nilai post-test
- kualitas final assignment
- review mentor

Usulan kategori:

- **Layak**: lulus post-test, tugas praktik baik, dan dapat bekerja dengan supervisi ringan
- **Perlu pendampingan**: memahami dasar, tetapi masih butuh pembinaan pada modeling/output
- **Belum layak**: belum menguasai dasar BIM workflow dan hasil praktik belum memenuhi minimum

---

## F. Daftar Gap Fitur

### Gap yang wajib ditutup sebelum training

- halaman/course khusus batch pertama
- struktur modul dan urutan sesi yang jelas
- kurasi materi yang relevan
- post-test yang sesuai konteks upgrading drafter BIM
- mekanisme pengumpulan tugas praktik di luar BCL
- template rekap akhir peserta

### Gap yang bisa diakali dengan workaround

- checklist penyelesaian materi
- upload file latihan non-PDF dengan membungkus dalam ZIP
- rekomendasi status akhir peserta
- catatan mentor
- evidence training untuk HC
- rekap gabungan nilai teori dan praktik

### Gap yang bisa ditunda ke pengembangan berikutnya

- assignment submission native
- grading workflow per peserta
- rubric scoring di sistem
- absensi per sesi
- cohort management
- mentor note per submission
- export laporan batch otomatis
- dashboard khusus training HC/Engineering

---

## Mapping Materi Training terhadap Konten BCL Saat Ini

### Materi yang relatif sudah tersedia atau cukup dekat

- pengenalan BIM
- BIM mindset
- workflow BIM
- governance dasar
- peran dalam sistem BIM
- quality gate
- beberapa manual book BIM dasar
- beberapa PDF Revit MEP dan Revit Structure
- beberapa video Revit
- dokumen QA/QC, Open BIM, LOD/LOA, clash detection

### Materi yang kemungkinan belum cukup matang dan perlu dibuat/dirapikan

- modul transisi drafter 2D ke BIM secara spesifik
- pengantar Revit yang benar-benar bertahap untuk drafter idle
- project setup Revit yang disusun sesuai learning flow batch
- modeling arsitektur dasar yang terstruktur dari nol
- modeling struktur dasar yang terstruktur dari nol
- latihan membaca gambar 2D lalu memodelkan
- output gambar plan/section/elevation/sheet yang disusun sebagai paket pembelajaran
- quantity take-off dasar yang fokus pada peserta batch ini
- final assignment brief dan rubrik

---

## Kesimpulan

BCL sudah layak dipakai untuk mendukung batch pertama program upgrading drafter BIM, tetapi belum layak diposisikan sebagai LMS praktik end-to-end.

Posisi paling realistis untuk BCL saat ini adalah:

- pusat materi pembelajaran
- pusat dokumentasi training
- alat monitoring progres dasar
- alat evaluasi teori dasar

Untuk kebutuhan praktik, pengumpulan model, penilaian mentor, absensi, dan rekap formal HC, pendekatan paling aman adalah tetap memakai workaround operasional sederhana di luar BCL.

Dengan pendekatan tersebut, batch pertama bisa berjalan tanpa perubahan fondasi besar pada BCL dan tanpa over-engineering.
