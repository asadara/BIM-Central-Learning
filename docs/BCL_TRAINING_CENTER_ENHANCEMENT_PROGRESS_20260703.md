# Progress Implementasi Enhancement Training Center BCL

Tanggal mulai: 3 Juli 2026  
Blueprint acuan: `docs/BCL_TRAINING_CENTER_ENHANCEMENT_BLUEPRINT_20260703.md`

## Status Saat Ini

Status terakhir diperbarui: **7 Juli 2026**

Phase aktif berikutnya: **Post-Phase Refinement**

Status phase:

| Phase | Nama | Status | Catatan cepat |
|---|---|---|---|
| Phase 1 | Batch Foundation | Done | Batch, roster, endpoint admin/member, dan My Training sudah tersedia. |
| Phase 2 | Training Plan Foundation | Done | Topic, classwork item, training plan admin, dan detail plan participant sudah tersedia. |
| Phase 3 | Practice Submission | Done | Backend, UI, dan smoke test runtime utama berhasil untuk evidence link/path. Upload file biner deferred. |
| Phase 4 | Mentor Review and Review Criteria | Done | Core review mentor selesai: criteria, score, feedback, returned/accepted/completed status, participant feedback, dan smoke test runtime utama. |
| Phase 5 | Batch Evaluation and Export | Done | Core gradebook/evaluation dan export CSV selesai; attendance table foundation tersedia. |
| Phase 6 | Readiness and Insight | Done | Core readiness dashboard selesai: at-risk participant, readiness by role, skill/activity gap, dan smoke test runtime utama. |

Next checkpoint:

- Semua core Phase 1-6 sudah Done.
- Refinement pertama selesai: attendance UI dan attendance records.
- Refinement deferred berikutnya: upload binary evidence, edit/delete criteria UI, comment bank, native Excel export, dan alert/reminder otomatis.

Target Phase 1:

- Training batch tersimpan di PostgreSQL.
- Roster batch tersimpan di PostgreSQL.
- Admin dapat membuat, membaca, mengubah, dan mengarsipkan batch.
- Admin dapat menambahkan/menghapus participant, mentor, reviewer, dan observer.
- Participant dapat melihat batch yang dia ikuti.
- Backend endpoint tersedia untuk UI berikutnya.

## Log Progress

### 2026-07-03

- Membuat dokumen progress implementasi agar pekerjaan tetap tercatat saat sesi/kuota terputus.
- Memulai implementasi Phase 1 dari blueprint.
- Menambahkan backend route `backend/routes/trainingBatchRoutes.js`.
- Menambahkan mount route `/api/training` di `backend/server.js`.
- Menambahkan fondasi tabel runtime:
  - `training_batches`
  - `batch_members`
- Menambahkan endpoint Phase 1:
  - `GET /api/training/batches`
  - `POST /api/training/batches`
  - `GET /api/training/batches/:id`
  - `PUT /api/training/batches/:id`
  - `GET /api/training/batches/:id/members`
  - `POST /api/training/batches/:id/members`
  - `DELETE /api/training/batches/:id/members/:memberId`
  - `GET /api/training/my-batches`
- Verifikasi syntax berhasil:
  - `node -c backend\routes\trainingBatchRoutes.js`
  - `node -c backend\server.js`
- Verifikasi koneksi PostgreSQL berhasil:
  - `node backend\scripts\db-ping.js`
- Menambahkan UI minimum Phase 1 di AdminBCL:
  - menu `Training Batches`
  - section daftar batch
  - tombol refresh
  - modal `Batch Baru`
  - submit ke `POST /api/training/batches`
- Menambahkan UI roster Phase 1 di AdminBCL:
  - tombol `Roster` per batch
  - tampilan roster member
  - modal tambah member berdasarkan user id/email/username
  - role `participant`, `mentor`, `reviewer`, `admin`, `hc_observer`
  - enrollment status `active`, `invited`, `completed`, `dropped`
  - hapus member dari batch
