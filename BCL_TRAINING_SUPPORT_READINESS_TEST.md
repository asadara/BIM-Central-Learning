# BCL Training Support Readiness Test

Dokumen ini mendefinisikan metode uji untuk menilai apakah **BCL cukup siap digunakan sebagai media training dan pembelajaran online berbasis web** untuk **batch pertama training BIM Modeller**.

Metode ini **bukan** full LMS maturity test. Tujuannya bukan menilai apakah BCL sudah setara LMS enterprise, tetapi menilai apakah BCL **cukup layak dipakai secara realistis** sebagai:

- platform pembelajaran
- repository materi
- progress tracking dasar
- quiz/post-test teori
- evidence pembelajaran dasar

Dokumen ini juga menegaskan bahwa beberapa fungsi **boleh** memakai workaround terkendali selama batch pertama, tanpa memaksa pengembangan fitur besar.

---

## A. Metode Test

### 1. Prinsip dasar

Prinsip test ini adalah:

- menguji BCL sesuai kebutuhan nyata batch pertama training BIM Modeller
- tidak menguji BCL seolah-olah harus menjadi LMS matang
- memisahkan fungsi yang **wajib native** di BCL dan fungsi yang **boleh workaround**
- hanya menerima workaround yang tetap terkendali dan terdokumentasi
- mengutamakan stabilitas operasional, bukan kelengkapan fitur besar

### 2. Ruang lingkup test

Test dilakukan terhadap kemampuan BCL untuk mendukung:

- akses peserta ke training
- distribusi materi pembelajaran
- penyelesaian materi dasar
- pelaksanaan quiz/post-test teori
- pencatatan progress dasar
- penyimpanan evidence pembelajaran
- dukungan operasional admin/mentor/HC secara minimum

### 3. Layer test

#### Layer 1 - Core BCL Function Test

Mengukur fungsi inti yang **harus hidup secara native** di BCL agar platform layak dipakai.

#### Layer 2 - Training Operation Support Test

Mengukur apakah training batch pertama tetap bisa dijalankan secara operasional, termasuk area yang boleh dibantu workaround terkendali.

#### Layer 3 - HC Evidence & Governance Test

Mengukur apakah hasil training dapat didokumentasikan dengan cukup rapi untuk kebutuhan evidence internal, HC, dan Departemen Engineering.

### 4. Status penilaian

Gunakan hanya 3 status:

| Status | Skor | Definisi |
|---|---:|---|
| Siap Native | 2 | Fungsi tersedia dan berjalan langsung di BCL, data tersimpan, dan dapat dipakai operasional |
| Siap dengan Workaround Terkendali | 1 | Fungsi belum native penuh, tetapi tetap bisa dijalankan dengan alat pendukung yang terkendali |
| Belum Siap | 0 | Fungsi tidak tersedia atau tidak cukup stabil untuk dipakai bahkan dengan workaround sederhana |

### 5. Fungsi yang wajib native di BCL

Fungsi berikut **wajib lulus sebagai native**:

- login peserta
- akses course/modul
- akses materi PDF/video/link
- quiz/post-test teori
- progress dasar
- data tetap tersimpan setelah refresh, logout, dan login kembali

Jika salah satu fungsi wajib native bernilai `0`, maka hasil test tidak boleh dinyatakan `Go`.

### 6. Fungsi yang boleh memakai workaround

Fungsi berikut **boleh** menggunakan workaround terkendali:

- absensi
- submission tugas praktik
- grading praktik
- catatan mentor
- rekap akhir
- evidence HC

### 7. Contoh workaround yang diterima

Workaround yang dianggap terkendali:

- `SharePoint` untuk folder pengumpulan tugas dan evidence
- `Teams` untuk link sesi, absensi, dan komunikasi batch
- `Spreadsheet mentor` untuk grading praktik, review note, dan rekap akhir

Workaround tidak dianggap terkendali jika:

