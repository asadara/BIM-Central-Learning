# BCL Internship Program — Phase 0 Integration Audit

**Tanggal audit:** 24 September 2026
**Repository baseline:** commit `b298380`
**Scope:** audit statis repository dan dokumen arsitektur; tidak mengubah runtime, schema, data, atau production behavior.

## A. Executive Summary

BCL sudah memiliki sebagian besar building block operasional yang dibutuhkan Internship: canonical user di PostgreSQL, learning path, content/activity tracking, verified quiz attempts, dashboard, batch enrollment, classwork, submission, review, evaluation, dan attendance. Karena itu, Internship seharusnya dibangun sebagai **read/aggregation layer di atas sistem tersebut**, bukan LMS atau progress engine baru.

Namun, repository belum siap langsung diberi label “Internship” tanpa kontrak integrasi tambahan. Tiga blocker utama adalah:

1. **Content identity belum konsisten.** Learning path lama memakai raw material/page/video ID, activity memakai `module_id`, sementara unified catalog sudah memperkenalkan canonical `content_id` seperti `video:<sourceId>`, `pdf:<sourceId>`, dan `page:<slug>` tetapi feature flag masih default `false`.
2. **Learning state masih terbelah di UI.** Server telah menghitung progress dari evidence, tetapi beberapa tampilan masih mengambil nilai maksimum server vs marker `localStorage`; readiness practice/exam juga masih membaca history lokal.
3. **Training/Classwork belum benar-benar terhubung ke learning content.** Field `linked_resource_type/id` tersedia, tetapi bersifat free text, tidak divalidasi ke catalog, tidak menjadi tautan participant, dan tidak dipakai untuk menghitung completion program.

Keputusan arsitektur yang direkomendasikan:

- Reuse `training_batches` sebagai **program run/cohort** dan `batch_members` sebagai **enrollment** untuk Phase 1.
- Reuse existing learning path dan existing learning state; jangan membuat tabel “internship content completion”.
- Bentuk progress Internship sebagai **derived read model** dari content completion dan verified quiz attempts yang sudah ada.
- Gunakan canonical user ID `public.users.id` pada semua relasi.
- Tunda Assignment/Evidence dan Mentor Review dari MVP sampai content identity, server-authoritative progress, visibility, dan evidence security dibereskan.

**Rekomendasi gate:** approve desain Phase 1 hanya setelah kontrak canonical content ID dan aturan authoritative completion disepakati. Jangan mengimplementasikan UI final lebih dulu.

## B. Current Architecture

### B.1 Architecture map

```text
Static frontend (BC-Learning-Main)
├─ Global Training menu
│  ├─ Pusat Belajar              /pages/elearning.html
│  ├─ Jalur Belajar              /elearning-assets/dashboard.html
│  └─ BCL Scoring                external
├─ E-learning workspace
│  ├─ My Progress                dashboard.html
│  ├─ My Training                my-training.html
│  ├─ Courses / Learning Path    courses.html
│  ├─ Practice / Exams / Quiz History / Certification
│  └─ PDF reader and video players
└─ Projects Explorer             /pages/projects.html
                 │ Bearer token / JSON
                 ▼
Express backend (backend/server.js)
├─ Auth/session services ─────────────── PostgreSQL users + auth sessions
├─ Learning path service ─────────────── learning-paths.json (current path source)
├─ Content sources ───────────────────── filesystem / JSON / optional PostgreSQL / UNC
├─ Unified learning catalog (flag off) ─ canonical content registry and mappings
├─ Activity / quiz / progress APIs ───── PostgreSQL learning state
├─ Training batch APIs ───────────────── batch, enrollment, classwork, review, attendance
└─ Project catalog APIs ──────────────── internal/UNC project sources and cache
```

### B.2 Navigation