- Verifikasi syntax frontend berhasil:
  - `node -c BC-Learning-Main\pages\sub\adminbcl.js`
- Menambahkan halaman participant `My Training`:
  - `BC-Learning-Main/elearning-assets/my-training.html`
  - `BC-Learning-Main/elearning-assets/js/my-training.js`
  - membaca `GET /api/training/my-batches`
  - menampilkan total batch, active batch, completed batch
  - menampilkan role participant/mentor/reviewer di batch terkait
- Menambahkan link `My Training` pada sidebar e-learning.
- Verifikasi syntax halaman participant berhasil:
  - `node -c BC-Learning-Main\elearning-assets\js\my-training.js`
- Smoke check terhadap server aktif:
  - `GET http://localhost:5052/api/training/batches` mengembalikan `404`
  - interpretasi: proses backend aktif belum direstart setelah route `/api/training` ditambahkan
  - tindakan berikutnya: restart backend BCL sebelum live endpoint test
- Setelah backend direstart, smoke test API Phase 1 berhasil:
  - create batch via `POST /api/training/batches`
  - add roster member via `POST /api/training/batches/:id/members`
  - read roster via `GET /api/training/batches/:id/members`
  - participant batch terlihat via `GET /api/training/my-batches`
  - smoke batch diarsipkan via `PUT /api/training/batches/:id`
  - hasil: `createdStatus=draft`, `addedMembers=1`, `rosterCount=1`, `archivedStatus=archived`
- Memulai Phase 2 - Training Plan Foundation.
- Menambahkan tabel runtime Phase 2:
  - `batch_topics`
  - `classwork_items`
- Menambahkan endpoint Phase 2:
  - `GET /api/training/batches/:id/training-plan`
  - `POST /api/training/batches/:id/topics`
  - `PUT /api/training/batches/:id/topics/:topicId`
  - `POST /api/training/batches/:id/classwork`
  - `PUT /api/training/batches/:id/classwork/:itemId`
- Smoke test API Phase 2 berhasil lewat temporary Express server:
  - create smoke batch
  - create topic/session
  - create classwork item
  - read training plan
  - archive smoke batch
  - hasil: `topicCount=1`, `firstTopicItemCount=1`, `archivedStatus=archived`
- Menambahkan UI Training Plan minimum di AdminBCL:
  - tombol `Plan` per batch
  - tampilan topic/session
  - tampilan classwork item
  - modal tambah topic
  - modal tambah item `material`, `quiz`, `practice_task`, `exam`, `meeting`, `announcement`
- Verifikasi syntax setelah Phase 2 berhasil:
  - `node -c backend\routes\trainingBatchRoutes.js`
  - `node -c backend\server.js`
  - `node -c BC-Learning-Main\pages\sub\adminbcl.js`
  - `node -c BC-Learning-Main\elearning-assets\js\my-training.js`
- Smoke test ulang Phase 1 pada backend utama berhasil setelah restart:
  - create batch via `POST /api/training/batches`
  - add roster member via `POST /api/training/batches/:id/members`
  - read roster via `GET /api/training/batches/:id/members`
  - participant batch terlihat via `GET /api/training/my-batches`
  - smoke batch diarsipkan via `PUT /api/training/batches/:id`
  - hasil: `createdStatus=draft`, `addedMembers=1`, `rosterCount=1`, `myBatchesVisibleBeforeArchive=true`, `archivedStatus=archived`
- Smoke test Phase 2 pada backend utama belum aktif di runtime:
  - `POST /api/training/batches/:id/topics` mengembalikan `404`
  - interpretasi: proses backend utama masih menjalankan versi route sebelum endpoint Phase 2 termuat
  - tindakan berikutnya: restart backend BCL sekali lagi setelah perubahan Phase 2