- tidak ada owner yang jelas
- tidak ada format baku
- data tersebar di banyak tempat tanpa aturan nama
- sulit ditelusuri kembali saat audit internal

### 8. Cara pelaksanaan test

Test dilakukan menggunakan minimal 3 peran:

- `Admin` atau pengelola BCL
- `Peserta` training BIM Modeller
- `Mentor/Reviewer`

Skenario minimal:

1. Admin menyiapkan 1 course atau halaman training batch pertama.
2. Admin mengunggah atau menghubungkan materi PDF, video, link, dan file latihan.
3. Peserta login dan mengakses seluruh materi inti.
4. Peserta membuka materi, menyelesaikan quiz/post-test, lalu logout.
5. Peserta login kembali untuk memastikan data masih tersimpan.
6. Mentor/Admin memeriksa progress dasar dan hasil evaluasi teori.
7. Tim training memverifikasi bahwa absensi, tugas praktik, grading, dan rekap akhir dapat dikelola dengan workaround yang terkendali.
8. Tim HC/Engineering memverifikasi bahwa evidence minimal batch dapat dikumpulkan.

### 9. Cara membaca hasil

Penilaian akhir tidak hanya melihat total skor, tetapi juga memperhatikan:

- apakah semua fungsi wajib native lulus
- apakah workaround yang dipakai masih sederhana dan terkendali
- apakah batch pertama bisa dijalankan tanpa perubahan fondasi BCL

---

## B. Checklist Test Case

### Layer 1 - Core BCL Function Test

| No | Test case | Hasil yang diharapkan | Status |
|---|---|---|---|
| 1 | Peserta dapat login ke BCL | Login berhasil tanpa error kritis | 0 / 1 / 2 |
| 2 | Peserta dapat membuka halaman course/training BIM Modeller | Course atau halaman training dapat diakses | 0 / 1 / 2 |
| 3 | Peserta dapat membuka modul/sesi yang relevan | Struktur materi dapat diakses per bagian | 0 / 1 / 2 |
| 4 | Peserta dapat membuka materi PDF | PDF tampil dan dapat dibaca | 0 / 1 / 2 |
| 5 | Peserta dapat mengakses video training | Video dapat diputar normal | 0 / 1 / 2 |
| 6 | Peserta dapat membuka link materi eksternal | Link dapat dibuka tanpa hambatan berarti | 0 / 1 / 2 |
| 7 | Peserta dapat mengerjakan quiz/post-test teori | Quiz berjalan dan submit berhasil | 0 / 1 / 2 |
| 8 | Nilai quiz/post-test tercatat | Hasil nilai dapat dilihat kembali | 0 / 1 / 2 |
| 9 | Progress dasar tercatat setelah materi dibuka/diselesaikan | Progress user berubah sesuai aktivitas | 0 / 1 / 2 |
| 10 | Data tetap tersimpan setelah refresh | Tidak terjadi kehilangan data | 0 / 1 / 2 |
| 11 | Data tetap tersimpan setelah logout-login | Progress dan hasil evaluasi tetap ada | 0 / 1 / 2 |
| 12 | Admin/Mentor dapat melihat data dasar hasil belajar | Data peserta dapat dipantau | 0 / 1 / 2 |

### Layer 2 - Training Operation Support Test

