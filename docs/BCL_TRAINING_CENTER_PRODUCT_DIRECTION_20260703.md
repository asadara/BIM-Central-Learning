# BCL Training Center Product Direction

Tanggal: 3 Juli 2026  
Tujuan dokumen: menurunkan hasil perbandingan platform menjadi arah produk dan prinsip enhancement BCL Training Center.

## 1. Product Positioning

BCL Training Center bukan platform kelas generik. BCL harus diposisikan sebagai:

**BIM Learning, Evidence, and Competency Center untuk kebutuhan internal BCL/NKE.**

Artinya, BCL tidak sekadar menjadi tempat upload materi atau tempat quiz. BCL harus menjadi pusat siklus training BIM:

- peserta belajar materi yang sesuai role;
- peserta membuktikan pemahaman teori;
- peserta mengerjakan praktik;
- mentor memberi review dan feedback;
- progress dan kompetensi tercatat;
- HC/Engineering mendapatkan evidence yang bisa diaudit;
- organisasi dapat melihat kesiapan orang terhadap role BIM tertentu.

Platform lain seperti Google Classroom, Moodle, Teams, SharePoint, atau LMS lain boleh menjadi referensi, tetapi bukan identitas BCL. Yang diambil adalah pola kerja yang berguna, bukan bentuk produknya.

## 2. Product Vision

Visi BCL Training Center:

**Menjadi platform internal yang mengubah pembelajaran BIM dari kumpulan materi dan training manual menjadi sistem pengembangan kompetensi yang terstruktur, terbukti, dan relevan dengan kebutuhan proyek.**

Kalimat ini punya konsekuensi langsung:

- BCL harus menghubungkan learning path dengan kompetensi role.
- BCL harus mencatat evidence, bukan hanya aktivitas.
- BCL harus mendukung mentor/reviewer, bukan hanya peserta.
- BCL harus menghasilkan rekap yang berguna untuk HC/Engineering.
- BCL harus berkembang sesuai workflow BIM internal, bukan mengikuti pola sekolah umum secara mentah.

## 3. Product Mission

Misi BCL Training Center:

1. Menyediakan jalur belajar BIM yang jelas untuk BIM Modeller, BIM Coordinator, BIM Manager, dan role lanjutan.
2. Mengelola materi internal dalam bentuk PDF, video, library, quiz, exam, practice task, dan project-based evidence.
3. Mencatat progress belajar yang dapat dipercaya.
4. Menyediakan mekanisme review praktik oleh mentor.
5. Menghasilkan competency record dan certificate yang relevan dengan kebutuhan internal.
6. Mengurangi ketergantungan pada spreadsheet, folder manual, dan rekap terpisah.
7. Menjadi sumber data training yang dapat dipakai untuk keputusan operasional dan pengembangan talent.

## 4. Prinsip Enhancement

### 4.1 Adopt Useful Patterns, Not Platform Identity

BCL boleh mengadopsi pola dari Google Classroom:

- batch/class;
- roster;
- assignment;
- due date;
- submission;
- grading;
- rubric;
- feedback;
- gradebook;
- export evidence.

Namun istilah, alur, dan UI harus tetap disesuaikan dengan konteks BCL. Contoh:

- `Class` lebih tepat menjadi `Training Batch`.
- `Classwork` lebih tepat menjadi `Training Plan` atau `Batch Work`.
- `Student` lebih tepat menjadi `Participant`.
- `Teacher` lebih tepat menjadi `Mentor` atau `Reviewer`.
- `Gradebook` lebih tepat menjadi `Batch Evaluation`.
- `Assignment` untuk konteks praktik bisa menjadi `Practice Task`.

### 4.2 Competency-Driven, Not Content-Driven

BCL tidak boleh berhenti pada logika "peserta sudah membuka materi". Tujuan akhirnya adalah kesiapan kompetensi.

Progress sebaiknya dibaca sebagai kombinasi:

- materi dibuka;
- materi diselesaikan;
- quiz/practice attempts;
- nilai teori;
- submission praktik;
- review mentor;
- rubric score;
- certificate;
- final readiness.

