# BCL Internship Program — Phase 5A Pilot Configuration Audit & Requirement Manifest Freeze

Tanggal audit: 25 September 2026
Manifest: `INT-BIM-PILOT-MANIFEST-v1`
Status teknis: **NO-GO / BLOCKED**
Scope: konfigurasi dan audit saja; tidak ada aktivasi pilot, enrollment, evidence, closeout, perubahan feature flag, atau migration `--apply`.

## A. Executive Summary

Phase 5A membekukan hasil audit aktual, bukan program ideal yang belum tersedia. Denominator yang sah saat ini adalah satu learning item wajib, nol quiz wajib, dan nol assignment wajib. Satu `practice_task` yang ditemukan di database adalah task smoke pada batch lain; task itu diklasifikasikan `EXCLUDE`, walaupun berstatus `published`.

Bootstrap Phase 4B telah diperbaiki. Migration backfill hanya mempertahankan entry assignment legacy yang sudah memiliki `assignmentId`, klasifikasi `required|optional`, `label`, dan `definitionDigest`. Entry yang tidak diklasifikasikan tidak dibuat wajib dan menghasilkan warning. Script konfigurasi juga hanya mengambil assignment dari manifest ber-checksum; tidak lagi menyimpulkan requirement dari `visible`, `published`, `closed`, atau `practice_task`.

Manifest v1 adalah immutable audit baseline dengan SHA-256 `a58214620fe1827e3d8a0ede159da5897194347312528e60e9569fbd49620433`. Perubahan denominator berikutnya harus menjadi manifest/policy version baru. Manifest ini **belum layak diaktivasi** karena belum ada assignment wajib yang executable, record batch/policy belum ada di database saat ini, canonical participant/mentor belum dipilih, dan tanggal belum ditetapkan.

## B. Pilot Cohort Definition

| Field | Frozen target | Kondisi aktual |
|---|---|---|
| Program code | `INT-BIM-2026-PILOT` | Stable, non-person-specific |
| Program title | BCL BIM Internship Pilot | Frozen target |
| Program type | `internship` | Target; kolom `program_type` belum deployed |
| Batch ID | `int-bim-2026-pilot` | Belum ada di database |
| Status | `configuration_pending` | Tidak aktif |
| Start/end | `null` / `null` | Required operational input |
| Manifest | `INT-BIM-PILOT-MANIFEST-v1` | Frozen repository artifact |

Tidak ada nama orang atau ID rekaan dalam logic maupun manifest.

## C. Policy Version

Target policy ID adalah `INT-BIM-PILOT-POLICY-v1`, version 1, expected status `frozen`, contract `internship-completion-v1`. Ini merupakan target identity untuk Phase 5B, bukan klaim bahwa record sudah ada. Audit database membuktikan `internship_program_policy_versions` dan `internship_batch_config` belum deployed.

Policy payload builder mempertahankan keputusan Phase 4A:

- learning wajib berasal dari mapping published path version yang dicocokkan manifest;
- quiz wajib berasal dari frozen quiz manifest dan verified server attempt;
- assignment wajib hanya berasal dari frozen assignment manifest;
- explicit reviewer `accepted` adalah authority, tanpa score threshold baru;
- latest revision controls; historical revisions tidak menambah denominator;
- `attendanceGate=false`, `finalEvaluationGate=false`;
- `closeoutRequired=true`;
- certificate eligible hanya setelah explicit closeout.

Relasi target tetap satu arah: cohort → `internship_batch_config` → frozen policy version → manifest version/digest. Tidak dibuat authority kedua.

## D. Learning Path Version

| Field | Value | Verification |
|---|---|---|
| Path ID | `bim-mindset-foundation` | Ada di source catalog dan Phase 1A seed |
| Version ID | `6a6d1f8a-67cf-4dcb-b4e9-c4a2be0f1a01` | Stable Phase 1A ID |
| Version | 1 | Published target |
| Contract | `internship-learning-path-v1` | Seed definition |
| Assessments | `[]` | Tidak ada quiz yang dibekukan |
| Runtime DB | Not deployed | Repository source resolves; database belum berisi pilot version |

Tidak ada salinan konten di manifest. Manifest hanya menyimpan canonical reference, route aman, source version, dan klasifikasi.

## E. Learning Requirement Manifest