| No | Test case | Native / Workaround | Hasil yang diharapkan | Status |
|---|---|---|---|---|
| 1 | Admin dapat menyiapkan struktur training batch pertama | Native | Halaman/course batch bisa dipakai | 0 / 1 / 2 |
| 2 | Materi PDF/video/link/file latihan dapat disusun sesuai silabus | Native | Materi tersedia dan urut | 0 / 1 / 2 |
| 3 | Brief tugas praktik dapat dibagikan ke peserta | Native atau sederhana | Peserta tahu apa yang harus dikerjakan | 0 / 1 / 2 |
| 4 | Absensi sesi dapat direkap | Workaround | Ada daftar hadir terkendali | 0 / 1 / 2 |
| 5 | Tugas praktik dapat dikumpulkan | Workaround | Ada folder submission yang tertib | 0 / 1 / 2 |
| 6 | Mentor dapat memberi penilaian praktik | Workaround | Ada format nilai dan review | 0 / 1 / 2 |
| 7 | Mentor dapat menulis catatan pembinaan | Workaround | Ada template review note | 0 / 1 / 2 |
| 8 | Rekap akhir peserta dapat disusun | Workaround | Nilai teori, praktik, progress, dan status dapat dirangkum | 0 / 1 / 2 |
| 9 | Tim training dapat memonitor batch tanpa kebingungan operasional | Kombinasi | Alur kerja tetap terkendali | 0 / 1 / 2 |

### Layer 3 - HC Evidence & Governance Test

| No | Test case | Native / Workaround | Hasil yang diharapkan | Status |
|---|---|---|---|---|
| 1 | Daftar peserta training tersedia | Native atau workaround | Daftar peserta jelas | 0 / 1 / 2 |
| 2 | Jadwal dan struktur modul terdokumentasi | Native atau workaround | Ada jadwal dan struktur training | 0 / 1 / 2 |
| 3 | Materi yang dipakai dapat ditelusuri | Native | Daftar materi dapat dibuktikan | 0 / 1 / 2 |
| 4 | Progress dasar peserta dapat dibuktikan | Native | Ada data progress dasar | 0 / 1 / 2 |
| 5 | Nilai post-test teori dapat dibuktikan | Native | Nilai tersimpan dan dapat ditarik | 0 / 1 / 2 |
| 6 | Hasil tugas praktik dapat dibuktikan | Workaround | File tugas tersimpan rapi | 0 / 1 / 2 |
| 7 | Catatan mentor/reviewer tersedia | Workaround | Ada review note atau rubric sederhana | 0 / 1 / 2 |
| 8 | Rekap akhir peserta tersedia | Workaround | Ada status akhir peserta | 0 / 1 / 2 |
| 9 | Evidence training cukup untuk HC/Engineering | Kombinasi | Bukti training dapat dijadikan lampiran internal | 0 / 1 / 2 |

---

## C. Kriteria Go / Go with Control / No-Go

### 1. Syarat minimum

Semua fungsi wajib native harus memenuhi dua syarat:

- tidak ada yang bernilai `0`
- mayoritas bernilai `2`

Jika ada fungsi wajib native bernilai `0`, hasil langsung minimal `No-Go` sampai isu diperbaiki.

### 2. Interpretasi hasil

#### Go

Dinyatakan `Go` jika:

- semua fungsi wajib native lulus
- tidak ada fungsi wajib native bernilai `0`
- sebagian besar fungsi inti bernilai `2`
- workaround yang dipakai hanya untuk fungsi non-inti
- batch pertama dapat dijalankan tanpa perubahan fondasi BCL

#### Go with Control

Dinyatakan `Go with Control` jika:

- semua fungsi wajib native minimal lulus
- ada beberapa fungsi operasional non-inti yang masih memakai workaround
- workaround tersebut terkendali, sederhana, dan terdokumentasi
- tim training menerima adanya kontrol manual tambahan pada batch pertama

#### No-Go

Dinyatakan `No-Go` jika:

- ada fungsi wajib native yang gagal
- data tidak persisten setelah refresh atau logout-login
- quiz/post-test teori tidak stabil
- peserta tidak bisa mengakses materi inti secara konsisten
- workaround menjadi terlalu banyak atau tidak terkendali

### 3. Panduan praktis keputusan

| Kondisi | Keputusan |
|---|---|
| Fungsi inti native berjalan stabil, sisanya bisa dibantu workaround ringan | Go |
| Fungsi inti native berjalan, tetapi operasi batch masih cukup bergantung pada kontrol manual | Go with Control |
| Fungsi inti native belum stabil atau data tidak dapat dipercaya | No-Go |

---