Membaca PDF atau menonton video adalah aktivitas. Lulus post-test, menyelesaikan tugas praktik, dan mendapat review mentor adalah evidence.

### 4.3 Evidence-First

Setiap enhancement harus menjawab pertanyaan:

**Apakah fitur ini menghasilkan evidence training yang lebih jelas, lebih mudah ditelusuri, dan lebih berguna untuk keputusan?**

Evidence minimal untuk satu batch:

- daftar peserta;
- jadwal;
- learning path;
- materi yang digunakan;
- aktivitas belajar;
- quiz/exam result;
- submission praktik;
- rubric score;
- feedback mentor;
- attendance;
- final status;
- certificate.

### 4.4 Mentor-Centered Workflow

BCL tidak hanya melayani peserta. Mentor adalah aktor utama dalam training praktik.

Fitur yang baik harus membantu mentor:

- melihat siapa yang belum belajar;
- melihat siapa yang belum submit;
- melihat siapa yang skornya rendah;
- membuka submission dengan cepat;
- memberi feedback konsisten;
- memakai rubric yang sama antar peserta;
- menghasilkan rekap tanpa kerja manual berulang.

Jika fitur membuat mentor tetap harus membuat spreadsheet paralel, fitur itu belum selesai.

### 4.5 Internal Workflow Aware

BCL harus menerima kenyataan bahwa workflow internal memakai banyak kanal:

- Teams untuk meeting/komunikasi;
- SharePoint atau folder network untuk file tertentu;
- BCL untuk materi, tracking, evidence, dan rekap;
- HC/Engineering untuk keputusan training dan kompetensi.

Targetnya bukan memaksa semuanya masuk BCL sejak awal. Targetnya adalah BCL menjadi pusat rekam dan kontrol.

Contoh pendekatan realistis:

- file besar boleh tetap di SharePoint;
- BCL menyimpan link, metadata, status submit, reviewer, rubric, dan final evidence;
- batch report tetap ditarik dari BCL.

### 4.6 Simple First, Mature Later

Setiap fitur besar harus dimulai dari versi sederhana yang operasional:

- Batch dulu sebelum automation kompleks.
- Submission dulu sebelum plagiarism/originality check.
- Gradebook read-only dulu sebelum gradebook editable penuh.
- Rubric sederhana dulu sebelum advanced weighting.
- Export CSV dulu sebelum PDF evidence package.

Prinsipnya: hilangkan workaround paling menyakitkan lebih dulu.

## 5. Target Product Maturity

### Stage 0 - Repository and Theory Center

Kondisi saat ini.

BCL berfungsi sebagai:

- pusat materi;
- course browser;
- quiz/post-test;
- progress dasar;
- certificate dasar;
- competency mapping awal.

Status: **Go with Control**.

Keterbatasan:

- praktik training masih banyak workaround;
- batch belum native;
- submission dan grading praktik belum native;
- rekap akhir belum otomatis.

### Stage 1 - Structured Training Batch

Target enhancement pertama.

BCL harus bisa mengelola:

- training batch;
- roster peserta;
- mentor/reviewer;
- training plan;
- materi per sesi/topik;
- quiz/exam yang terhubung ke batch.

Status target: **BCL dapat menjalankan batch training secara terstruktur.**

### Stage 2 - Practice Evidence Center

Target berikutnya.

BCL harus bisa mengelola:

- practice task;
- due date;
- submission;
- status missing/late/submitted;
- attachment/link evidence;
- riwayat submission.

Status target: **BCL tidak lagi bergantung penuh pada folder dan spreadsheet untuk tugas praktik.**

### Stage 3 - Mentor Review and Evaluation Center

BCL harus bisa mengelola:

- rubric;
- score praktik;
- feedback mentor;
- returned/revision status;
- gradebook batch;
- final status peserta.

Status target: **Mentor dapat menilai dan merekap batch langsung dari BCL.**

### Stage 4 - HC/Engineering Evidence System

BCL harus bisa menghasilkan:

- export rekap batch;
- evidence package;
- certificate status;
- competency record;
- audit trail training.

Status target: **BCL menjadi sumber utama evidence training internal.**

