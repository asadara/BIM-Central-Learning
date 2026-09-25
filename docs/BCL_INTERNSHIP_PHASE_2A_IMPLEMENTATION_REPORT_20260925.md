# BCL Internship Program — Phase 2A Implementation Report

**Tanggal:** 25 September 2026
**Scope:** Assignment Integration & Data Contract
**Status:** Implemented; menunggu review/acceptance dan live migration gate
**Stop point:** Assignment availability dan participant assignment view saja. Submission, evidence, scoring, dan mentor review tidak diimplementasikan.

## 1. Ringkasan implementasi

Phase 2A menambahkan `practice_task` ke perjalanan peserta Internship dengan tetap memakai `training_batches`, `batch_topics`, dan `classwork_items`. Assignment menjadi lapisan aplikasi praktik yang terpisah dari learning content dan learning completion.

Alur yang dihasilkan:

`authenticated participant → authorized Internship batch → published practice_task → canonical learning reference → authoritative Phase 1 evidence → derived availability → participant UI`

Assignment tidak menulis learning evidence, tidak mempunyai state completion, dan tidak masuk ke overall learning percentage.

## 2. Perubahan data model

Tiga kolom additive ditambahkan ke `classwork_items`:

- `available_at TIMESTAMPTZ`: waktu release opsional;
- `required_deliverable TEXT`: deskripsi output yang diharapkan;
- `participant_visibility TEXT NOT NULL DEFAULT 'visible'`: controlled `visible|hidden`.

Tabel generic `classwork_content_links` ditambahkan sebagai relasi classwork ke learning reference. Metadata title/href tidak diduplikasi; keduanya selalu di-resolve dari canonical catalog atau frozen published assessment definition.

Tidak ada kolom `assignment_completed`, `prerequisite_completed`, submission, score, atau review baru.

## 3. Migration files

- `backend/scripts/20260925-internship-phase2a.sql`
- `backend/scripts/20260925-internship-phase2a-rollback.sql`
- `backend/scripts/run-internship-phase2a-migration.js`

Migration menyediakan:

- preflight dependency Phase 1A/Unified Learning/Training;
- advisory transaction lock;
- controlled checks dan unique rules;
- indexes availability dan mapping;
- `classwork_id` FK dengan `ON DELETE CASCADE`;
- canonical `content_id` FK dengan `ON DELETE RESTRICT`;
- rollback eksplisit.

`npm run migrate:internship:assignments:validate` menjalankan Phase 1A sementara bila dependency belum di-apply, memvalidasi Phase 2A, menjalankan rollback kedua fase di transaksi, lalu melakukan final rollback. Tidak ada `--apply` yang dijalankan.

## 4. Assignment/content relationship model

`classwork_content_links` menyimpan tepat satu target per row:

- `content_id` untuk canonical page/video/pdf pada `learning_content_registry`; atau
- `quiz_id` untuk assessment pada frozen published learning-path definition.

`relationship_type` hanya menerima:

- `prerequisite`: harus selesai sebelum assignment menjadi available;
- `reference`: materi pendukung tanpa efek gating.

Quiz memakai kolom terkontrol terpisah karena canonical registry existing hanya mendukung `page|video|pdf`. Quiz ID divalidasi terhadap assessment published pada frozen path batch, bukan diterima sebagai free text. Ini adalah deviasi kecil dari model content-only agar requirement verified quiz evidence dapat dipenuhi tanpa memperluas canonical registry secara tidak aman.

## 5. API yang ditambahkan

Ketika `INTERNSHIP_ASSIGNMENTS_ENABLED=true`:

- `GET /api/training/internships/:batchId/assignments`
- `GET /api/training/internships/:batchId/assignments/:assignmentId`

List contract memuat:

- `assignmentId`, title, brief;
- topic/stage dari `batch_topics`;
- `availableAt`, `dueAt`;
- derived `state`;
- canonical `learningReferences` dan safe BCL href;
- `requiredDeliverable`;
- participant visibility marker dan ordering;
- summary count per availability state;
- `authority: server-derived`, `readOnly: true`.

Tidak ada user ID dari browser, submission payload, internal note, score, file path, atau review criterion dalam response.

## 6. Authorization dan visibility