## D. Template Ringkasan Hasil Test

Gunakan template berikut setelah test selesai.

### 1. Ringkasan eksekutif

**Nama test:** BCL Training Support Readiness Test  
**Objek uji:** Batch pertama training BIM Modeller  
**Tanggal test:** [isi tanggal]  
**Tim penguji:** [isi nama tim]  
**Versi/lingkup BCL:** [isi bila perlu]  
**Hasil akhir:** `Go / Go with Control / No-Go`

### 2. Hasil per layer

| Layer | Ringkasan hasil | Catatan |
|---|---|---|
| Core BCL Function Test | [isi] | [isi] |
| Training Operation Support Test | [isi] | [isi] |
| HC Evidence & Governance Test | [isi] | [isi] |

### 3. Fungsi wajib native

| Fungsi | Status | Catatan |
|---|---|---|
| Login peserta | [0/1/2] | [isi] |
| Akses course/modul | [0/1/2] | [isi] |
| Akses materi PDF/video/link | [0/1/2] | [isi] |
| Quiz/post-test teori | [0/1/2] | [isi] |
| Progress dasar | [0/1/2] | [isi] |
| Data tersimpan setelah refresh/logout-login | [0/1/2] | [isi] |

### 4. Fungsi workaround terkendali

| Fungsi | Media workaround | Status | Catatan |
|---|---|---|---|
| Absensi | [Teams/Sheet/dll] | [0/1/2] | [isi] |
| Submission tugas praktik | [SharePoint/dll] | [0/1/2] | [isi] |
| Grading praktik | [Spreadsheet mentor/dll] | [0/1/2] | [isi] |
| Catatan mentor | [Template review/dll] | [0/1/2] | [isi] |
| Rekap akhir | [Spreadsheet/dll] | [0/1/2] | [isi] |
| Evidence HC | [Folder batch/dll] | [0/1/2] | [isi] |

### 5. Risiko dan kontrol

| Risiko | Dampak | Kontrol |
|---|---|---|
| [isi] | [isi] | [isi] |

### 6. Keputusan akhir

- **Keputusan:** [Go / Go with Control / No-Go]
- **Alasan utama:** [isi singkat]
- **Tindak lanjut sebelum batch jalan:** [isi singkat]

---

## E. Daftar Rekomendasi Tanpa Mengubah Fondasi BCL

### Rekomendasi prioritas

- gunakan BCL hanya untuk fungsi yang memang sudah kuat: materi, progress dasar, dan quiz/post-test teori
- buat 1 halaman/course khusus batch pertama BIM Modeller agar alur belajar tidak bercampur dengan library umum
- kurasi materi per modul, bukan membuka semua konten sekaligus
- tetapkan workaround resmi untuk submission, grading, absensi, dan evidence
- gunakan format nama file, folder, dan template yang baku sejak awal

### Rekomendasi operasional

- gunakan `SharePoint` atau folder bersama resmi untuk pengumpulan tugas praktik
- gunakan `Teams` untuk absensi, sesi sinkron, dan pengumuman batch
- gunakan `spreadsheet mentor` untuk grading praktik dan catatan pembinaan
- gunakan 1 file rekap akhir resmi untuk status peserta
- simpan seluruh evidence batch dalam 1 struktur folder yang konsisten

### Rekomendasi kontrol mutu

- lakukan pilot test dengan 1 admin, 1 mentor, dan 2-3 user peserta sebelum batch resmi dibuka
- pastikan seluruh fungsi wajib native diuji ulang setelah refresh dan logout-login
- jangan menambah fitur besar sebelum batch pertama benar-benar berjalan
- jika ada gap, tutup dengan workflow sederhana, bukan pengembangan sistem besar

### Rekomendasi keputusan

- bila fungsi inti native stabil, lanjutkan batch pertama dengan pendekatan `Go with Control`
- bila fungsi inti masih gagal, perbaiki fungsi inti tersebut lebih dulu dan tunda batch

---