### Stage 5 - Intelligence and Readiness System

BCL berkembang menjadi sistem insight:

- peserta at-risk;
- skill gap;
- rekomendasi learning path;
- readiness menuju role;
- trend kualitas training;
- dashboard kompetensi organisasi.

Status target: **BCL membantu pengambilan keputusan pengembangan talent BIM.**

## 6. Product Pillars

### Pillar 1 - Learning Path

BCL harus punya jalur belajar yang jelas dan bertingkat:

- BIM Modeller;
- BIM Coordinator;
- BIM Manager;
- software-specific track;
- governance track;
- delivery workflow track;
- project-based capability track.

Enhancement harus menjaga hubungan antara materi, practice, exam, dan competency outcome.

### Pillar 2 - Training Batch

Training harus punya konteks operasional:

- batch;
- periode;
- peserta;
- mentor;
- topic/session;
- assignment;
- due date;
- attendance;
- final evaluation.

Tanpa batch, data learning akan tetap terfragmentasi.

### Pillar 3 - Practice and Review

BIM training tidak cukup dengan teori. BCL harus mendukung evidence praktik:

- file model;
- drawing output;
- checklist quality;
- BEP/template exercise;
- clash/coordination task;
- review note;
- rubric.

Inilah area yang membuat BCL berbeda dari LMS umum.

### Pillar 4 - Competency Record

Semua aktivitas penting harus bermuara pada competency record:

- skor teori;
- skor praktik;
- attempts;
- certificate;
- readiness;
- role fit;
- gap.

Competency record harus lebih penting daripada sekadar course completion.

### Pillar 5 - Governance and Evidence

BCL harus mendukung kebutuhan audit internal:

- siapa ikut batch apa;
- materi apa yang dipakai;
- tugas apa yang dikumpulkan;
- siapa yang mereview;
- kriteria apa yang dipakai;
- kapan peserta dinyatakan lulus;
- evidence apa yang mendukung keputusan.

## 7. Enhancement Guardrails

Setiap ide fitur baru harus diuji dengan pertanyaan berikut:

1. Apakah fitur ini memperkuat training BIM internal?
2. Apakah fitur ini mengurangi workaround manual?
3. Apakah fitur ini menghasilkan evidence yang lebih baik?
4. Apakah fitur ini membantu peserta, mentor, admin, atau HC mengambil keputusan?
5. Apakah fitur ini selaras dengan learning path dan competency model BCL?
6. Apakah fitur ini bisa dimulai sederhana tanpa menunggu sistem besar sempurna?
7. Apakah fitur ini membuat BCL makin khas, bukan makin generik?

Jika jawabannya banyak yang "tidak", fitur sebaiknya ditunda.

## 8. Terminologi Produk Yang Disarankan

| Istilah generik/LMS | Istilah BCL yang disarankan | Alasan |
|---|---|---|
| Class | Training Batch | Lebih sesuai training internal |
| Student | Participant | Lebih profesional untuk karyawan/peserta internal |
| Teacher | Mentor | Lebih sesuai training praktik |
| Co-teacher | Reviewer | Cocok untuk evaluasi teknis |
| Classwork | Training Plan | Menunjukkan struktur kegiatan batch |
| Assignment | Practice Task | Lebih sesuai BIM/project-based exercise |
| Gradebook | Batch Evaluation | Tidak hanya nilai, tapi status readiness |
| Grade | Score / Evaluation Result | Lebih fleksibel untuk teori dan praktik |
| Rubric | Review Criteria | Lebih mudah dipahami mentor teknis |
| Guardian summary | Tidak diprioritaskan | Tidak relevan untuk training internal |

## 9. North Star Metrics

Ukuran keberhasilan enhancement BCL sebaiknya bukan jumlah fitur. Gunakan metrik yang terkait outcome.

### Training Operation Metrics

- Persentase batch yang berjalan tanpa spreadsheet rekap utama.
- Waktu admin untuk membuat batch baru.
- Waktu mentor untuk merekap hasil akhir.
- Jumlah submission praktik yang tercatat native di BCL.

### Learning and Competency Metrics