- Global navbar is duplicated in `BC-Learning-Main/components/navbar.html` and `BC-Learning-Main/elearning-assets/components/navbar.html`, then injected by component loaders. Keduanya harus tetap sinkron.
- Kelompok Training saat ini berisi Pusat Belajar, Jalur Belajar, dan link eksternal BCL Scoring. Belum ada Magang/Internship.
- `My Training` sudah ada di sidebar e-learning, bukan di global Training dropdown.
- Kandidat lokasi submenu baru adalah global Training dropdown, dengan entry tambahan di e-learning sidebar hanya bila informasi arsitektur/UX memang mengharuskannya.

### B.3 Authentication and canonical identity

- `public.users.id` adalah canonical user identity. Helper `backend/utils/canonicalIdentity.js` menormalisasi ID dan menolak identitas request yang konflik.
- Local password dan Google authentication dipetakan ke canonical user yang sama melalui `backend/services/authRuntime.js` dan route auth.
- JWT memakai issuer/audience internal, expiry, auth version, serta validasi session PostgreSQL pada setiap protected request. Admin session memakai secure HTTP-only cookie terpisah.
- Browser menyimpan bearer token dan projection user di `localStorage`, tetapi itu bukan sumber identitas authoritative. Endpoint terlindungi mengambil principal yang telah divalidasi server.
- Legacy JSON user read masih ada untuk compatibility, tetapi write legacy identity dinonaktifkan. Internship tidak boleh memperkenalkan identity table atau user key baru.

### B.4 Learning/content structure and identifiers

- Terdapat tujuh learning path aktif di `backend/elearning/learning-paths.json`, dinormalisasi oleh `backend/elearning/services/learningPathService.js`, lalu disajikan sebagai path → module → material/practice/exam/certificate.
- Content berasal dari beberapa sumber: video filesystem, PDF/material service, page routes, static question bank, optional PostgreSQL, dan internal UNC/manual-book source.
- Identifier existing tidak seragam: path ID, module ID, material ID, quiz ID, file/source ID, page slug, URL, dan `module_id` activity.
- `backend/services/unifiedLearningCatalogService.js` sudah menyediakan canonical namespace `video:`, `pdf:`, dan `page:` serta menolak duplikasi. Route `/api/learning/catalog` tersedia hanya bila `UNIFIED_LEARNING_CATALOG_ENABLED=true`; default repository masih `false`.
- Migration unified learning sudah mendefinisikan registry, versioned paths, module-content mappings, equivalence, dan `user_content_progress`. Dokumen repository mencatat migration pernah diterapkan di lingkungan lokal, tetapi audit ini tidak memverifikasi kondisi production database.
- `user_content_progress` belum menjadi sumber state runtime. Jangan mengaktifkannya sebagai writer kedua tanpa migration/cutover plan.

### B.5 Progress and material completion

- `learning_activity_events` menyimpan event `opened/completed` per canonical user, `module_id`, dan tipe `video/page/pdf`.
- Video lokal dianggap selesai sekitar 90%; PDF sekitar 95%. YouTube official player mengirim completion saat playback selesai.
- `/api/elearning/progress/me` dan `/sync` menghitung ulang aggregate server dari:
  - completion di `learning_activity_events`;
  - verified attempt di `learning_attempts`;
  - certificate di `user_certificates`.
- Payload snapshot client diabaikan oleh server. Ini sudah merupakan boundary yang benar.
- Masalah tersisa: dashboard masih dapat menampilkan maksimum nilai server dan marker lokal; official path readiness practice/exam masih membaca `localStorage`. Hasil antar-browser dapat berbeda walaupun server state sama.

### B.6 Quiz state and result

- Quiz registry berisi tiga quiz teori dan satu exam di `backend/elearning/data/quizzes.json`; submit diverifikasi server terhadap registered question bank dan score dihitung ulang.
- Attempt tersimpan di `learning_attempts`. Attempt yang tidak terdaftar tidak boleh menjadi pass authoritative.
- Stats/history mengharuskan authenticated self atau admin. Certificate issuance memerlukan verified result.
- Practice dan exam UI juga menulis history lokal sebelum/bersamaan dengan server sync. History lokal tidak boleh dipakai oleh Internship sebagai completion authority.
- Sebagian question/answer material tersedia sebagai static client assets. Mekanisme ini cukup untuk learning quiz, tetapi tidak layak diasumsikan aman untuk formal/high-stakes exam. Formal Exam tetap di luar Online/MVP.