| contentId | Title | Type | Stage | Class | Quiz | Route | Availability | Validation | Rationale |
|---|---|---|---|---|---|---|---|---|---|
| `page:bim-mindset` | Konsep BIM Mindset | page | 01 Foundation | REQUIRED | none | `/pages/bim-mindset.html` | available | validated | Mapping Phase 1A published path secara eksplisit `required`, `approved`, dan canonical content `active` |

Optional/reference/excluded learning untuk v1: **tidak ada**. Konten katalog lain tidak otomatis menjadi bagian pilot hanya karena tersedia, berurutan, atau memiliki label required dalam learning path lain.

Authority learning adalah published mapping pada path version, dengan manifest sebagai exact frozen audit mirror. Validator menolak perbedaan set required antara keduanya.

## F. Quiz Requirement Manifest

| Required pass | Optional | Excluded | Rationale |
|---:|---:|---:|---|
| 0 | 0 | 0 | Frozen path definition memiliki `assessments: []`; exam katalog tidak otomatis masuk pilot |

Tidak ada formal/high-stakes exam yang dibuat wajib. Jika quiz ditambahkan nanti, manifest dan policy baru harus memuat canonical relation, pass rule, availability, serta verified server source. Client/localStorage tidak dapat memenuhi requirement.

## G. Assignment Requirement Manifest

| Assignment | Source batch/topic | State/date | Deliverable / links / rubric | Classification | Rationale |
|---|---|---|---|---|---|
| `work_1783073999842_ykhvcd9e` — Smoke Practice Task | `batch_1783073999784_0xdq8qmk` / `topic_1783073999824_td7gnjic` | published; due TBD; visibility column unavailable | no deliverable; no canonical links schema; rubric missing | **EXCLUDE** | Generic smoke data, wrong batch, no approved competency mapping, no executable brief |

Required assignments: **0**. Optional assignments: **0**. Excluded assignments: **1**.

Database memiliki satu published practice task dan nol closed practice task. Status tersebut tidak mengubah klasifikasi. `classwork_content_links` serta kolom Phase 2A `participant_visibility` dan `required_deliverable` belum deployed, sehingga task juga tidak memenuhi quality gate.

## H. Required vs Optional Decision Rules

- `REQUIRED` harus berupa keputusan eksplisit dalam frozen authority; visibility/publication/order/type bukan bukti approval.
- `OPTIONAL` dan `REFERENCE_ONLY` boleh tampil tetapi tidak menambah denominator dan tidak memblokir `requirements_met`.
- `EXCLUDE` tidak dikirim ke Phase 4B assignment policy payload.
- Unknown assignment default adalah `not_required` dengan warning `unclassified_assignments_ignored`.
- Required item yang kemudian hilang atau drift tetap ada di denominator dan menghasilkan configuration integrity blocker.
- Denominator assignment tidak membaca seluruh classwork batch atau generic Training history.

## I. Topic / Stage Mapping

Hanya stage aktual berikut yang dibekukan:

| Sequence | Stage | Included content | Assignment | Status |
|---|---|---|---|---|
| 01 | Foundation / BIM Mindset | `page:bim-mindset` REQUIRED | none | Learning ready; program stage incomplete |

Stage 02–09 tidak dibuat sebagai empty runtime stages. Mereka dicatat sebagai backlog agar roadmap tidak disalahartikan sebagai requirement.

## J. Assignment Quality Review

Tidak ada assignment yang lolos seluruh kriteria required: competency mapping, clear brief, clear deliverable, valid canonical references, executable workflow, objective review, usable rubric, dan approved journey.

Smoke task yang ditemukan gagal pada pilot batch scope, deliverable, prerequisite/reference contract, rubric, dan intended competency. Karena itu task tidak dapat dipromosikan menjadi required atau optional.

## K. Rubric Readiness

| Required assignment | Result |
|---|---|
| none | Tidak dapat dinilai sebagai ready; assignment manifest tetap blocked |
| Smoke Practice Task (excluded) | RUBRIC MISSING |

Review infrastructure tersedia di source, tetapi criteria untuk assignment pilot harus dikonfigurasi sebagai data; tidak di-hard-code di backend. Missing rubric untuk calon required assignment adalah blocker sampai assignment disetujui.

## L. Evidence Format Compatibility

Allowlist tetap: PDF, DOCX, XLSX, CSV, JPG/JPEG, PNG. Tidak ada format native RVT/NWC/DWG yang diaktifkan.