- Setelah backend direstart ulang, smoke test Phase 2 pada runtime utama berhasil:
  - create smoke batch via `POST /api/training/batches`
  - add roster via `POST /api/training/batches/:id/members`
  - create topic via `POST /api/training/batches/:id/topics`
  - update topic via `PUT /api/training/batches/:id/topics/:topicId`
  - create classwork via `POST /api/training/batches/:id/classwork`
  - update classwork via `PUT /api/training/batches/:id/classwork/:itemId`
  - read training plan sebagai admin dan participant via `GET /api/training/batches/:id/training-plan`
  - smoke batch diarsipkan
  - hasil: `adminTopicCount=1`, `participantTopicCount=1`, `firstTopicItemCount=1`, `updatedClassworkPoints=12`, `archivedStatus=archived`
- Menambahkan UI participant Training Plan detail di halaman `My Training`:
  - tombol `Plan` pada setiap training batch
  - panel detail Training Plan
  - render topic/session
  - render item `material`, `quiz`, `practice_task`, `exam`, `meeting`, `announcement`
  - empty/error state untuk Training Plan
- Verifikasi syntax setelah UI participant Training Plan detail berhasil:
  - `node -c backend\routes\trainingBatchRoutes.js`
  - `node -c backend\server.js`
  - `node -c BC-Learning-Main\pages\sub\adminbcl.js`
  - `node -c BC-Learning-Main\elearning-assets\js\my-training.js`

### 2026-07-06

- Menambahkan status marker pada blueprint dan progress log agar fase aktif cepat diketahui.
- Menetapkan current phase ke **Phase 3 - Practice Submission** karena Phase 1 dan Phase 2 foundation sudah tercatat Done.
- Menambahkan checkpoint Phase 3:
  - `assignment_submissions`
  - `submission_files`
  - endpoint submit/read submission
  - UI participant submit practice task
  - UI mentor submission list
- Memulai implementasi Phase 3 - Practice Submission.
- Menambahkan fondasi tabel runtime Phase 3:
  - `assignment_submissions`
  - `submission_files`
- Menambahkan endpoint Phase 3:
  - `GET /api/training/batches/:id/classwork/:itemId/submission`
  - `POST /api/training/batches/:id/classwork/:itemId/submission`
  - `GET /api/training/batches/:id/classwork/:itemId/submissions`
- Endpoint submit mendukung evidence metadata berupa `externalUrl`/`external_url` berprotokol `http/https`, `filePath`/`file_path`, atau array `files`.
- Endpoint mentor/admin submission list menampilkan semua participant, termasuk status turunan `assigned` atau `missing` jika belum ada submission record.
- Verifikasi syntax backend berhasil:
  - `node -c backend\routes\trainingBatchRoutes.js`
  - `node -c backend\server.js`

### 2026-07-07

- Melanjutkan sisa Phase 3 - Practice Submission pada sisi UI.
- Menambahkan UI participant submit practice task di `My Training`:
  - tombol `Submit`/`Update` untuk item `practice_task`
  - modal submission evidence
  - input `externalUrl`, `filePath`, nama evidence, dan catatan peserta
  - read status submission sebelum edit
  - post create/update submission ke endpoint Phase 3
- Menambahkan UI mentor/admin submission list di AdminBCL:
  - tombol `Submissions` pada item `Practice Task`
  - modal daftar submission seluruh participant
  - status `assigned`, `missing`, `submitted`, `late`, `returned`, `reviewed`, `accepted`
  - evidence link/path dan catatan peserta
- Verifikasi syntax Phase 3 UI/backend berhasil:
  - `node -c BC-Learning-Main\elearning-assets\js\my-training.js`
  - `node -c BC-Learning-Main\pages\sub\adminbcl.js`
  - `node -c backend\routes\trainingBatchRoutes.js`
- Smoke test Phase 3 pada backend utama berhasil:
  - create smoke batch via `POST /api/training/batches`
  - add participant via `POST /api/training/batches/:id/members`
  - create topic dan practice task
  - read own submission sebelum submit menghasilkan status `assigned`
  - submit evidence link menghasilkan status `submitted`
  - read mentor/admin submission list menemukan participant dan 1 evidence
  - smoke batch dibersihkan setelah test