### B.7 My Progress, Learning Dashboard, and Elearning

- `/elearning-assets/dashboard.html` menggabungkan server progress, quiz stats/history, certificates, activity summary, dan `/api/training/my-batches`.
- `/pages/elearning.html` adalah discovery/catalog surface; `/elearning-assets/courses.html` adalah learning-path surface.
- Dashboard dapat direuse sebagai pola visual dan source integration, tetapi formula progress Internship tidak boleh menyalin logic client yang mencampur server dan local marker.
- `my-training.html` sudah membuktikan participant experience untuk batch, training plan, submission, dan feedback. Ia merupakan starting point yang lebih dekat daripada membuat portal baru.

### B.8 Training, assignment, submission, and review

Route `/api/training` sudah memiliki model berikut, dibuat saat runtime oleh `trainingBatchRoutes.js`:

| Konsep target | Existing implementation | Kondisi |
|---|---|---|
| Program/cohort | `training_batches` | Reusable; `learning_path_id` masih free text |
| Enrollment/role | `batch_members` | Reusable; participant, mentor, reviewer, admin, observer |
| Roadmap grouping | `batch_topics` | Reusable |
| Learning/assignment item | `classwork_items` | Partial; linked resource belum canonical |
| Submission | `assignment_submissions` | Reusable untuk phase berikutnya |
| Evidence | `submission_files` | Partial; hanya path/URL metadata, belum managed upload |
| Rubric/review | `review_criteria`, `review_scores`, `submission_comments` | Reusable dengan permission review |
| Summary | `batch_evaluations`, readiness endpoints | Partial; belum menggabungkan learning completion |
| Attendance | `attendance_sessions`, `attendance_records` | Reusable bila dibutuhkan |

Participant training-plan saat ini menerima item tanpa filter status yang jelas di query response. UI juga mengabaikan `linked_resource_id`; akibatnya content reference hanya metadata admin, bukan link belajar yang hidup.

Schema Training dibuat melalui `CREATE TABLE IF NOT EXISTS` pada startup route, bukan migration terpisah. Ini meningkatkan risiko drift dan menyulitkan rollback/audit schema.

### B.9 Projects

- Projects Explorer memindai project source internal/UNC, menyimpan cache metadata/media, dan menyediakan `/api/years`, `/api/projects/:year`, serta `/api/project-media/:year/:project`.
- Route catalog/read dan bahkan refresh-cache tidak memasang middleware auth eksplisit di file route. Perimeter file lain di server tidak otomatis menggantikan object-level access control untuk catalog.
- Projects dapat menjadi controlled selector/reference di internal BCL, tetapi **bukan evidence store** dan bukan sumber yang boleh diproyeksikan langsung ke Online.
- Native BIM files, internal paths, project identifiers, dan confidential evidence harus dianggap internal-only sampai klasifikasi dan bridge tersedia.

### B.10 Storage/state authority

| State | Current authoritative source | Browser/local role | Keputusan untuk Internship |
|---|---|---|---|
| Identity | `public.users` + validated auth session | Token/cache only | Reuse canonical user ID |
| Material completion | `learning_activity_events` | Optimistic/cache markers | Read server only |
| Quiz result | verified `learning_attempts` | Draft/history cache | Read verified server attempts only |
| Certificate | `user_certificates` | Display cache | Read server only |
| Aggregate learning progress | derived server evidence + `user_progress` | UI fallback currently exists | Derive server-side |
| Batch enrollment | `batch_members` | Display cache | Reuse |
| Assignment/submission/review | Training PostgreSQL tables | Form state only | Reuse in Phases 2–3 |
| Reader position/preferences | `localStorage` | Appropriate local UX state | May remain local; not completion authority |

## C. Reusable Existing Components