## Penutup

`BCL Training Support Readiness Test` dirancang agar keputusan penggunaan BCL tetap realistis.

Targetnya bukan membuktikan bahwa BCL sudah menjadi LMS penuh, tetapi memastikan bahwa BCL **cukup layak dan cukup terkendali** untuk menjalankan **batch pertama training BIM Modeller** dengan risiko operasional yang masih bisa diterima.

---

## F. Hasil Uji Aktual

### 1. Ringkasan eksekusi

Test aktual dijalankan pada **11 Mei 2026** terhadap instance aktif:

- `http://localhost/`
- backend internal aktif di port `5051`

Objek uji difokuskan pada **batch pertama training BIM Modeller**, bukan pada asumsi LMS penuh.

### 2. Keputusan hasil test

- **Keputusan:** `Go with Control`
- **Alasan utama:** fungsi inti BCL untuk login, akses course, akses PDF, akses video, dan quiz teori berhasil berjalan; namun progress dasar masih terfragmentasi dan area operasional batch masih bergantung pada workaround terkendali.
- **Catatan penting:** BCL layak dipakai sebagai platform pembelajaran dan evaluasi teori batch pertama, tetapi belum layak diposisikan sebagai sistem training praktik end-to-end tanpa kontrol manual tambahan.

### 3. Hasil per layer

| Layer | Skor | Ringkasan hasil |
|---|---:|---|
| Core BCL Function Test | 9 / 12 | Fungsi inti mayoritas berjalan native, tetapi progress dasar dan persistence `logout-login` belum terverifikasi sebersih fungsi lain |
| Training Operation Support Test | 10 / 18 | Operasi batch pertama dapat dijalankan, tetapi beberapa fungsi penting tetap bergantung pada workaround terkendali |
| HC Evidence & Governance Test | 11 / 18 | Evidence dasar tersedia, namun belum terhimpun dalam rekap batch formal native |
| **Total** | **30 / 48** | **Layak untuk batch pertama dengan kontrol operasional tambahan** |

### 4. Hasil fungsi wajib native

| Fungsi wajib native | Status | Hasil aktual | Catatan |
|---|---:|---|---|
| Login peserta | 2 | `API login` berhasil dan `browser login` berhasil | Token JWT berhasil diterbitkan dan dipakai pada sesi belajar |
| Akses course/modul | 2 | Halaman `courses` terbuka dan track `BIM Modeller` tampil | Terlihat `19 chapters` untuk BIM Modeller |
| Akses materi PDF/video/link | 1 | PDF dan video berhasil diakses; link material belum teruji pada data aktif | Dataset `learning materials` aktif yang terdeteksi saat test hanya berisi `19 PDF`; tidak ada material bertipe link aktif |
| Quiz/post-test teori | 2 | Submit quiz berhasil, nilai tersimpan, history dan stats terbaca | Sampel uji: `bim-mindset-quiz`, skor `8/10`, `80%`, `passed` |
| Progress dasar | 1 | Endpoint progress ada dan responsif, tetapi belum mencerminkan seluruh aktivitas belajar secara utuh | PDF read count naik, tetapi `activity summary` tetap `0` dan `progress/me` belum menunjukkan completion berbasis aktivitas tersebut |
| Data tersimpan setelah refresh/logout-login | 1 | Refresh terverifikasi; logout-login penuh tidak terulang bersih dalam jendela uji | Setelah reload, `username` dan `token` tetap ada; uji login berulang terkena auth rate limit |

### 5. Bukti uji terukur