- Menambahkan hardening kecil pada backend submission:
  - `externalUrl` hanya menerima URL `http`/`https`
  - submission wajib membawa minimal evidence link atau file path
- Smoke test route terbaru lewat temporary Express server berhasil:
  - status awal `assigned`
  - submit evidence `https` menjadi `submitted`
  - mentor/admin submission list terbaca
  - catatan: backend utama perlu restart BCL agar validasi evidence terbaru termuat di proses aktif
- Validasi runtime utama setelah restart berhasil:
  - URL `javascript:` ditolak dengan status `400`
  - evidence `https` diterima
  - status submission berubah `assigned` -> `submitted`
  - submission list admin membaca 1 evidence

- Memulai Phase 4 - Mentor Review and Review Criteria.
- Menambahkan tabel runtime Phase 4:
  - `review_criteria`
  - `review_scores`
  - `submission_comments`
- Menambahkan endpoint Phase 4:
  - `GET /api/training/batches/:id/classwork/:itemId/review-criteria`
  - `POST /api/training/batches/:id/classwork/:itemId/review-criteria`
  - `GET /api/training/batches/:id/classwork/:itemId/submissions/:submissionId/review`
  - `POST /api/training/batches/:id/classwork/:itemId/submissions/:submissionId/review`
  - `GET /api/training/batches/:id/classwork/:itemId/submission/review`
- Menambahkan UI mentor/admin review di AdminBCL:
  - tombol `Review` pada submission row
  - modal score per criteria
  - status `reviewed`, `returned`, `accepted`, `completed`
  - feedback summary dan komentar participant
- Menambahkan tampilan feedback mentor di modal submission peserta `My Training`.
- Verifikasi syntax Phase 4 berhasil:
  - `node -c backend\routes\trainingBatchRoutes.js`
  - `node -c BC-Learning-Main\pages\sub\adminbcl.js`
  - `node -c BC-Learning-Main\elearning-assets\js\my-training.js`
- Smoke test Phase 4 lewat temporary Express server berhasil:
  - participant submit practice task
  - mentor review dengan criteria `Kualitas Evidence`
  - status submission menjadi `reviewed`
  - score tersimpan `17` dari 20 poin
  - participant dapat membaca feedback mentor
  - catatan: backend utama perlu restart BCL agar endpoint Phase 4 termuat di runtime utama
- Restart BCL melalui `/api/server/restart-full` berhasil:
  - restart diterima via JWT admin
  - server baru terverifikasi dengan uptime rendah setelah restart
- Smoke test Phase 4 di backend utama berhasil:
  - participant submit practice task
  - mentor review submission dengan criteria `Kualitas Evidence`
  - status submission menjadi `reviewed`
  - score tersimpan `18` dari 20 poin
  - participant dapat membaca feedback mentor dari endpoint feedback
- Memulai Phase 5 - Batch Evaluation and Export.
- Menambahkan tabel runtime Phase 5:
  - `batch_evaluations`
  - `attendance_sessions`
  - `attendance_records`
- Menambahkan endpoint Phase 5:
  - `GET /api/training/batches/:id/evaluation`
  - `PUT /api/training/batches/:id/evaluation/:userId`
  - `GET /api/training/batches/:id/evaluation/export.csv`
- Menambahkan UI AdminBCL Batch Evaluation:
  - tombol `Evaluation` pada daftar batch
  - tombol `Evaluation` dari header Training Plan
  - ringkasan participant/completed/needs revision/average score
  - tabel gradebook per participant
  - update final status, final score, dan note
  - export CSV
- Verifikasi syntax Phase 5 berhasil:
  - `node -c backend\routes\trainingBatchRoutes.js`
  - `node -c BC-Learning-Main\pages\sub\adminbcl.js`
- Smoke test Phase 5 lewat temporary Express server berhasil:
  - gradebook membaca score review `16` dari 20 poin
  - final status dapat disimpan `passed`
  - CSV export berisi participant