| Area | Existing asset | Reuse recommendation |
|---|---|---|
| Navigation | `components/navbar.html`, e-learning navbar/sidebar loaders | Add one link after Phase 1 route is ready; update both navbar fragments |
| Auth | `canonicalIdentity.js`, `authRuntime.js`, `utils/auth.js` | Use unchanged; all Internship APIs require validated user |
| Enrollment | `training_batches`, `batch_members`, `/api/training/my-batches` | Use as program run and enrollment |
| Learning path | `learning-paths.json`, `learningPathService.js`, module routes | Reference a selected existing path; do not copy materials |
| Canonical content | `unifiedLearningCatalogService.js`, registry/mapping migration | Make this the reference contract after readiness gate |
| Content completion | activity routes and `learning_activity_events` | Reuse evidence; normalize raw IDs to canonical content IDs |
| Quiz | quiz controller/routes and `learning_attempts` | Reuse verified attempts; never trust local history |
| Progress | progress routes and server aggregation pattern | Reuse pattern; create Internship-specific derived projection, not writer |
| Participant UI | `my-training.html/js`, `dashboard.html/js`, `courses.html/js` | Reuse layout/data-fetching patterns; do not copy mixed-state formulas |
| Roadmap/classwork | `batch_topics`, `classwork_items`, training-plan route | Reuse after published-item filter and canonical reference validation |
| Evidence/review | submissions, files, criteria, scores, comments | Reuse in later phases after secure evidence design |
| Admin | `adminbcl.html/js` Training Batches section | Extend instead of creating a second administration app |
| Projects | project catalog service | Optional internal lookup only; never direct Online/evidence exposure |

## D. Gap Analysis

| Capability | Gap | Minimal resolution |
|---|---|---|
| Internship Program | Tidak ada explicit type/template dan lifecycle Internship | Phase 1: mark a `training_batch` as `program_type='internship'`; add separate reusable program template only when multi-cohort need is proven |
| Enrollment | Model tersedia, tetapi belum ada Internship-scoped participant API/UI | Filter existing batch membership by program type and enforce batch access |
| Learning Path | `learning_path_id` free text; legacy JSON and DB path model belum dipertemukan | Validate against one approved/versioned path; return immutable path/version reference |
| Existing Content Reference | Multiple ID schemes; linked resource free text | Canonical `content_id` resolver backed by registry; reject unknown/duplicate references |
| Assignment | Model tersedia tetapi item type dan learning link bercampur | Keep learning reference and assignment semantically separate; reuse classwork only for assignment/action |
| Submission/Evidence | Path/URL metadata only; no managed upload, scan, classification, retention | Phase 2 secure evidence contract; internal-only initially; no raw UNC path in participant/API response |
| Mentor Review | Review tables/roles tersedia; permission policy broad and UI admin-centric | Define mentor assignment/scope; test object-level authorization; decide observer write rights |
| Program Progress | Tidak ada aggregate yang joins path requirements, activities, verified quiz, and assignments | Server-side derived projection with explicit weights/rules; no duplicate completion rows |
| Visibility | Draft/archived classwork dapat ikut terbaca participant | Enforce published status server-side before Phase 1 use |
| Quality/migrations | Training schema runtime-created; no focused automated test suite found | Move schema to migration and add auth/state/regression tests before extending workflow |

## E. Proposed Minimal Data Model

### E.1 Phase 1 recommendation

Jangan membuat enam tabel baru sesuai nama konsep. Gunakan mapping minimal berikut:

```text
Internship Program Run  = training_batches
Participant Enrollment = batch_members
Learning Path           = existing published/versioned learning path
Learning Path Item      = existing module_content_mappings / canonical content reference
Learning Completion     = existing activity/verified quiz state
Program Progress        = derived view/service response (not a second state table)
```

Minimal schema delta yang layak dipertimbangkan:

- `training_batches.program_type` dengan controlled value, default mempertahankan existing behavior; `internship` menjadi salah satu value.
- Canonical/versioned learning-path reference pada batch. Prefer FK ke published `learning_path_versions`; selama migration, legacy `learning_path_id` dapat dibaca lewat adapter, bukan dijadikan authority baru.
- Bila perubahan kolom existing terlalu berisiko, satu mapping table tipis `internship_batch_config(batch_id PK/FK, learning_path_version_id FK, policy_json, created_at, updated_at)` dapat menjadi compatibility seam. Ia tidak menyimpan materi atau completion.