Urutan enforcement:

1. canonical authenticated principal;
2. Internship program type dan published frozen path;
3. active batch membership atau authorized staff/system admin sesuai Phase 1A;
4. classwork harus dimiliki `batchId` pada URL;
5. hanya `practice_task`;
6. hanya `published|closed`;
7. hanya `participant_visibility='visible'`;
8. canonical reference harus active/published dan resolvable.

Draft, archived, hidden, wrong-batch, unknown assignment, invalid content, dan unpublished quiz fail closed. Detail URL yang dimodifikasi tidak dapat mengambil item batch lain.

## 7. Assignment availability rules

Precedence server-side:

1. **Closed** — classwork explicit `closed`, atau deadline lewat jika `policy_json.assignments.closeAtDueDate=true`;
2. **Upcoming** — `available_at` berada di masa depan;
3. **Locked** — satu atau lebih prerequisite belum complete;
4. **Available** — published, sudah release, dan seluruh prerequisite complete.

UI label:

- `Akan Datang`
- `Tersedia`
- `Belum Terbuka`
- `Ditutup`

Prerequisite page/video/pdf berasal dari `learning_activity_events`; quiz hanya berasal dari verified and passed `learning_attempts`. Perubahan evidence otomatis mengubah availability pada request berikutnya, tanpa assignment-state write.

## 8. Participant UI

Halaman Phase 1B sekarang memiliki section `Tugas Praktik` setelah Learning Path. Learning tetap menjadi hierarchy utama dan Current Focus tetap learning-driven.

Setiap row assignment menampilkan secara ringkas:

- topic/stage;
- title dan brief;
- canonical prerequisite/reference links;
- required output;
- release/deadline bila tersedia;
- availability state dan pesan prerequisite.

Tidak ada upload, submit, completion checkbox, score, rubric, feedback, atau mentor action. Assignment summary terpisah dari progress summary.

## 9. Feature flag behavior

Flag baru:

`INTERNSHIP_ASSIGNMENTS_ENABLED=false`

Behavior:

- `INTERNSHIP_ENABLED=false`: seluruh Internship tetap unavailable;
- Internship on, Assignment off: seluruh Phase 1B tetap berjalan, endpoint Assignment tidak dipasang, section Assignment tersembunyi;
- keduanya on: read API, Training admin extension, workflow guard, dan participant Assignment section aktif.

Training route juga membaca kombinasi kedua flag sehingga code deployment sebelum migration tidak menyentuh kolom/table Phase 2A selama flag tetap off.

## 10. Existing Training admin changes

Admin BCL Training Plan tetap menjadi source operasional. Modal `Practice Task` untuk Internship ditambah field:

- available date;
- participant visibility;
- required deliverable;
- prerequisite canonical IDs;
- reference canonical IDs.

Server memvalidasi controlled type/status/visibility, active canonical content, published frozen-path quiz, topic ownership, dan menyimpan classwork + links dalam satu transaction. Existing free-text linked resource fields tidak digunakan oleh Internship participant projection.

Karena generic Training sudah mempunyai submission/review workflow dari fase lama, Phase 2A menambahkan server-side guard: semua submission/review endpoint untuk Internship mengembalikan `INTERNSHIP_SUBMISSION_NOT_AVAILABLE` ketika Phase 2A aktif. Tombol submission juga disembunyikan pada My Training dan Admin Training Plan untuk Internship. Non-Internship Training tetap memakai behavior existing.

## 11. Files added

- `backend/scripts/20260925-internship-phase2a.sql`
- `backend/scripts/20260925-internship-phase2a-rollback.sql`
- `backend/scripts/run-internship-phase2a-migration.js`
- `backend/tests/internship-phase2a.test.js`
- `docs/BCL_INTERNSHIP_PHASE_2A_IMPLEMENTATION_REPORT_20260925.md`

## 12. Files modified

