# Report Perbandingan Google Classroom vs BCL Training Center

Tanggal review: 3 Juli 2026  
Scope: review konseptual Google Classroom dan review implementasi training/e-learning pada repository BCL lokal.

## 1. Ringkasan Eksekutif

BCL Training Center saat ini sudah cukup kuat sebagai platform pembelajaran internal BIM: menyajikan materi PDF/video, learning path berbasis level BIM, quiz/post-test teori, attempt history, activity tracking, dashboard progress, competency mapping, dan sertifikat dasar. Berdasarkan dokumen readiness internal, BCL sudah dinilai `Go with Control` untuk batch pertama training BIM Modeller: layak dipakai untuk pembelajaran teori dan evidence dasar, tetapi belum layak diposisikan sebagai LMS praktik end-to-end tanpa kontrol manual tambahan.

Google Classroom unggul pada operasi kelas yang terstruktur: kelas/batch, roster, stream announcement, classwork dengan assignment/question/quiz/material, due date, status submission, gradebook, rubric, feedback, comment bank, guardian/email flow, dan ekspor data kelas. Fitur ini bukan semuanya perlu ditiru mentah-mentah. Yang paling bernilai untuk BCL adalah pola operasionalnya: semua aktivitas training berada dalam satu konteks kelas/batch yang punya peserta, mentor, materi, tugas, due date, submission, grading, feedback, dan rekap.

Rekomendasi utama: jangan mengubah BCL menjadi duplikat Google Classroom. Jadikan BCL sebagai "BIM Training Center" yang mengadopsi fitur classroom-style pada area yang sekarang masih workaround: batch/class management, assignment praktik, submission evidence, rubric grading, feedback mentor, batch gradebook, dan export evidence untuk HC/Engineering.

## 2. Sumber Review

### Referensi Google Classroom

- Google Classroom Help - teacher flow: class, stream, classwork, people, grades, assignments, rubrics, originality reports, grading, calendar, Meet, gradebook.  
  https://support.google.com/edu/classroom/answer/9582854?co=GENIE.Platform%3DDesktop&hl=en
- Google Classroom Help - student classwork/to-do: upcoming work, missing work, done work, due dates, grades, filters.  
  https://support.google.com/edu/classroom/answer/6020284?co=GENIE.Platform%3DDesktop&hl=en
- Google Classroom Help - practice sets: interactive assignments, auto-grade, insight for concepts and students needing support.  
  https://support.google.com/edu/classroom/answer/13455950?hl=en
- Google Classroom Help - marking, feedback, submissions, status, comment bank, private comments, originality reports.  
  https://support.google.com/edu/classroom/answer/16643267?hl=en-IN
- Google Classroom Help - export data: class info, people, classwork, submissions, grades, comments, rubric scores, practice sets, video activities.  
  https://support.google.com/edu/classroom/answer/10204459?hl=en

### Referensi BCL Lokal

- `BCL_TRAINING_SUPPORT_READINESS_TEST.md`
- `backend/elearning/learning-paths.json`
- `backend/create-tables.sql`
- `backend/elearning/routes/activityRoutes.js`
- `backend/elearning/routes/progressRoutes.js`
- `backend/elearning/controllers/quizController.js`
- `backend/elearning/controllers/certificateController.js`
- `backend/routes/competencyRoutes.js`
- `backend/routes/courseAdminRoutes.js`
- `backend/routes/learningMaterialsAdmin.js`
- `backend/routes/examMaterialsAdmin.js`
- `backend/routes/messages.js`
- `BC-Learning-Main/elearning-assets/js/courses.js`
- `BC-Learning-Main/elearning-assets/js/dashboard.js`
- `BC-Learning-Main/elearning-assets/js/exams.js`

## 3. Skema Training BCL Saat Ini

### 3.1 Model Pembelajaran

BCL memakai skema learning path berbasis level dan kompetensi BIM. Data `backend/elearning/learning-paths.json` menunjukkan jalur utama:

| Learning path | Level target | Karakter |
|---|---|---|
| BIM Mindset Foundation | BIM Modeller | Konsep BIM sebagai manajemen informasi, bukan hanya 3D/software |
| BIM Governance Foundation | BIM Coordinator | Authority, responsibility, decision gate, quality gate, audit trail |
| BIM Delivery Workflow Foundation | BIM Coordinator | Alur delivery informasi BIM dari kebutuhan sampai penggunaan proyek |
| AutoCAD Certified User | BIM Modeller | Software drafting 2D, editing, annotation, plotting |
| Revit Architecture Professional | BIM Coordinator | Revit fundamentals, modelling, intermediate modelling, quality control |
| BIM Manager Certification | BIM Manager | Strategi implementasi BIM, koordinasi lintas tim, leadership, quality |

Setiap learning path dapat memiliki:

- `modules`: materi, outcome, dan urutan belajar.
- `practice`: kategori latihan, minimum attempts, minimum average score.
- `exam`: exam id, exam title, passing score.
- `readiness`: prasyarat level, kategori target, akurasi minimum, attempts minimum, coverage target.
- `certificate`: judul sertifikat dan masa berlaku.

Ini adalah kelebihan penting BCL dibanding Google Classroom generik: BCL sudah domain-specific untuk BIM, punya struktur skill/role, dan dapat diarahkan ke competency mapping internal.

### 3.2 Fitur Native Yang Sudah Ada

| Area | Status BCL saat ini | Evidence implementasi |
|---|---|---|
| Login dan user profile | Ada | Tabel `users`, auth routes, token auth |
| Course/material browser | Ada | `courses.html`, `courses.js`, learning materials routes |
| Materi PDF/video | Ada | `learning_materials`, `pdf_material_reads`, BIM media routes |
| Learning path | Ada | `learning-paths.json`, `moduleRoutes`, `learningPathService` |
| Quiz/practice/exam attempts | Ada dan sudah PostgreSQL | `learning_attempts`, `quizController` |
| Certificate | Ada | `user_certificates`, `certificateController` |
| Progress dashboard | Ada, tetapi belum sepenuhnya menyatu | `user_progress`, `progressRoutes`, `dashboard.js` |
| Activity events | Ada | `learning_activity_events`, `/api/elearning/activity/track`, `/summary` |
| Competency mapping | Ada | `competencyRoutes`, scoring dari attempts, progress, certificate |
| Admin material/course management | Ada | `courseAdminRoutes`, `learningMaterialsAdmin`, `examMaterialsAdmin` |
| User-admin messages | Ada, tetapi belum class-scoped | `messages.js` |

### 3.3 Kelebihan BCL

1. Domain BIM lebih kuat daripada Google Classroom.
   BCL sudah punya level BIM Modeller, Coordinator, Manager; materi BIM Mindset, Governance, Delivery Workflow; dan competency score yang relevan dengan kebutuhan internal.

2. Evidence internal lebih mudah diarahkan ke HC/Engineering.
   BCL punya ownership data sendiri, tabel attempts/certificates/progress, dan bisa menyesuaikan format report internal tanpa bergantung pada struktur Google.

3. Materi teknis internal bisa dikelola sebagai knowledge center.
   BCL tidak hanya kelas; ada library, BIM media, PDF, tutorial, project content, dan mapping kompetensi.

4. Sertifikasi internal bisa dibuat kontekstual.
   Sertifikat BCL dapat mengikuti jalur role, passing score, readiness, dan validitas kompetensi internal.

5. Platform bisa disesuaikan dengan workflow NKE/BCL.
   Google Classroom bagus untuk sekolah/universitas, tetapi BCL bisa dibuat lebih pas untuk training BIM berbasis proyek, reviewer, evidence pekerjaan praktik, dan audit internal.

### 3.4 Kelemahan Operasional Saat Ini

Berdasarkan readiness test internal, BCL belum menjadi LMS penuh. Celah yang paling penting:

- Belum ada entitas `class` atau `batch` yang mengikat peserta, mentor, jadwal, materi, tugas, dan hasil.
- Progress dasar masih terfragmentasi antara `user_progress`, activity events, quiz attempts, localStorage marker, dan read count.
- Belum ada assignment/submission praktik native.
- Belum ada due date, status `assigned/submitted/missing/graded/returned`.
- Belum ada rubric grading praktik native.
- Belum ada feedback mentor yang melekat ke submission.
- Belum ada gradebook per batch.
- Absensi, tugas praktik, grading praktik, catatan mentor, dan rekap akhir masih memakai workaround.
- Message/inbox sudah ada, tetapi belum terhubung ke konteks kelas, tugas, atau submission.
- Data course/admin masih campuran PostgreSQL, JSON file, dan localStorage sehingga perlu normalisasi sebelum fitur kelas dibangun besar.

## 4. Perbandingan Google Classroom vs BCL Training Center

| Dimensi | Google Classroom | BCL Training Center saat ini | Gap BCL | Rekomendasi adopsi |
|---|---|---|---|---|
| Kelas/batch | Class card, class settings, class code, roster | Belum ada batch/class formal | Tinggi | Buat `training_batches` dan `batch_members` |
| Roster peserta | People page untuk teacher, co-teacher, student, guardian/email | User ada, tapi belum class-scoped | Tinggi | Buat roster per batch dengan role peserta, mentor, reviewer, HC observer |
| Stream komunikasi | Announcement dan post/comment permission | Message user-admin ada, belum stream kelas | Sedang | Buat announcement per batch dan notifikasi peserta |
| Materi kelas | Classwork materials, topics | Materi PDF/video/course sudah ada | Rendah | Hubungkan materi existing ke batch/module/topic |
| Assignment | Assignment, question, quiz assignment, due date, status | Quiz ada; assignment praktik belum native | Tinggi | Buat assignment praktik dan teori dengan due date |
| Submission | Student work, attachments, status handed in/missing/returned | Tidak native untuk tugas praktik | Tinggi | Buat upload/link submission dan status lifecycle |
| Quiz/practice | Quiz assignment, practice sets, Forms integration | Quiz/practice/exam sudah cukup kuat | Rendah-sedang | Pertahankan engine BCL, tambahkan classwork linkage |
| Auto insight | Practice sets memberi insight konsep dan siswa butuh support | Quiz stats dan competency mapping ada | Sedang | Tambah analytics per batch, kategori lemah, peserta at-risk |
| Gradebook | Grades page dan download grades | Dashboard user ada; gradebook batch belum ada | Tinggi | Buat gradebook batch: teori, praktik, progress, attendance |
| Rubric | Rubric assignment dan rubric scores | Belum native | Tinggi | Buat rubric template dan scoring per submission |
| Feedback | Personalized feedback, comment bank, private comment | Message umum ada, feedback submission belum ada | Tinggi | Buat feedback thread per submission dan comment bank mentor |
| Due/missing work | To-do, assigned, missing, done, late | Belum ada | Tinggi | Buat work status dan deadline engine |
| Calendar/meeting | Calendar dan Meet link | Belum terlihat native | Sedang | Tambah jadwal batch dan link Teams/Meet sebagai field |
| Export evidence | Export class info, people, classwork, submissions, grades, comments, rubrics | Evidence tersebar; rekap akhir workaround | Tinggi | Buat export batch evidence CSV/Excel/ZIP/PDF |
| Guardian/parent | Guardian summaries | Tidak relevan langsung untuk training internal | Rendah | Tidak perlu prioritas |
| Originality report | Ada untuk dokumen teks | Belum ada | Rendah-sedang | Tidak prioritas kecuali tugas tertulis sering dipakai |

## 5. Fitur Google Classroom Yang Paling Berguna Untuk Diadopsi

Prioritas adopsi sebaiknya berbasis masalah operasional BCL saat ini, bukan sekadar menambah fitur.

### P0 - Wajib Untuk Mengurangi Workaround

1. Training batch/class
   Satu batch harus punya nama, program, periode, mentor, peserta, status, schedule, dan linked learning path.

2. Classwork module
   Satu tempat untuk menaruh materi, quiz, tugas praktik, link meeting, dan instruksi per sesi/topik.

3. Assignment praktik dan submission
   Tugas praktik perlu punya due date, instruksi, file referensi, rubrik, submission attachment/link, status, dan riwayat submit.

