# Blueprint Enhancement Training Center BCL

Tanggal: 3 Juli 2026  
Status: Product and implementation blueprint  
Basis: `BCL_GOOGLE_CLASSROOM_COMPARISON_AND_ENHANCEMENT_PLAN_20260703.md` dan `BCL_TRAINING_CENTER_PRODUCT_DIRECTION_20260703.md`

## 0. Status Record

Status terakhir diperbarui: **7 Juli 2026**  
Next active phase: **Post-Phase Refinement**  
Progress log utama: `docs/BCL_TRAINING_CENTER_ENHANCEMENT_PROGRESS_20260703.md`

Legend status:

- `Done`: sudah diimplementasikan dan minimal sudah diverifikasi.
- `In Progress`: sedang menjadi fokus aktif.
- `Not Started`: belum mulai implementasi.
- `Deferred`: sengaja ditunda dari scope awal.

| Phase | Scope utama | Status | Catatan cepat |
|---|---|---|---|
| Phase 1 | Batch Foundation | Done | Batch, roster, route `/api/training`, UI AdminBCL, dan My Training sudah tersedia. |
| Phase 2 | Training Plan and To-do foundation | Done | Topic, classwork item, training plan admin, dan detail plan participant sudah tersedia. To-do user-level penuh masih bisa diperdalam setelah submission ada. |
| Phase 3 | Practice Submission | Done | Backend, UI participant submit, UI mentor/admin submission list, dan smoke test berhasil. Evidence link dibatasi `http/https`; upload file biner deferred. |
| Phase 4 | Mentor Review and Review Criteria | Done | Core review mentor selesai dan smoke test runtime utama berhasil. Edit/delete criteria UI dan comment bank deferred. |
| Phase 5 | Batch Evaluation and Export | Done | Core gradebook/evaluation dan CSV export selesai; attendance table foundation tersedia. |
| Phase 6 | Readiness and Insight | Done | Core readiness dashboard selesai: at-risk participant, readiness by role, skill/activity gap, dan smoke test runtime utama. |

Next implementation checkpoint:

- Semua core Phase 1-6 sudah selesai.
- Refinement attendance UI sudah selesai.
- Refinement deferred berikutnya: upload binary evidence, edit/delete criteria UI, comment bank, native Excel export, alert/reminder otomatis, dan AI readiness summary.

## 1. Tujuan Blueprint

Blueprint ini menjadi acuan khusus untuk enhancement Training Center BCL.

Tujuan utamanya adalah mengembangkan BCL dari platform materi, quiz, dan progress dasar menjadi:

**BIM Learning, Evidence, and Competency Center** yang mampu mengelola batch training, praktik, review mentor, evidence, evaluasi, sertifikasi, dan readiness role BIM secara end-to-end.

BCL tidak diarahkan untuk meniru Google Classroom atau LMS lain. Platform lain hanya menjadi referensi pola operasional yang berguna. Identitas BCL tetap dibangun di atas kebutuhan internal BIM, competency mapping, evidence training, dan workflow BCL/NKE.

## 2. Product Direction

### Positioning

BCL Training Center adalah platform internal untuk:

- pembelajaran BIM berbasis role;
- pengelolaan materi internal;
- latihan dan ujian teori;
- tugas praktik berbasis evidence;
- review mentor/reviewer;
- competency record;
- certificate;
- rekap training untuk HC/Engineering.

### One-Sentence Direction

**BCL Training Center harus berkembang dari platform materi dan quiz menjadi sistem pengembangan kompetensi BIM yang mengelola batch, praktik, review mentor, evidence, dan readiness role secara end-to-end.**

## 3. Prinsip Enhancement

1. **BCL-first**
   Fitur baru harus memperkuat karakter BCL sebagai platform training BIM internal, bukan membuatnya menjadi LMS generik.

2. **Adopt useful patterns, not platform identity**
   Pola seperti batch, assignment, rubric, gradebook, dan due date boleh diadopsi, tetapi istilah dan workflow harus disesuaikan dengan BCL.

3. **Competency-driven**
   Progress bukan sekadar membuka materi. Progress harus mengarah ke readiness role dan kompetensi.

4. **Evidence-first**
   Setiap fitur training harus menghasilkan bukti yang bisa ditelusuri: aktivitas, submission, nilai, feedback, rubric, certificate, dan final status.

5. **Mentor-centered**
   Workflow mentor harus dibuat ringan: mudah melihat peserta, submission, status, rubric, feedback, dan rekap.