Belum ada required assignment, sehingga compatibility belum dapat disahkan. Untuk calon assignment Phase 5B, deliverable harus dinyatakan dalam format aman, misalnya PDF clash report, XLSX issue log/QTO, PDF schedule report, atau DOCX/PDF explanation plus JPG/PNG screenshots. Requirement yang hanya dapat dipenuhi dengan native BIM file harus tetap future/blocked.

## M. Role / Enrollment Configuration

| Role | Canonical ID | Required behavior | Readiness |
|---|---:|---|---|
| Participant | unset | own learning/assignment/submission/review/revision/summary | Required input |
| Mentor | unset | scoped review; closeout according to frozen policy | Required input |
| Reviewer | unset | scoped review only; no closeout | Not configured |
| Observer | unset | read-only | Not configured |
| Admin | canonical authenticated admin | governance/explicit closeout per policy | Existing architecture |

Batch belum ada, sehingga membership, uniqueness, active enrollment, dan scope belum dapat diverifikasi. Validator tidak mencari kandidat user atau mencetak user directory; Phase 5B harus menerima canonical IDs yang disetujui.

## N. Program Dates / Deadlines

Start date dan end date belum diputuskan dan tetap `null`. Keduanya adalah required operational input; tidak ada tanggal rekaan.

Smoke task tidak memiliki due date dan bukan bagian pilot. Calon assignment harus dinilai `DATE READY` atau `DATE TBD` satu per satu. Deadline tidak otomatis diturunkan dari batch dates tanpa approved rule.

Evaluator behavior tetap: requirements dapat terpenuhi sebelum end date, `requirements_met` tidak auto-complete, elapsed end date tidak auto-fail, dan explicit closeout tetap diperlukan.

## O. Capstone Status

**CAPSTONE = FUTURE / NOT YET CONFIGURED.** Tidak ditemukan capstone assignment yang siap dan terikat pilot. Capstone tidak menjadi progress engine terpisah dan tidak masuk denominator v1.

## P. Content Gap Matrix

`PARTIAL` berarti ada source/candidate material di BCL, tetapi belum menjadi approved Internship path mapping dan belum didukung assignment pilot siap-review.

| Area | Approved required content | Approved required assignment | Status | Gap / action |
|---|---:|---:|---|---|
| BIM Mindset | Yes | No | READY untuk learning saja | Tentukan apakah practical task diperlukan |
| Information Management / Governance | No | No | PARTIAL | Static path/material tersedia; SME approve dan version mapping |
| Model Production & Quality | No | No | PARTIAL | Revit/Navisworks catalog tersedia; belum pilot-frozen |
| Coordination / Clash | No | No | PARTIAL | Catalog/candidates tersedia; perlu mapping, brief, rubric, safe deliverable |
| 4D / schedule integration | No | No | PARTIAL | Mapping candidates ada; belum approved/executable |
| 5D / QTO | No | No | PARTIAL | QTO candidates ada; belum approved/executable |
| Automation / Digital Engineering | No | No | PARTIAL | Broad catalog signal ada; tidak ada approved pilot unit/task |
| Documentation / Delivery | No | No | PARTIAL | Documentation material ada; belum pilot-frozen |
| As-built / handover | No | No | PARTIAL | Conceptual pages ada; tidak ada approved pilot requirement |
| Construction/project controls | No | No | MISSING | Tidak ada approved pilot unit/task |
| Capstone | No | No | MISSING | Future configuration |

## Q. Unified Learning Debt Impact

| Debt | Classification | Justification |
|---|---|---|
| Optional `learning_materials` relation unavailable | NON-BLOCKING TECHNICAL DEBT untuk v1 | Satu required item adalah canonical static page resolved dari approved mapping/route, bukan optional table |
| SME decisions 337/371 | NON-BLOCKING TECHNICAL DEBT untuk satu frozen item; blocker untuk perluasan | `page:bim-mindset` sudah explicitly seeded/approved; unresolved inventory tidak boleh dipromosikan ke requirement |

`npm run smoke:unified-learning` tetap gagal persis pada dua debt tersebut. Tidak ada localStorage atau unverified fallback yang dipakai untuk menyembunyikannya.

## R. Manifest Validation

Artifacts:

- `backend/elearning/data/internship-pilot-manifest-v1.json`
- `backend/services/internshipPilotManifestValidator.js`
- `backend/scripts/validate-internship-pilot-manifest.js`