4. Gradebook batch
   Mentor/Admin butuh satu layar untuk melihat nilai teori, nilai praktik, status submission, progress materi, dan final status.

5. Rubric grading dan feedback
   Ini langsung menggantikan spreadsheet mentor. Rubric harus mendukung kriteria, bobot, skor, catatan, dan status returned.

6. Export evidence
   HC/Engineering perlu export rekap final, detail nilai, daftar peserta, submission, komentar mentor, dan certificate.

### P1 - Penting Setelah P0 Stabil

1. To-do peserta
   Peserta melihat assigned, due soon, missing, submitted, returned, dan score.

2. Announcement stream per batch
   Mentor dapat mengumumkan perubahan jadwal, reminder submission, atau catatan umum.

3. Comment bank mentor
   Bank komentar untuk feedback yang sering dipakai, misalnya "cek naming convention", "koordinat belum konsisten", "LOD belum sesuai brief".

4. At-risk dashboard
   Dashboard mentor menandai peserta yang belum submit, skor rendah, belum membuka materi, atau belum mencapai minimum attempts.

5. Schedule dan attendance
   Absensi masih bisa dimulai sederhana: attendance event per sesi dengan status present/late/absent/excused.

### P2 - Nice To Have

1. Originality/similarity check untuk laporan tertulis.
2. Integrasi kalender penuh.
3. Integrasi email/Teams otomatis.
4. AI assistant untuk rangkum progress peserta.
5. Import/export format Google Classroom jika suatu saat ada migrasi data.

## 6. Target Arsitektur Enhancement

### 6.1 Entitas Data Baru Yang Direkomendasikan

```sql
training_batches
- id
- code
- title
- program_id / learning_path_id
- description
- start_date
- end_date
- status
- created_by
- created_at
- updated_at

batch_members
- id
- batch_id
- user_id
- role -- participant, mentor, reviewer, admin, hc_observer
- enrollment_status -- invited, active, completed, dropped
- joined_at

batch_topics
- id
- batch_id
- title
- description
- sort_order

classwork_items
- id
- batch_id
- topic_id
- type -- material, quiz, practice_assignment, exam, meeting, announcement
- title
- instructions
- linked_resource_type -- learning_material, quiz, exam, url, file
- linked_resource_id
- due_at
- points
- status -- draft, published, archived

assignment_submissions
- id
- classwork_item_id
- user_id
- status -- assigned, submitted, late, graded, returned, missing
- submitted_at
- returned_at
- score
- feedback_summary
- metadata

submission_files
- id
- submission_id
- file_path / external_url
- file_name
- file_type
- uploaded_at

rubric_templates
- id
- title
- description
- created_by

rubric_criteria
- id
- rubric_template_id
- title
- description
- max_score
- weight
- sort_order

rubric_scores
- id
- submission_id
- criterion_id
- score
- comment

submission_comments
- id
- submission_id
- sender_user_id
- visibility -- private, mentor_only
- body
- created_at

attendance_sessions
- id
- batch_id
- title
- scheduled_at
- meeting_url

attendance_records
- id
- session_id
- user_id
- status -- present, late, absent, excused
- note
```

### 6.2 Integrasi Dengan Fitur Existing

- `learning_attempts` tetap menjadi sumber nilai quiz/practice/exam.
- `user_certificates` tetap menjadi sumber sertifikat.
- `learning_activity_events` tetap menjadi sumber aktivitas buka materi dan completion.
- `user_progress` sebaiknya menjadi summary hasil agregasi, bukan sumber kebenaran tunggal.
- `learning-paths.json` perlu dipertahankan sebagai seed/config awal, tetapi untuk produksi jangka panjang sebaiknya dimigrasikan ke tabel agar Admin bisa mengelola tanpa edit file.
- `messages.js` dapat dikembangkan menjadi komentar/feedback contextual, atau tetap menjadi inbox umum dan dibuat tabel baru untuk submission comments.

## 7. Roadmap Enhancement

### Phase 1 - Batch/Class Foundation

Durasi target: 1-2 sprint.

Deliverable:

- Tabel `training_batches`, `batch_members`, `batch_topics`.
- Admin UI untuk create batch, pilih learning path, assign mentor, enroll peserta.
- Halaman batch detail untuk mentor/admin.
- Halaman "My Training" untuk peserta.
- Link materi existing ke batch topic.

Acceptance criteria:

- Admin dapat membuat batch BIM Modeller.
- Peserta dapat melihat batch yang diikuti.
- Mentor dapat melihat roster peserta.
- Materi existing dapat ditampilkan per topik batch.

### Phase 2 - Classwork, Due Date, To-do

Durasi target: 1-2 sprint.

Deliverable:

- Tabel `classwork_items`.
- Tipe item: material, quiz, practice_assignment, exam, meeting.
- Due date dan publish/draft status.
- Peserta melihat to-do: assigned, due soon, missing, done.
- Link quiz existing ke classwork item.

Acceptance criteria:

- Mentor dapat publish tugas/materi ke batch.
- Peserta melihat daftar pekerjaan per batch.
- Sistem dapat menandai missing setelah due date.
- Quiz attempt dapat dikaitkan ke classwork item.

### Phase 3 - Submission Praktik dan Evidence

Durasi target: 2-3 sprint.

Deliverable:

- Tabel `assignment_submissions` dan `submission_files`.
- Upload file/link submission.
- Status assigned/submitted/late/missing/returned.
- Riwayat submit.
- Evidence viewer untuk mentor.

Acceptance criteria:

- Peserta dapat submit tugas praktik.
- Mentor dapat melihat submission per tugas dan per peserta.
- Status late/missing otomatis berdasarkan due date.
- File evidence tersimpan dengan struktur batch yang konsisten.

### Phase 4 - Rubric, Feedback, Gradebook

Durasi target: 2-3 sprint.

Deliverable:

- Rubric template dan criteria.
- Scoring per criterion.
- Feedback private per submission.
- Comment bank mentor.
- Gradebook batch yang menggabungkan quiz, practice, assignment, attendance, final score.

Acceptance criteria:

- Mentor dapat menilai tugas praktik dengan rubric.
- Peserta dapat melihat feedback returned.
- Gradebook menampilkan semua peserta dan status pekerjaan.
- Admin dapat export nilai batch.

### Phase 5 - Attendance, Reporting, HC Export

Durasi target: 1-2 sprint.

Deliverable:

- Attendance session dan records.
- Rekap batch final.
- Export CSV/Excel/PDF.
- Evidence package per batch.
- Dashboard at-risk peserta.

Acceptance criteria:

- HC/Engineering bisa menarik rekap akhir tanpa spreadsheet manual.
- Export memuat roster, jadwal, progress, nilai teori, nilai praktik, attendance, feedback summary, certificate status.
- Mentor dapat melihat peserta yang belum submit atau belum memenuhi readiness.

## 8. Backlog Prioritas

| Prioritas | Item | Dampak | Kompleksitas |
|---|---|---:|---:|
| P0 | Buat entity training batch dan roster | Sangat tinggi | Sedang |
| P0 | Classwork item dengan due date | Sangat tinggi | Sedang |
| P0 | Submission tugas praktik | Sangat tinggi | Sedang-tinggi |
| P0 | Gradebook batch | Sangat tinggi | Tinggi |
| P0 | Rubric grading | Sangat tinggi | Sedang-tinggi |
| P0 | Export evidence batch | Sangat tinggi | Sedang |
| P1 | Peserta to-do page | Tinggi | Sedang |
| P1 | Batch announcement stream | Tinggi | Sedang |
| P1 | At-risk dashboard | Tinggi | Sedang |
| P1 | Attendance native | Sedang-tinggi | Sedang |
| P1 | Comment bank mentor | Sedang | Rendah-sedang |
| P2 | Similarity/originality check | Sedang | Tinggi |
| P2 | Calendar/Teams integration | Sedang | Sedang-tinggi |

## 9. Quick Win Yang Bisa Dilakukan Lebih Dulu