- Restart BCL melalui `/api/server/restart-full` berhasil setelah Phase 5:
  - server baru terverifikasi dengan uptime rendah
- Smoke test Phase 5 di backend utama berhasil:
  - gradebook membaca 1 row participant
  - row status turunan `completed`
  - final status tersimpan `passed`
  - CSV export berisi participant
- Memulai Phase 6 - Readiness and Insight.
- Menambahkan endpoint Phase 6:
  - `GET /api/training/batches/:id/readiness`
- Menambahkan readiness rules:
  - `ready` untuk final status `passed`/`completed`
  - `blocked` untuk `failed`/`dropped`
  - `at_risk` untuk missing submission, returned submission, score rendah, atau completion rendah
  - `on_track` untuk completion tinggi yang belum final ready
- Menambahkan data insight:
  - summary readiness batch
  - daftar at-risk participant beserta risk reasons
  - readiness by role/job role
  - skill/activity gap per practice task
- Menambahkan UI AdminBCL Readiness:
  - tombol `Readiness` pada daftar batch
  - tombol `Readiness` dari Training Plan dan Evaluation
  - dashboard summary ready/on-track/in-progress/at-risk/blocked
  - tabel at-risk participants
  - panel readiness by role
  - tabel skill/activity gap
- Verifikasi syntax Phase 6 berhasil:
  - `node -c backend\routes\trainingBatchRoutes.js`
  - `node -c BC-Learning-Main\pages\sub\adminbcl.js`
- Smoke test Phase 6 lewat temporary Express server berhasil:
  - participant terdeteksi `at_risk`
  - risk reasons terbaca: missing submission, score rendah, completion rendah
  - skill gap terbaca
- Restart BCL melalui `/api/server/restart-full` berhasil setelah Phase 6:
  - server baru terverifikasi dengan uptime rendah
- Smoke test Phase 6 di backend utama berhasil:
  - readiness endpoint aktif
  - participant at-risk terdeteksi
  - risk reasons terbaca
  - skill gap terbaca
- Memulai post-phase refinement pertama: Attendance UI.
- Menambahkan endpoint attendance:
  - `GET /api/training/batches/:id/attendance`
  - `POST /api/training/batches/:id/attendance/sessions`
  - `PUT /api/training/batches/:id/attendance/sessions/:sessionId/records`
- Menambahkan UI AdminBCL Attendance:
  - tombol `Attendance` pada daftar batch
  - tombol `Attendance` dari Training Plan, Evaluation, dan Readiness
  - halaman attendance per batch
  - tambah attendance session
  - input status `present`, `late`, `absent`, `excused` per participant
  - note per participant
  - simpan bulk attendance records
- Verifikasi syntax attendance berhasil:
  - `node -c backend\routes\trainingBatchRoutes.js`
  - `node -c BC-Learning-Main\pages\sub\adminbcl.js`
- Smoke test attendance lewat temporary Express server berhasil:
  - attendance session dibuat
  - 1 record `late` tersimpan
  - overview attendance membaca `lateCount=1`
- Restart BCL melalui `/api/server/restart-full` berhasil setelah attendance refinement:
  - server baru terverifikasi dengan uptime rendah
- Smoke test attendance di backend utama berhasil:
  - attendance session dibuat
  - 1 record `late` tersimpan
  - overview attendance membaca session dan participant

## Checklist Phase 1