Validator membuka transaksi PostgreSQL read-only, mengecek source resolution, schema, path/policy/batch, duplicate IDs, canonical content, assignment ownership, role/date inputs, rubric/evidence readiness, dan manifest checksum. Output aktual:

```json
{
  "valid": false,
  "readiness": "BLOCKED",
  "summary": {
    "requiredLearning": 1,
    "optionalLearning": 0,
    "excludedLearning": 0,
    "requiredQuizzes": 0,
    "optionalQuizzes": 0,
    "excludedQuizzes": 0,
    "requiredAssignments": 0,
    "optionalAssignments": 0,
    "excludedAssignments": 1
  },
  "mutationPerformed": false
}
```

Error utama: empty required assignment manifest, unresolved pilot batch/policy, dan Phase 1A–4B pilot schema belum deployed. Warning: participant, mentor, dan dates pending. Repository resolution untuk path dan `page:bim-mindset` lulus.

## S. Phase 4B Evaluator Compatibility

Controlled fixture membuktikan:

- learning required = 1 required path item saja;
- optional learning tidak menambah denominator;
- required assignment = 1 manifest item saja;
- optional assignment tidak memblokir;
- extra visible generic task tidak pernah diminta repository/evaluator;
- latest accepted revision memenuhi requirement; dua historical revisions tidak menambah denominator;
- missing required content/assignment tetap integrity blocker.

Semua 20 targeted Phase 5A tests lulus. Full suite lulus 152/152.

## T. Configuration Integrity Findings

1. Unsafe auto-required bootstrap sudah dihapus.
2. Manifest digest mencegah silent edit pada v1.
3. Policy payload mengikat `manifestVersion` dan `manifestDigest` ketika nanti dikonfigurasi.
4. Existing immutable policy table cukup; tidak diperlukan schema/migration Phase 5A baru.
5. Existing Phase 4B migration yang belum pernah di-apply diperketat agar hanya membawa explicit legacy classifications.
6. Required assignment missing/drift dan required learning unavailable tetap fail closed.
7. Artifact tidak memuat UNC/storage/evidence path, credential, secret, atau token.

## U. Pilot Readiness Matrix

| Gate | State | Evidence |
|---|---|---|
| Frozen manifest integrity | READY | SHA-256 valid; mutation test passes |
| Learning classification | READY | 1 explicit required item |
| Quiz classification | READY | Explicit empty set, matching `assessments: []` |
| Assignment journey | BLOCKED | 0 approved executable required assignments |
| Batch/policy deployment | BLOCKED | Records/schema absent in current DB |
| Role enrollment | CONDITIONAL | Canonical IDs pending |
| Dates | CONDITIONAL | Start/end pending |
| Evidence/rubric | BLOCKED | Cannot approve until required assignments exist |
| Feature flags | SAFE/OFF | No activation performed |
| Overall | **BLOCKED / NO-GO** | Critical configuration gaps remain |

Readiness definitions: READY has valid required manifest and no critical gaps; CONDITIONAL requires named operational inputs only; BLOCKED includes invalid/missing critical references or non-executable requirement journey.

## V. Blockers

1. Approve at least one real, executable pilot assignment or explicitly approve a learning-only program policy and update evaluator/product acceptance accordingly. Current Phase 4B intentionally blocks vacuous zero-assignment completion.
2. For every required assignment, define competency/stage, brief, safe deliverable, canonical prerequisites/references, release/due decision, evidence formats, and rubric criteria.
3. Create/deploy the pilot batch and immutable policy in the test/pilot environment after migration approval.
4. Bind and verify the exact manifest version/digest in the policy.

## W. Non-Blocking Issues

- Participant/mentor canonical IDs are pending operational approval.
- Start/end dates and assignment deadlines are pending.
- Reviewer and observer are optional unless operations require them.
- `learning_materials` absence and 337/371 SME parity do not affect the one v1 required page, but prevent unreviewed catalog expansion.
- Current participant UI emphasizes required counts and has reference-link wording, but an explicit `Tambahan / Referensi` label for optional learning is not proven. This is a small future UI/config gap if optional items are introduced; v1 has no optional item, so it does not block this manifest audit.

## X. Frozen Pilot Manifest Summary

Participant preview before activity, derived from v1:

| Summary field | Value |
|---|---:|
| Learning Required | 1 |
| Optional Learning | 0 |
| Required Assignments | 0 |
| Optional Assignments | 0 |
| Program Status | Configuration blocked; do not expose as live `Belum Dimulai` yet |

Mentor audit preview:

| Field | Value |
|---|---|
| Participant | canonical ID pending |
| Program | `INT-BIM-2026-PILOT` |
| Policy | `INT-BIM-PILOT-POLICY-v1` target; not deployed |
| Manifest | `INT-BIM-PILOT-MANIFEST-v1` |
| Required learning | 1 |
| Required assignments | 0 — blocker |
| Reviewer scope | not configured; review-only when assigned |
| Completion | required learning + accepted required assignments + explicit closeout |

## Y. Recommended Phase 5B Inputs

Phase 5B must not begin activation until reviewers approve these exact inputs:

1. Approved required/optional/excluded assignment list with stable IDs.
2. Per required assignment: title, instructions, competency/stage, deliverable, canonical links, publication/availability, dates, safe evidence formats, rubric criteria, and definition digest.
3. Decision whether current single learning item is adequate or a new published path version is needed for approved additional stages.
4. Canonical participant user ID and active `participant` membership.
5. Canonical mentor user ID and scoped active `mentor` membership.
6. Reviewer/observer IDs and scopes only if used; reviewer must remain without closeout authority.
7. Approved start/end dates and per-assignment release/due dates.
8. Approved migration order in a test/pilot environment, followed by validation and rollback evidence.
9. A new manifest version if any v1 denominator changes; v1 must not be edited in place.
10. Progressive feature-flag plan and full end-to-end readiness validation before any unrestricted evidence rollout.

## Z. Approval Checklist

| # | Question | Answer |
|---:|---|---|
| 1 | Is the learning manifest valid? | **Yes at repository/source level**; one explicit required page resolves. Runtime deployment remains pending. |
| 2 | Is the quiz manifest valid? | **Yes**; explicitly empty and matches the frozen path definition. |
| 3 | Is the assignment manifest valid? | **No for pilot readiness**; generic smoke task is explicitly excluded and no required assignment is ready. |
| 4 | Are all required references resolvable? | Learning: **yes in repository**. Runtime database/policy/batch: **no, not deployed**. |
| 5 | Are all required assignments executable? | **No required assignment exists**, which is a blocker rather than a vacuous pass. |
| 6 | Are evidence formats compatible? | **Not yet assessable** until required deliverables are approved. Allowlist remains safe and unchanged. |
| 7 | Are rubrics ready? | **No**; there is no required assignment/rubric set. |
| 8 | Is the policy version frozen? | Target identity/semantics are frozen in artifact; **database policy record does not yet exist**. |
| 9 | Are participant/mentor role inputs ready? | **No**; canonical IDs and memberships are pending. |
| 10 | Are program dates ready? | **No**; start/end are required operational inputs. |
| 11 | Does Phase 4B evaluator return correct denominators? | **Yes in controlled tests**; only required mappings/manifest items count. |
| 12 | Does any existing technical debt block the pilot? | Unified Learning debt does not block the one required page, but the absent assignment journey and undeployed pilot configuration **do block** the pilot. |

Technical readiness decision: **NO-GO**. Do not activate Phase 5B until the blockers in section V are resolved and represented by an approved next manifest/policy version.

### Verification record

| Check | Result |
|---|---|
| `npm run test:internship` | PASS — 152/152 |
| Phase 5A targeted manifest tests | PASS — 20/20 |
| `node --test backend/tests/p0-1-security.test.js backend/tests/p0-2-auth.test.js` | PASS — 2/2 |
| `node scripts/smoke-elearning-theory.js` | PASS |
| `node backend/scripts/validate-internship-pilot-manifest.js --allow-blocked` | Expected BLOCKED; read-only; exact gaps reported |
| `npm run migrate:internship:completion:validate` | PASS; Phase 1–4 temporarily applied, Phase 4B validated, all rolled back |
| `npm run smoke:unified-learning` | Existing debt only: missing optional table and SME 337/371 |
| JavaScript syntax checks | PASS for validator, validation script, and configuration script |
| UI/Playwright | Skipped; no Phase 5A UI changes |
| Production mutation | None |

No Phase 5A schema migration was added because the existing immutable policy JSON can safely bind the manifest version/digest and explicit assignment references.