6. **Simple first, mature later**
   Bangun versi operasional sederhana lebih dulu sebelum automation kompleks.

7. **PostgreSQL as source of truth**
   Fitur training baru yang menyangkut audit, evidence, dan evaluasi harus memakai PostgreSQL sebagai sumber data utama.

## 4. Terminologi Produk BCL

| Istilah generik | Istilah BCL | Catatan |
|---|---|---|
| Class | Training Batch | Konteks operasional training |
| Student | Participant | Peserta internal/profesional |
| Teacher | Mentor | Pembimbing training |
| Co-teacher | Reviewer | Reviewer teknis/praktik |
| Classwork | Training Plan | Struktur kegiatan batch |
| Assignment | Practice Task | Tugas praktik BIM |
| Gradebook | Batch Evaluation | Rekap evaluasi batch |
| Rubric | Review Criteria | Kriteria review teknis |
| Grade | Evaluation Result | Nilai teori/praktik/final |

## 5. Scope Enhancement

### In Scope

- Training batch management.
- Batch roster dan role peserta/mentor/reviewer.
- Training plan per batch.
- Materi, quiz, exam, meeting, dan practice task yang terikat ke batch.
- Due date dan status work.
- Submission praktik.
- Review criteria/rubric.
- Feedback mentor.
- Batch evaluation.
- Attendance sederhana.
- Evidence export untuk HC/Engineering.
- Dashboard at-risk dan readiness.

### Out of Scope Awal

- Meniru UI Google Classroom.
- Guardian/parent summary.
- Full calendar integration.
- Originality/plagiarism report.
- AI assistant lanjutan.
- Migrasi penuh semua legacy JSON/localStorage dalam satu fase.

## 6. Target Modul

### 6.1 Training Batch

Fungsi:

- create/edit/archive batch;
- pilih learning path/program;
- tentukan periode training;
- assign mentor/reviewer;
- enroll participant;
- status batch: draft, active, completed, archived.

Output:

- batch menjadi konteks utama semua aktivitas training.

### 6.2 Training Plan

Fungsi:

- menyusun topic/session;
- menambahkan materi PDF/video/link;
- menghubungkan quiz/exam existing;
- membuat practice task;
- menambahkan meeting/session link;
- publish/draft item.

Output:

- participant tahu apa yang harus dipelajari dan dikerjakan.

### 6.3 Participant To-do

Fungsi:

- menampilkan assigned work;
- due soon;
- missing;
- submitted;
- returned;
- completed;
- score dan feedback.

Output:

- peserta punya satu halaman kerja training yang jelas.

### 6.4 Practice Task and Submission

Fungsi:

- instruksi tugas;
- due date;
- attachment/reference file;
- upload atau external link submission;
- status submitted/late/missing/returned;
- submission history.

Output:

- tugas praktik tidak lagi hanya bergantung pada folder eksternal.

### 6.5 Mentor Review

Fungsi:

- list submission per task;
- filter missing/late/submitted;
- buka evidence;
- beri score;
- beri feedback;
- return/revision status.

Output:

- mentor dapat review praktik dari BCL.

### 6.6 Review Criteria

Fungsi:

- rubric template;
- criteria;
- max score;
- weight;
- comment per criterion.

Output:

- penilaian praktik lebih konsisten dan bisa diaudit.

### 6.7 Batch Evaluation

Fungsi:

- rekap teori;
- rekap praktik;
- progress materi;
- attendance;
- certificate status;
- final status;
- export.

Output:

- mentor/admin/HC dapat melihat hasil batch dari satu sumber.

### 6.8 Evidence Export

Fungsi:

- export CSV/Excel tahap awal;
- PDF summary tahap berikutnya;
- evidence package per batch;
- detail participant;
- rubric score;
- feedback summary.

Output:

- HC/Engineering dapat memakai BCL sebagai sumber evidence training.

## 7. Data Blueprint

### 7.1 Tabel Baru Prioritas