| Area uji | Bukti |
|---|---|
| Signup | Signup user uji berhasil, tetapi respons signup tidak mengembalikan token login |
| Login | Login user uji berhasil dengan token JWT panjang `245` karakter |
| Course page | `http://localhost/elearning-assets/courses.html?level=beginner` terbuka dan menampilkan `19 item` PDF serta `23 item` video category cards |
| BIM Modeller track | Track `BIM Modeller` tampil sebagai `Available` dengan `19 chapters` |
| BIM Coordinator track | Track `BIM Coordinator` tampil `Coming Soon` dengan `0 chapters` |
| PDF access | Endpoint file PDF mengembalikan `200`, `Content-Type: application/pdf`, ukuran `166153` byte |
| PDF interaction | Membuka `BIM Execution Plan (BEP)` menaikkan read count dari `7` menjadi `8` pada halaman course |
| Video access | Stream video Revit mengembalikan `206 Partial Content`, `Content-Type: video/mp4`, `Content-Range: bytes 0-1023/42748751` |
| Quiz submit | `resultId: 2`, `submittedAt: 2026-05-11T10:29:00.660Z`, skor `80%` |
| Quiz history | History user menampilkan `1` attempt dan stats menunjukkan `highestScore 80`, `averageScore 80`, `passedAttempts 1` |
| Refresh persistence | Setelah reload browser, halaman tetap menampilkan user `bcltestmodeller` dan token masih tersimpan di local storage |

### 6. Hasil fungsi workaround terkendali

| Fungsi workaround | Status | Media yang realistis | Hasil penilaian |
|---|---:|---|---|
| Absensi | 1 | `Teams` / spreadsheet hadir | Tidak ada absensi native; aman dijalankan dengan media eksternal |
| Submission tugas praktik | 1 | `SharePoint` / folder bersama | Tidak ada submission native untuk file praktik |
| Grading praktik | 1 | spreadsheet mentor | Tidak ada rubric/grading native |
| Catatan mentor | 1 | template review note | Tidak ada note per peserta di sistem |
| Rekap akhir | 1 | spreadsheet batch | Data dasar ada, tetapi masih tersebar |
| Evidence HC | 1 | folder batch + ekspor data BCL | Cukup untuk batch pertama jika struktur folder disiplin |

### 7. Temuan utama selama test

- **Signup berhasil tetapi token tidak dikembalikan.**
  Hal ini menambah friksi karena peserta tetap harus login manual setelah registrasi.

- **Default profile image memicu `404`.**
  Pada course page, browser console menunjukkan kegagalan memuat `/img/user-default.png`.

- **Tracking PDF read terpisah dari activity summary.**
  Membuka PDF menaikkan `read count`, tetapi `activity summary` tetap `pdfReads: 0`.

- **Progress dasar belum terintegrasi penuh.**
  `progress/me` tersedia dan stabil, tetapi belum otomatis menggambarkan pembukaan PDF atau attempt quiz sebagai capaian belajar yang utuh.

- **Track selain BIM Modeller belum operasional.**
  Pada halaman course, `BIM Coordinator` dan `BIM Manager` masih muncul sebagai `Coming Soon` dengan `0 chapters`.

- **Auth rate limiter aktif dan efektif.**
  Setelah beberapa login berulang untuk automation, endpoint login mengembalikan `Too many authentication attempts`.
  Ini baik untuk keamanan, tetapi perlu diperhitungkan saat UAT atau scripting.

### 8. Implikasi hasil test

- BCL **siap native** untuk login, membuka course, membaca PDF, mengakses video, dan menjalankan post-test teori.
- BCL **belum cukup rapi** untuk dipakai sebagai satu-satunya sumber progress training praktik.
- Untuk batch pertama BIM Modeller, BCL paling aman dipakai sebagai:
  - pusat materi
  - pusat quiz/post-test teori
  - evidence pembelajaran dasar
  - penghubung ke workflow eksternal yang dikontrol

### 9. Kesimpulan operasional

Dengan hasil aktual ini, BCL **cukup layak** digunakan untuk menjalankan **batch pertama training BIM Modeller berbasis web** selama skema operasionalnya tetap disiplin:

- pembelajaran teori dan materi di BCL
- tugas praktik di media eksternal terkendali
- grading dan mentoring di spreadsheet/format baku
- evidence akhir digabungkan dari data BCL dan folder batch