Tidak diperlukan di Phase 1:

- `InternshipContent`, salinan module/material, atau salinan quiz;
- `InternshipContentProgress`;
- user/enrollment identity terpisah;
- assignment/submission/review table baru.

### E.2 Later phases

- Reuse `classwork_items` sebagai Assignment, tetapi require `item_type='practice_task'` dan pisahkan prerequisite/learning reference dari assignment deliverable.
- Reuse `assignment_submissions`, `submission_files`, `review_criteria`, `review_scores`, dan `submission_comments`.
- Tambahkan storage object/evidence metadata hanya bila managed upload disetujui: opaque object ID, classification, owner, MIME/size/hash, malware-scan status, retention, dan access policy. Jangan menyimpan client-visible UNC path.
- Buat reusable `internship_programs`/program-template table hanya bila satu definisi program harus dipakai oleh beberapa cohort. Sampai kebutuhan itu nyata, batch adalah boundary terkecil.

### E.3 Progress rule

Untuk setiap required learning-path item:

```text
content/page/video/pdf status = existing authoritative content completion
quiz/exam status              = existing verified learning_attempt
assignment status             = existing submission/review state (Phase 2+)
overall program progress      = server-derived result of versioned program policy
```

Progress response boleh dicache, tetapi cache harus rebuildable dan tidak boleh menjadi sumber completion kedua.

## F. Proposed API / Services

Gunakan namespace Training agar reuse dan permission boundary terlihat jelas:

| Endpoint | Phase | Purpose |
|---|---:|---|
| `GET /api/training/internships/me` | 1 | Enrollment Internship milik principal login |
| `GET /api/training/internships/:batchId` | 1 | Program header, enrollment role, roadmap, selected path/version |
| `GET /api/training/internships/:batchId/learning-path` | 1 | Canonical content references dan server-derived item status |
| `GET /api/training/internships/:batchId/progress` | 1 | Overall/module progress dengan provenance dan calculation version |
| Existing `/api/learning/catalog/:contentId` | 1 | Resolve approved content reference/href setelah feature readiness |
| Existing training-plan/submission routes | 2 | Assignment dan submission; jangan diduplikasi |
| Existing review routes | 3 | Criteria, scoring, feedback; tambahkan scoped mentor policy |
| `GET /api/training/internships/:batchId/summary` | 4 | Participant/mentor summary sesuai role |

Service boundaries yang disarankan:

- `internshipProgramService`: composition batch, enrollment, path, and policy.
- `learningContentReferenceService`: canonical ID validation and safe navigation target; dapat membungkus unified catalog.
- `internshipProgressService`: read-only join/aggregation atas existing activity, verified attempt, dan kelak assignment state.
- `evidenceAccessService` baru hanya pada Phase 2 bila managed evidence benar-benar diperlukan.

Semua endpoint harus:

- mengambil `user_id` dari authenticated principal, bukan payload;
- melakukan batch membership/object-level authorization;
- mengembalikan canonical `contentId` dan resolved safe route, bukan membiarkan client merakit path;
- menyembunyikan draft/archived items dan internal filesystem paths;
- mendeklarasikan provenance status (`activity`, `verified-quiz`, `submission`) agar debugging konsisten.

## G. Files Likely Affected

### Existing files

- Navigation/components:
  - `BC-Learning-Main/components/navbar.html`
  - `BC-Learning-Main/elearning-assets/components/navbar.html`
  - `BC-Learning-Main/elearning-assets/components/sidebar.html`
  - `BC-Learning-Main/js/loadComponents.js`
  - `BC-Learning-Main/elearning-assets/js/component-loader.js`
- Participant/dashboard patterns:
  - `BC-Learning-Main/elearning-assets/my-training.html`
  - `BC-Learning-Main/elearning-assets/js/my-training.js`
  - `BC-Learning-Main/elearning-assets/dashboard.html`
  - `BC-Learning-Main/elearning-assets/js/dashboard.js`
  - `BC-Learning-Main/elearning-assets/js/courses.js`