```sql
training_batches
- id
- code
- title
- learning_path_id
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
- role
- enrollment_status
- joined_at
- completed_at

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
- type
- title
- instructions
- linked_resource_type
- linked_resource_id
- due_at
- points
- status
- sort_order
- created_by
- created_at
- updated_at

assignment_submissions
- id
- classwork_item_id
- user_id
- status
- submitted_at
- returned_at
- score
- feedback_summary
- metadata
- created_at
- updated_at

submission_files
- id
- submission_id
- file_path
- external_url
- file_name
- file_type
- file_size
- uploaded_at

review_criteria_templates
- id
- title
- description
- created_by
- created_at
- updated_at

review_criteria
- id
- template_id
- title
- description
- max_score
- weight
- sort_order

review_scores
- id
- submission_id
- criterion_id
- score
- comment
- reviewed_by
- reviewed_at

submission_comments
- id
- submission_id
- sender_user_id
- visibility
- body
- created_at

attendance_sessions
- id
- batch_id
- title
- scheduled_at
- meeting_url
- created_at

attendance_records
- id
- session_id
- user_id
- status
- note
- updated_by
- updated_at
```

### 7.2 Integrasi Dengan Data Existing

- `users`: sumber participant, mentor, reviewer, admin.
- `learning_attempts`: sumber nilai quiz/practice/exam.
- `user_certificates`: sumber certificate status.
- `learning_activity_events`: sumber aktivitas belajar.
- `user_progress`: summary agregat, bukan detail audit.
- `learning_materials`: sumber materi PDF/document.
- `pdf_material_reads`: sumber read/open evidence.
- `learning-paths.json`: seed/config learning path sampai dimigrasikan ke DB.

## 8. Roadmap Implementasi

### Phase 1 - Batch Foundation

Target:

- training batch;
- roster;
- mentor/reviewer;
- link learning path;
- batch detail page.

Deliverable:

- migration tabel batch;
- backend route `/api/training/batches`;
- admin UI create batch;
- participant "My Training" list.

Acceptance criteria:

- Admin dapat membuat batch BIM Modeller.
- Admin dapat enroll participant.
- Mentor dapat melihat roster.
- Participant dapat melihat batch yang diikuti.

### Phase 2 - Training Plan and To-do

Target:

- topic/session;
- classwork item;
- due date;
- material/quiz/exam link;
- participant to-do.

Deliverable:

- tabel `batch_topics` dan `classwork_items`;
- UI training plan;
- UI participant to-do;
- status assigned/done/missing.

Acceptance criteria:

- Mentor dapat publish item training.
- Participant melihat pekerjaan yang harus diselesaikan.
- Due date dapat menandai missing.
- Quiz existing dapat dihubungkan ke batch item.

### Phase 3 - Practice Submission

Target:

- practice task;
- upload/link submission;
- status submitted/late/missing;
- evidence viewer.

Deliverable:

- tabel `assignment_submissions` dan `submission_files`;
- upload endpoint;
- submission page participant;
- submission review list mentor.

Acceptance criteria:

- Participant dapat submit tugas praktik.
- Mentor dapat melihat submission.
- Status late/missing berjalan berdasarkan due date.
- Evidence tersimpan dan terhubung ke participant serta batch.

### Phase 4 - Mentor Review and Review Criteria

Target:

- rubric/review criteria;
- score;
- feedback;
- returned/revision status.

Deliverable:

- tabel review criteria dan review scores;
- review UI;
- comment/feedback UI;
- simple comment bank jika diperlukan.

Acceptance criteria:

- Mentor dapat menilai dengan criteria.
- Score per criterion tersimpan.
- Participant dapat melihat feedback.
- Submission dapat dikembalikan untuk revisi.

### Phase 5 - Batch Evaluation and Export

Target:

- gradebook/evaluation;
- attendance;
- final status;
- export evidence.

Deliverable:

- batch evaluation page;
- attendance session/record;
- export CSV/Excel;
- summary report.

Acceptance criteria:

- Admin/Mentor dapat melihat rekap satu batch.
- HC/Engineering dapat menerima export evidence.
- Final status participant dapat ditetapkan berbasis data.

### Phase 6 - Readiness and Insight

Target:

- at-risk participant;
- readiness role;
- skill gap;
- competency dashboard.

Deliverable:

- dashboard mentor/admin;
- readiness rules;
- alert/reminder dasar.

Acceptance criteria:

- Mentor melihat participant yang belum submit atau score rendah.
- Admin melihat readiness per role.
- Data training bisa dipakai untuk keputusan pengembangan kompetensi.

## 9. Backlog Prioritas