| Item | Status | Catatan |
|---|---|---|
| Progress log | Done | File ini menjadi catatan utama |
| Review struktur backend/auth | Done | Backend memakai Express CommonJS, PostgreSQL, dan `backend/utils/auth.js` |
| Tabel `training_batches` | Done | Dibuat lewat route ensure table |
| Tabel `batch_members` | Done | Dibuat lewat route ensure table |
| Endpoint admin batch CRUD | Done | `/api/training/batches` |
| Endpoint member roster | Done | `/api/training/batches/:id/members` |
| Endpoint participant my-batches | Done | `/api/training/my-batches` |
| Mount route di server | Done | `/api/training` |
| Verifikasi syntax | Done | `node -c` berhasil |
| Verifikasi PostgreSQL | Done | `db-ping` berhasil |
| UI admin list/create batch | Done | Section `Training Batches` di AdminBCL |
| UI roster member | Done | List/add/delete member batch di AdminBCL |
| UI participant My Training | Done | Halaman `/elearning-assets/my-training.html` |

## Checklist Phase 2

| Item | Status | Catatan |
|---|---|---|
| Tabel `batch_topics` | Done | Dibuat lewat route ensure table |
| Tabel `classwork_items` | Done | Dibuat lewat route ensure table |
| Endpoint read training plan | Done | `/api/training/batches/:id/training-plan` |
| Endpoint create/update topic | Done | `/api/training/batches/:id/topics` |
| Endpoint create/update classwork | Done | `/api/training/batches/:id/classwork` |
| Smoke test API Phase 2 | Done | Temporary Express server berhasil |
| Smoke test API Phase 2 di backend utama | Done | Create/update topic, create/update classwork, dan read plan admin/participant berhasil |
| UI AdminBCL Training Plan | Done | View topic/item dan create topic/item |
| UI participant Training Plan detail | Done | `My Training` sudah punya tombol dan panel Training Plan |

## Checklist Phase 3

| Item | Status | Catatan |
|---|---|---|
| Tabel `assignment_submissions` | Done | Dibuat lewat route ensure table |
| Tabel `submission_files` | Done | Dibuat lewat route ensure table |
| Endpoint read own submission | Done | `/api/training/batches/:id/classwork/:itemId/submission` |
| Endpoint create/update own submission | Done | Evidence wajib berupa URL `http/https` atau file path; belum upload binary |
| Endpoint mentor/admin submission list | Done | `/api/training/batches/:id/classwork/:itemId/submissions` |
| Verifikasi syntax backend | Done | `node -c` berhasil |
| Smoke test API Phase 3 di backend utama | Done | Runtime utama berhasil: `assigned` -> `submitted`, list admin berisi 1 evidence |
| UI participant submit practice task | Done | Modal submission evidence di `My Training` |
| UI mentor submission list | Done | Modal submission list di AdminBCL Training Plan |
| Verifikasi syntax UI Phase 3 | Done | `node -c` untuk `my-training.js` dan `adminbcl.js` berhasil |
| Upload file binary/native storage | Deferred | Tahap awal memakai external link/path metadata |

## Checklist Phase 4

| Item | Status | Catatan |
|---|---|---|
| Tabel `review_criteria` | Done | Criteria item-level dan template id opsional |
| Tabel `review_scores` | Done | Score/comment per criterion |
| Tabel `submission_comments` | Done | Komentar participant/internal |
| Endpoint list/create review criteria | Done | `/api/training/batches/:id/classwork/:itemId/review-criteria` |
| Endpoint mentor/admin review detail | Done | `/api/training/batches/:id/classwork/:itemId/submissions/:submissionId/review` |
| Endpoint save review | Done | Status review, total score, feedback, score criteria, komentar |
| Endpoint participant read feedback | Done | `/api/training/batches/:id/classwork/:itemId/submission/review` |
| UI mentor/admin review submission | Done | Modal review dari AdminBCL submission list |
| UI participant feedback summary | Done | Modal submission di `My Training` menampilkan score/feedback |
| Smoke test route terbaru | Done | Temporary Express server berhasil |
| Smoke test Phase 4 di backend utama | Done | Runtime utama berhasil: submitted -> reviewed, score 18/20, participant feedback terbaca |
| Edit/delete criteria UI | Deferred | Bisa ditambahkan setelah review basic stabil |
| Comment bank | Deferred | Opsional sesuai blueprint |

## Checklist Phase 5