- Backend composition/security:
  - `backend/server.js`
  - `backend/routes/trainingBatchRoutes.js`
  - `backend/utils/canonicalIdentity.js`
  - `backend/utils/auth.js`
- Learning/content/progress:
  - `backend/elearning/learning-paths.json`
  - `backend/elearning/services/learningPathService.js`
  - `backend/elearning/routes/activityRoutes.js`
  - `backend/elearning/routes/progressRoutes.js`
  - `backend/elearning/controllers/quizController.js`
  - `backend/services/unifiedLearningCatalogService.js`
  - `backend/routes/unifiedLearningRoutes.js`
  - `backend/scripts/postgres-create-unified-learning.sql`
- Admin workflow:
  - `BC-Learning-Main/pages/sub/adminbcl.html`
  - `BC-Learning-Main/pages/sub/adminbcl.js`
  - `BC-Learning-Main/pages/sub/adminbcl-workspace.js`
- Compatibility/security references:
  - `.env.example`
  - `docs/architecture/BCL_Online_Architecture_Roadmap_Codex.md`

### Likely new files in implementation phases

- One participant Internship page/controller pair, preferably adjacent to My Training.
- Small route/controller/service modules for Internship aggregation; avoid growing the monolithic training route.
- Versioned database migration for program type/config and any canonical reference changes.
- Focused API/service tests for authorization, identity, content resolution, progress derivation, and regression.

## H. Implementation Roadmap

### Pre-implementation approval gate

1. Ratify canonical content ID and legacy-ID resolution contract.
2. Select one existing learning path and freeze/version its required items for the pilot.
3. Define authoritative completion per content type and remove local-state dependence from Internship calculations.
4. Define participant/mentor/admin access matrix and published-item visibility.
5. Add migration and automated test strategy before touching navigation.

### Phase 1 — Internship Learning Path MVP

- Add program-type/config seam to existing batch.
- Build read-only aggregate service over enrollment, approved learning path, content registry, activity, and verified quiz attempts.
- Build participant header, roadmap, learning links, module status, and overall progress.
- Add navigation entry only when authenticated route and access-denied/empty/error states work.
- Do not alter existing Courses/My Progress formulas as an incidental side effect.

### Phase 2 — Assignment & Evidence

- Reuse topic/classwork/submission tables and endpoints.
- Enforce published visibility and canonical prerequisite references.
- Design managed evidence storage, classification, access, retention, and audit trail; remove client-visible raw path semantics.
- Keep assignment completion distinct from content completion.

### Phase 3 — Mentor Review

- Reuse criteria, score, comment, and feedback structures.
- Bind mentors/reviewers to explicit cohort/participant scope.
- Add authorization matrix tests, internal-note separation, and immutable review/audit timestamps.

### Phase 4 — Program Progress / Summary

- Extend progress calculation with versioned assignment/review rules.
- Add participant and mentor summaries without duplicating underlying states.
- Introduce projections/cache only with rebuild and reconciliation support.
- Evaluate Online projection only after learning core and Data Bridge gates are satisfied.

## I. Risks & Regression

| Priority | Risk | Impact | Required control |
|---|---|---|---|
| Critical | Raw ID vs canonical content ID mismatch | Completion tidak terhitung atau dihitung ke materi salah | Canonical registry + deterministic resolver + fixture tests |
| Critical | Internship creates separate completion state | Dua source of truth | Derived read model only; prohibit Internship completion writes |
| High | `localStorage` overrides/inflates UI | Cross-device inconsistency | Server-only Internship status; local state hanya cache/UX |
| High | Legacy practice/exam local history | False readiness | Verified attempts only |
| High | Draft/archived classwork exposed | Participant sees unfinished content | Server-side status filter and tests |
| High | Broad reviewer/observer permissions | Unauthorized score/feedback | Explicit role-action matrix and object-level checks |
| High | UNC/path/URL evidence exposure | Confidential project/storage leak | Opaque object IDs, classified storage, no raw path response |
| High | Project catalog endpoints lack explicit auth | Project metadata/cache operation exposure | Separate security remediation before any Internship integration |
| High | Runtime DDL for Training | Environment drift, uncertain rollback | Versioned migrations and schema check |
| Medium | Duplicated navbar fragments | Inconsistent menu | Single checklist/test or future component consolidation |
| Medium | Existing Courses/Dashboard behavior changes | Regression to current learning users | Add-only aggregate API; regression tests; feature flag |
| Medium | Catalog flags currently off | Hidden dependency/production mismatch | Preflight catalog and DB path readiness; staged enablement |
| Medium | Static quiz answers/banks | Unsuitable formal assessment | Keep formal exam internal/out of MVP; separate hardened design |
| Medium | No focused Training API tests found | Authorization/state regressions | Add contract/integration tests before feature extension |