| Priority | Feature | Owner utama | Outcome |
|---|---|---|---|
| P0 | Training batch | Admin Training | Batch menjadi konteks utama |
| P0 | Batch roster | Admin Training | Peserta dan mentor jelas |
| P0 | Training plan | Mentor | Materi dan tugas tersusun |
| P0 | Participant to-do | Participant | Peserta tahu kewajiban |
| P0 | Practice task | Mentor | Tugas praktik native |
| P0 | Submission | Participant | Evidence terkumpul |
| P0 | Review criteria | Mentor/Reviewer | Penilaian konsisten |
| P0 | Batch evaluation | Mentor/Admin | Rekap batch tersedia |
| P0 | Export evidence | HC/Engineering | Evidence bisa diaudit |
| P1 | Attendance | Admin/Mentor | Kehadiran tercatat |
| P1 | Feedback/comment bank | Mentor | Review lebih cepat |
| P1 | At-risk dashboard | Mentor/Admin | Intervensi lebih cepat |
| P2 | Calendar/Teams integration | Admin | Workflow eksternal terhubung |
| P2 | AI readiness summary | Admin/HC | Insight lanjutan |

## 10. UX Blueprint

### Admin Training

Primary screens:

- Training Batches
- Create/Edit Batch
- Batch Roster
- Batch Evaluation
- Evidence Export

### Mentor/Reviewer

Primary screens:

- My Mentored Batches
- Training Plan
- Practice Submissions
- Review Workspace
- Batch Evaluation
- At-risk Participants

### Participant

Primary screens:

- My Training
- Training Plan
- To-do
- Practice Submission
- Feedback and Scores
- Certificates

### HC/Engineering

Primary screens:

- Batch Summary
- Participant Evidence
- Competency Readiness
- Export Center

## 11. Status Lifecycle

### Batch Status

- `draft`
- `active`
- `completed`
- `archived`

### Classwork/Training Item Status

- `draft`
- `published`
- `closed`
- `archived`

### Submission Status

- `assigned`
- `submitted`
- `late`
- `missing`
- `reviewed`
- `returned`
- `completed`

### Participant Final Status

- `in_progress`
- `completed`
- `passed`
- `needs_revision`
- `not_passed`
- `dropped`

## 12. Progress and Evidence Rules

Progress BCL harus dibedakan menjadi aktivitas dan evidence.

### Activity

Contoh activity:

- membuka PDF;
- membuka video;
- membuka halaman materi;
- memulai quiz.

Activity membantu melihat engagement, tetapi tidak cukup untuk final competency.

### Evidence

Contoh evidence:

- quiz passed;
- exam passed;
- practice task submitted;
- practice task reviewed;
- rubric score tersimpan;
- feedback diberikan;
- certificate issued;
- final status ditetapkan.

Evidence menjadi dasar batch evaluation dan competency record.

## 13. Definition of Done

Sebuah enhancement training dianggap selesai jika:

- data tersimpan di PostgreSQL untuk fitur audit/evidence;
- role participant/mentor/admin jelas;
- UI mendukung workflow utama tanpa spreadsheet paralel;
- status lifecycle jelas;
- ada endpoint read/write yang stabil;
- ada validasi akses;
- data muncul di dashboard atau report yang relevan;
- ada acceptance criteria yang bisa diuji;
- fitur menghasilkan evidence atau operational control yang nyata.

## 14. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Scope terlalu besar | Fitur lambat selesai | Bangun per phase |
| Data legacy tersebar | Report tidak konsisten | DB baru sebagai source of truth |
| Mentor tetap pakai spreadsheet | Adopsi rendah | Prioritaskan review dan evaluation UI |
| Upload file besar | Storage membengkak | Dukung external link + metadata |
| Status progress rancu | Evidence tidak kuat | Pisahkan activity vs evidence |
| UI terlalu generic | Identitas BCL melemah | Pakai terminologi BCL |

## 15. Milestone Keberhasilan

### Milestone 1

BCL bisa membuat batch training, roster peserta, dan training plan.

### Milestone 2

Peserta bisa melihat to-do dan submit practice task.

### Milestone 3

Mentor bisa review submission dengan criteria dan feedback.

### Milestone 4

Admin/Mentor bisa melihat batch evaluation dan export evidence.

### Milestone 5

HC/Engineering bisa memakai BCL sebagai sumber data training dan competency readiness.

## 16. Final Direction

Enhancement Training Center BCL harus difokuskan pada satu arah:

**membuat BCL menjadi pusat training BIM internal yang menghubungkan learning path, batch operation, practice evidence, mentor review, competency record, dan HC/Engineering reporting dalam satu alur yang khas BCL.**