| Item | Status | Catatan |
|---|---|---|
| Tabel `batch_evaluations` | Done | Final status, final score, evaluator, dan note |
| Tabel `attendance_sessions` | Done | Foundation attendance session |
| Tabel `attendance_records` | Done | Foundation attendance record |
| Endpoint batch evaluation | Done | `/api/training/batches/:id/evaluation` |
| Endpoint update final evaluation | Done | `/api/training/batches/:id/evaluation/:userId` |
| Endpoint export CSV | Done | `/api/training/batches/:id/evaluation/export.csv` |
| UI AdminBCL evaluation page | Done | Ringkasan batch dan gradebook participant |
| UI final status/score/note | Done | Save per participant |
| Smoke test route terbaru | Done | Temporary Express server berhasil |
| Smoke test Phase 5 di backend utama | Done | Runtime utama berhasil, CSV berisi participant |
| Attendance UI | Done | Selesai pada post-phase refinement pertama |
| Excel native export | Deferred | Tahap awal CSV, kompatibel Excel |

## Checklist Phase 6

| Item | Status | Catatan |
|---|---|---|
| Endpoint batch readiness | Done | `/api/training/batches/:id/readiness` |
| Readiness rules | Done | Ready, on-track, in-progress, at-risk, blocked |
| At-risk participant list | Done | Risk reasons berbasis missing/returned/score/completion |
| Readiness by role | Done | Agregasi per `jobRole` |
| Skill/activity gap | Done | Agregasi per practice task |
| UI AdminBCL readiness dashboard | Done | Summary, at-risk table, role readiness, skill gap |
| Smoke test route terbaru | Done | Temporary Express server berhasil |
| Smoke test Phase 6 di backend utama | Done | Runtime utama berhasil |
| Alert/reminder otomatis | Deferred | Perlu desain channel notifikasi |
| AI readiness summary | Deferred | P2 sesuai blueprint |

## Checklist Post-Phase Refinement

| Item | Status | Catatan |
|---|---|---|
| Attendance endpoints | Done | List sessions, create session, bulk save records |
| Attendance UI AdminBCL | Done | Session selector, participant status, note, save bulk |
| Smoke test attendance runtime utama | Done | Session dan record `late` berhasil terbaca |
| Upload binary evidence | Deferred | Saat ini evidence link/path sudah aman |
| Edit/delete criteria UI | Deferred | Criteria create/review sudah ada |
| Comment bank | Deferred | Opsional untuk mempercepat review |
| Native Excel export | Deferred | CSV sudah tersedia |
| Alert/reminder otomatis | Deferred | Perlu desain channel notifikasi |

## Endpoint Phase 1

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| GET | `/api/training/batches` | Admin | List semua batch |
| POST | `/api/training/batches` | Admin | Membuat batch |
| GET | `/api/training/batches/:id` | Admin/member | Detail batch |
| PUT | `/api/training/batches/:id` | Admin | Update batch |
| GET | `/api/training/batches/:id/members` | Admin/member | Roster batch |
| POST | `/api/training/batches/:id/members` | Admin | Tambah/update member |
| DELETE | `/api/training/batches/:id/members/:memberId` | Admin | Hapus member |
| GET | `/api/training/my-batches` | Authenticated | Batch milik user login |

## Next Step

Phase berikutnya:

- Post-phase refinement sesuai prioritas operasional.
- Kandidat berikutnya: upload binary evidence, edit/delete criteria UI, comment bank, native Excel export, atau alert/reminder otomatis.

## Catatan Desain

- Source of truth Phase 1 memakai PostgreSQL.
- `training_batches.created_by` disimpan sebagai text agar bisa menerima admin session, legacy admin token, atau JWT user.
- `batch_members.user_id` mengarah ke `users.id` agar roster tetap terkait user internal BCL.
- Role member mengikuti blueprint: `participant`, `mentor`, `reviewer`, `admin`, `hc_observer`.
- Status batch mengikuti blueprint: `draft`, `active`, `completed`, `archived`.