- Persentase peserta yang menyelesaikan learning path.
- Persentase peserta yang lulus post-test teori.
- Persentase peserta yang menyelesaikan practice task.
- Average rubric score per competency.
- Jumlah peserta yang mencapai readiness per role.

### Evidence Metrics

- Persentase peserta dengan evidence lengkap.
- Jumlah batch yang bisa diexport evidence pack-nya.
- Jumlah keputusan lulus/tidak lulus yang punya dasar data lengkap.

### Adoption Metrics

- Jumlah mentor aktif.
- Jumlah feedback mentor yang diberikan di BCL.
- Jumlah peserta yang membuka halaman My Training.
- Jumlah batch yang memakai Training Plan native.

## 10. Recommended Enhancement Sequence

Urutan ini menjaga arah BCL tetap jelas:

1. **Batch foundation**
   Buat training batch, roster, mentor, peserta, periode, dan status.

2. **Training plan**
   Hubungkan materi, quiz, exam, meeting, dan practice task ke batch.

3. **Participant to-do**
   Tampilkan apa yang harus dipelajari, dikerjakan, dikumpulkan, dan deadline-nya.

4. **Practice submission**
   Peserta submit evidence praktik lewat upload atau link.

5. **Mentor review**
   Mentor review submission, beri feedback, dan set status.

6. **Review criteria/rubric**
   Standardisasi penilaian praktik.

7. **Batch evaluation**
   Gabungkan teori, praktik, progress, attendance, dan certificate.

8. **Evidence export**
   Export untuk HC/Engineering.

9. **At-risk and readiness dashboard**
   Tampilkan peserta yang perlu intervensi dan readiness menuju role.

10. **Automation and intelligence**
   Rekomendasi learning path, skill gap, reminder, dan insight lanjutan.

## 11. Product Principles Per Role

### Untuk Participant

BCL harus menjawab:

- Saya ikut batch apa?
- Saya harus belajar apa?
- Saya harus mengumpulkan apa?
- Deadline saya kapan?
- Nilai dan feedback saya apa?
- Saya sudah siap untuk level/role berikutnya atau belum?

### Untuk Mentor/Reviewer

BCL harus menjawab:

- Siapa peserta batch saya?
- Siapa yang belum belajar?
- Siapa yang belum submit?
- Siapa yang butuh bantuan?
- Submission mana yang harus saya review?
- Bagaimana saya memberi feedback konsisten?
- Bagaimana saya membuat keputusan lulus/tidak lulus dengan data cukup?

### Untuk Admin Training

BCL harus menjawab:

- Bagaimana membuat batch dengan cepat?
- Bagaimana assign peserta dan mentor?
- Bagaimana memastikan training plan siap?
- Bagaimana memonitor batch berjalan?
- Bagaimana menarik rekap akhir?

### Untuk HC/Engineering

BCL harus menjawab:

- Siapa sudah mengikuti training?
- Siapa lulus?
- Evidence-nya apa?
- Kompetensi apa yang sudah terbentuk?
- Gap kompetensi apa yang masih ada?
- Data apa yang bisa dipakai untuk penempatan atau pengembangan?

## 12. Keputusan Strategis

Keputusan strategis yang disarankan:

1. BCL dikembangkan sebagai platform internal berbasis kompetensi BIM, bukan LMS generik.
2. Fitur classroom-style dipakai untuk memperkuat operasional batch, bukan mengubah identitas BCL.
3. Roadmap harus memprioritaskan penghapusan workaround pada praktik training.
4. Source of truth fitur training baru harus bergerak ke PostgreSQL.
5. LocalStorage dan JSON file boleh tetap dipakai untuk legacy/config ringan, tetapi bukan fondasi fitur audit/evidence.
6. UI harus memakai bahasa BCL: training batch, participant, mentor, practice task, review criteria, batch evaluation.
7. Setiap enhancement harus bisa ditelusuri ke evidence, competency, atau operational control.

## 13. One-Sentence Direction

**BCL Training Center harus berkembang dari platform materi dan quiz menjadi sistem pengembangan kompetensi BIM yang mengelola batch, praktik, review mentor, evidence, dan readiness role secara end-to-end.**