- `.env.example`
- `package.json`
- `backend/server.js`
- `backend/features/internshipFeature.js`
- `backend/routes/internshipRoutes.js`
- `backend/routes/trainingBatchRoutes.js`
- `backend/repositories/internshipRepository.js`
- `backend/services/internshipProgramService.js`
- `BC-Learning-Main/elearning-assets/internship.html`
- `BC-Learning-Main/elearning-assets/js/internship.js`
- `BC-Learning-Main/elearning-assets/css/internship.css`
- `BC-Learning-Main/elearning-assets/js/my-training.js`
- `BC-Learning-Main/pages/sub/adminbcl.js`
- `scripts/serve-internship-ui-fixture.js`

## 13. Tests dan hasil

### Automated

- `npm run test:internship`: **41 passed, 0 failed**.
- `node --test backend/tests/p0-1-security.test.js backend/tests/p0-2-auth.test.js`: **2 passed, 0 failed**.
- JavaScript syntax checks untuk seluruh file JS Phase 2A: **passed**.
- `npm run migrate:internship:assignments:validate`: **passed**, schema tervalidasi dan database kembali ke state awal.
- `node scripts/smoke-elearning-theory.js`: **passed**.
- `git diff --check`: **passed**, hanya warning normalisasi LF/CRLF workspace.

Coverage Phase 2A mencakup feature-off compatibility, canonical membership, wrong-batch ownership, draft/archived filtering, published response, canonical content/quiz references, invalid-reference fail closed, locked→available derivation, upcoming, closed policy, localStorage independence, unchanged learning progress, native-path filtering, URL tampering, migration contract, no submission UI, Training workflow guard, serta keberadaan core BCL surfaces.

### Known existing learning smoke failure

`npm run smoke:unified-learning` masih gagal pada data health existing:

- optional relation `learning_materials` tidak tersedia;
- SME decision count `337` tidak sama dengan canonical content count `371`.

Phase 2A tidak mengubah catalog sources, SME queue, atau registry population.

## 14. Screenshot dan UI validation

- `output/playwright/internship-phase2a/internship-assignments-desktop.png`
- `output/playwright/internship-phase2a/internship-assignments-mobile.png`

Playwright validation:

- dua assignment tampil dengan state `Tersedia` dan `Belum Terbuka`;
- progress learning tetap `25%` dari fixture Phase 1;
- zero submission/upload control;
- canonical prerequisite links tersedia;
- feature-enabled browser console: **0 errors, 0 warnings**;
- mobile viewport 390 px: document width 390 px, tanpa horizontal overflow;
- feature-off: learning path tetap tiga module dan assignment section tersembunyi; request endpoint menghasilkan expected 404 karena route tidak dipasang.

## 15. Known limitations

1. Migration belum di-apply dan live endpoint belum diuji terhadap batch/data produksi; hanya transactional validation yang dilakukan.
2. Admin UI Phase 2A mendukung create; update contract tersedia pada existing Training PUT API tetapi belum ada edit modal baru.
3. Invalid manual database mapping fail closed dan assignment tidak dikirim; admin API normalnya mencegah mapping ini sejak awal.
4. Due date hanya menutup otomatis bila policy `closeAtDueDate=true`; selain itu operator harus memakai explicit `closed`.
5. Assignment belum mempunyai completion/submission state dan tidak berkontribusi pada overall progress—disengaja untuk Phase 2A.
6. Unified Learning `337/371` data-health mismatch tetap menjadi blocker terpisah untuk full learning smoke.

## 16. Regression findings

Tidak ditemukan regresi Phase 2A pada Phase 1 Internship projection, auth/security tests, Elearning theory smoke, responsive participant UI, atau feature-off browser behavior.

Perubahan generic Training dibatasi oleh flag dan `program_type='internship'`. Submission/review Training non-Internship tidak diubah. Saat flag off, Training Plan dan Phase 1B memakai behavior existing.

## 17. Recommendation for Phase 2B

Phase 2B belum aman dimulai pada environment runtime sampai:

1. migration Phase 1A dan 2A di-apply melalui change window yang disetujui;
2. live smoke mengonfirmasi participant assignment API, canonical links, dan feature rollback;
3. Phase 2A mendapat UX/data-contract acceptance;
4. evidence storage, file/path policy, submission versioning, and authorization matrix Phase 2B disepakati terlebih dahulu.

Setelah gate tersebut lulus, Phase 2B dapat memakai `classwork_items` dan assignment ID ini tanpa mengubah learning completion atau availability contract Phase 2A.