1. Tambahkan field `batchId` atau `context` pada tracking quiz/activity untuk mengurangi fragmentasi progress.
2. Buat halaman admin sederhana "Training Batch BIM Modeller" yang membaca roster dari user dan menampilkan:
   - peserta
   - progress materi
   - quiz attempts
   - certificate status
   - link folder workaround untuk tugas praktik
3. Buat template export CSV dari data existing:
   - users
   - user_progress
   - learning_attempts
   - user_certificates
   - learning_activity_events
4. Buat status mapping manual sementara:
   - `theory_completed`
   - `practice_submitted_external`
   - `mentor_reviewed_external`
   - `final_status`
5. Normalisasi definisi progress:
   - `opened` tidak sama dengan `completed`
   - quiz passed dihitung sebagai theory completion
   - assignment returned/graded dihitung sebagai practice completion

Quick win ini tidak menggantikan roadmap, tetapi bisa membuat batch berikutnya jauh lebih rapi sebelum assignment native selesai.

## 10. Risiko Teknis dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Data masih campuran JSON, PostgreSQL, localStorage | Progress dan report tidak konsisten | Tetapkan PostgreSQL sebagai source of truth untuk fitur batch baru |
| `user_progress` hanya summary dan memakai `GREATEST` | Tidak cocok untuk audit detail | Gunakan event/attempt/submission sebagai detail, progress sebagai agregat |
| Assignment praktik menyimpan file besar | Storage cepat membesar | Batasi ukuran, gunakan folder per batch, metadata DB, opsi external link |
| Gradebook kompleks jika semua fitur dibangun sekaligus | Risiko scope creep | Bangun gradebook read-only dulu, lalu tambah edit/rubric |
| Workaround lama tetap dipakai paralel | Data ganda | Buat cutover jelas per batch: batch lama boleh workaround, batch baru pakai native |
| Mentor butuh workflow sederhana | Adopsi rendah | Mulai dari 3 layar saja: Batch, Classwork, Gradebook |

## 11. Rekomendasi Keputusan Produk

Keputusan yang disarankan:

1. Jadikan BCL sebagai LMS internal berbasis batch, bukan sekadar repository materi.
2. Tetap pertahankan kekuatan BCL pada BIM learning path, competency mapping, dan certificate.
3. Adopsi pola Google Classroom hanya untuk operasional kelas:
   - class/batch
   - roster
   - classwork
   - assignment/submission
   - status due/missing/returned
   - rubric/feedback
   - gradebook
   - export evidence
4. Hindari prioritas rendah seperti guardian summaries dan originality report sampai training praktik end-to-end sudah native.
5. Target maturity:
   - Sekarang: `Go with Control`
   - Setelah Phase 1-3: `Go for structured batch operation`
   - Setelah Phase 4-5: `Go as internal BIM LMS for theory and practice`

## 12. Definisi Sukses Setelah Enhancement

BCL dapat dinyatakan berhasil mengadopsi fitur paling berguna dari Google Classroom jika:

- Admin bisa membuat batch training tanpa edit file manual.
- Mentor bisa mengatur materi, tugas, dan due date per batch.
- Peserta punya satu halaman untuk melihat materi, to-do, submission, nilai, dan feedback.
- Tugas praktik tidak lagi bergantung pada spreadsheet/folder eksternal sebagai sumber utama.
- Gradebook batch bisa dipakai untuk keputusan lulus/tidak lulus.
- HC/Engineering bisa export evidence training dari BCL.
- Progress peserta konsisten antara dashboard peserta, dashboard mentor, competency mapping, dan rekap akhir.

## 13. Kesimpulan

Google Classroom lebih matang untuk manajemen kelas harian. BCL lebih kuat untuk konteks BIM internal dan competency-based training. Enhancement terbaik adalah mengambil struktur operasional Google Classroom dan menanamkannya ke domain BCL, bukan mengganti karakter BCL.

Urutan paling rasional: batch/roster, classwork/due date, submission praktik, rubric/feedback, gradebook, lalu export evidence. Urutan ini langsung menutup kelemahan yang sekarang masih workaround dan menaikkan BCL dari `Go with Control` menjadi training center internal yang benar-benar end-to-end.