Regression suite minimum:

- same canonical user through local/Google login resolves same enrollment;
- completing one BCL item changes existing progress and Internship projection consistently, with no duplicate row;
- same result after logout/login and in another browser;
- quiz pass/fail derives only from verified server attempt;
- non-member cannot read batch; participant cannot see draft/internal comments; mentor scope is enforced;
- invalid/unknown content ID is rejected;
- no API response includes UNC/native project path;
- existing Pusat Belajar, Courses, My Progress, My Training, certificates, and Training admin remain unchanged when Internship feature flag is off.

### Compatibility with BCL Online roadmap

Desain ini kompatibel bila aturan berikut dikunci:

- Internal BCL tetap authoritative untuk operational enrollment, internal learning state, assignment/review, dan confidential evidence.
- Online tidak memakai internal token/session, tidak mengakses production database langsung, dan tidak memiliki inbound path ke Internal.
- Online hanya menerima explicitly approved projection melalui Data Bridge; data diperlakukan sebagai data, bukan instruction.
- Public learning/profile/progress dapat menjadi Online-native sesuai roadmap, tetapi My Training/Internship extended workflows menunggu fase roadmap yang relevan.
- Formal exam, project BIM/native files, UNC path, internal report, dan evidence rahasia tidak diproyeksikan.
- Jika Internship kelak tersedia Online, content reference harus memakai portable canonical ID; target URL/storage diselesaikan per environment, bukan menyalin path internal.

## J. Recommended Phase 1 Scope

### In scope

- Submenu **Training → Magang / Internship** setelah route siap.
- Authenticated participant view.
- Program/cohort header: title, code, dates, status, mentor display bila aman.
- Roadmap/module outline dari satu approved existing learning path.
- Link ke existing BCL content melalui canonical reference.
- Per-item/module status dari authoritative activity dan verified quiz state.
- Overall program progress yang dihitung server-side dan read-only.
- Empty, unauthorized, unavailable-content, and error states.
- Feature flag, migration, and automated regression coverage.

### Explicitly out of scope

- Content copy khusus Internship.
- Progress/completion engine atau user identity baru.
- Assignment upload, evidence storage, mentor review, scoring, attendance, final evaluation.
- Projects Explorer integration atau pemilihan native project files.
- Formal exam changes.
- BCL Online exposure/Data Bridge changes.
- Refactor besar existing Courses/My Progress/Training admin.

### Phase 1 acceptance criteria

1. Satu existing content hanya memiliki satu canonical reference dan satu authoritative completion.
2. Completion yang dibuat melalui normal BCL flow langsung terbaca pada Internship projection.
3. Internship tidak menulis content/quiz completion baru.
4. Result tetap sama lintas browser setelah login karena tidak bergantung pada local history.
5. Hanya enrolled participant dan authorized staff yang dapat membaca program.
6. Tidak ada draft, internal comment, filesystem/UNC path, atau confidential project metadata pada response participant.
7. Menonaktifkan feature flag mengembalikan existing BCL behavior tanpa perubahan.

**Stop point:** dokumen ini adalah output Phase 0. Tidak ada implementasi source code atau production behavior yang dilakukan. Implementasi menunggu approval atas scope, identity/content contract, progress authority, dan security gates di atas.
