# BCL Internship Program — Phase 2B-1 Implementation Report

Date: 2026-09-25
Scope: Submission Foundation + Evidence Contract + Storage Abstraction + Authorization + Security Validation

## 1. Outcome

Phase 2B-1 is implemented behind `INTERNSHIP_SUBMISSIONS_ENABLED=false` by default. It adds a participant-owned Draft → Submitted submission contract and a quarantined evidence foundation without adding participant upload UI, mentor review, Projects integration, or combined program progress.

The implementation reuses the canonical Training tables `assignment_submissions` and `submission_files`. It does not create an Internship-specific submission table. Additive columns and one status-history table provide the evidence and audit properties that the generic schema did not have.

## 2. Existing submission model audit

### Reusable parts

- `assignment_submissions.classwork_item_id` already binds a submission to the canonical `classwork_items` assignment.
- `assignment_submissions.user_id` already binds ownership to canonical `users.id`.
- `UNIQUE(classwork_item_id, user_id)` already enforces one logical submission for a participant and assignment. The batch is derived authoritatively through `classwork_items.batch_id`.
- `submitted_at`, `metadata`, `created_at`, and `updated_at` are reusable.
- `submission_files.submission_id` already provides the required one-to-many relation.
- Existing generic Training membership and review structures remain intact for non-Internship programs.

### Unsafe or incompatible generic behavior

- The generic Training POST endpoint submits immediately; it has no Draft lifecycle.
- A generic resubmission updates the same row and deletes/replaces all `submission_files`, which is unsuitable for frozen submitted evidence.
- Generic `submission_files.file_path` and `external_url` can represent client-supplied paths/links. Those fields are never accepted or returned by the Internship API.
- Generic file metadata lacks a content hash, opaque storage key, uploader identity, classification, scan state, quarantine state, and soft-removal fields.
- Generic submission statuses also contain review outcomes. Phase 2B-1 does not activate or expose those states in the Internship namespace.
- The generic route file still contains pre-existing runtime table bootstrap code. Phase 2B-1 adds no runtime DDL; all new schema changes use a versioned migration.

### Compatibility decision

The generic Training endpoints and response mapping were not changed. Internship submissions remain blocked from those generic endpoints and use the dedicated `/api/training/internships/...` contract. This prevents unsafe generic path semantics and review actions from leaking into Internship while preserving non-Internship Training behavior.

## 3. Data-model decisions

### `assignment_submissions`

- Reused as the single logical submission identity.
- Existing `UNIQUE(classwork_item_id, user_id)` is the one-participant/one-assignment invariant.
- Adds `withdrawn_at`.
- Internship service-controlled states are `draft`, `submitted`, and `withdrawn`.
- A database-wide status constraint was intentionally not added because the same table still supports existing generic Training statuses.

### `submission_files`

- Reused as evidence metadata storage.
- Existing primary key `id` is the opaque evidence ID; new Internship evidence IDs are UUID v4 values.
- Existing `file_size` remains the authoritative byte count to avoid a duplicate size column.
- Adds `original_file_name`, `safe_display_name`, `mime_type`, `sha256`, `storage_key`, `uploaded_by_user_id`, `classification`, `scan_status`, `storage_status`, `removed_at`, and `removed_by_user_id`.
- `file_path` and `external_url` remain available only for generic Training compatibility and are always `NULL` for Internship evidence.
- Constraints validate controlled classification/status values, SHA-256 shape, and complete metadata whenever an opaque storage key is present.

### `submission_status_history`

- Additive append-only transition log for `draft`, `submitted`, and `withdrawn`.
- Records actor and transition timestamp.
- It is intentionally small and is not an event-sourcing implementation.

## 4. Submission lifecycle

| From | Action | To | Rule |
| --- | --- | --- | --- |
| No Submission | Create | Draft | Participant, visible assignment, state `available` |
| Draft | Create again | Draft | Idempotently returns the same logical submission |
| Draft | Submit | Submitted | Assignment remains `available`; evidence/comment policy passes |
| Submitted | Withdraw | Withdrawn | Only when `policy.submissions.allowWithdrawal === true` |
| Withdrawn | Create | Draft | Only under the same withdrawal policy; same logical identity is reused |

Default policy:

- withdrawal disabled;
- minimum evidence count `1`;
- comment optional;
- maximum evidence count `5`.

Submitted evidence is immutable to the participant. A participant must use the explicit withdrawal policy before changing the evidence set. Removed Draft evidence is soft-removed; its metadata and quarantined object are retained for audit/retention handling.

## 5. Evidence metadata contract

Participant-safe responses contain only:

```text
evidenceId
submissionId
originalFileName
safeDisplayName
mimeType
sizeBytes
sha256
uploadedAt
uploadedByUserId
classification
scanStatus
storageStatus
```

Responses never contain `storage_key`, `file_path`, `external_url`, an absolute path, a UNC path, or a direct storage URL.

## 6. Evidence storage abstraction

`internshipEvidenceService` owns validation, UUID generation, SHA-256 calculation, controlled classification, and the quarantine handoff. `createLocalEvidenceStorage` is the initial private adapter. It writes UUID-named binary objects below a backend-private ignored directory with restrictive file mode and returns only an internal opaque storage key to the repository.

Route handlers do not resolve or construct physical paths. There is no evidence download/view endpoint in Phase 2B-1.

Upload flow:

```text
Authenticated participant
  → eligible Draft submission
  → memory-limited multipart parsing
  → filename/extension/MIME/signature/size validation
  → SHA-256
  → private quarantine object
  → additive evidence metadata row
  → safe metadata response
```

If metadata insertion fails, the newly quarantined orphan is discarded. Soft-removal after a successful attach intentionally retains the physical object pending a future retention job.

## 7. File policy

- Maximum size: 10 MiB per evidence item.
- Maximum count: 5 active evidence items per submission.
- Zero-byte files: rejected.
- Allowed extensions/MIME pairs: PDF, DOCX, XLSX, CSV, JPG/JPEG, PNG.
- ZIP: disabled.
- RVT, NWC, NWD, IFC, DWG, and Synchro/native project formats: disabled.
- MIME and extension must match.
- PDF, PNG, JPEG, OOXML container, and UTF-8 CSV content receive lightweight signature/content checks.
- Traversal, native paths, control characters, reserved Windows names, unsafe punctuation, trailing dots/spaces, overlong names, and disallowed/double executable extensions are rejected.
- Original names are metadata only. Physical objects always use UUID keys.
- Classification is server-controlled and defaults to `internal`; participant attempts to select another classification are rejected.

## 8. Authorization matrix

| Actor | Read | Create/edit Draft | Attach/remove evidence | Submit | Withdraw | Review/score |
| --- | --- | --- | --- | --- | --- | --- |
| Enrolled participant | Own only | Own only | Own Draft only | Own Draft only | Policy-gated | No |
| Other participant | No access to owner's data | No | No | No | No | No |
| Non-member | Hidden as not found | No | No | No | No | No |
| Mentor/reviewer | No new Phase 2B-1 action | No | No | No | No | No |
| System admin | Existing operational surfaces only | No participant impersonation | No | No | No | No new review action |

Every participant mutation derives `user_id` from the authenticated principal, reloads Internship enrollment, validates the assignment belongs to the URL batch, requires published/closed participant visibility, and—except policy-gated withdrawal—requires server-derived assignment state `available`. Client fields such as `participant_user_id`, `participantUserId`, `user_id`, and `userId` are rejected.

The public contract does not accept a submission ID, so submission-ID tampering cannot retarget an operation. Evidence removal uses a UUID evidence ID plus the batch, assignment, submission owner, and Draft status in the repository predicate.

## 9. API endpoints

Available only when all three feature flags are enabled:

- `GET /api/training/internships/:batchId/assignments/:assignmentId/submission`
- `POST /api/training/internships/:batchId/assignments/:assignmentId/submission`
- `PATCH /api/training/internships/:batchId/assignments/:assignmentId/submission`
- `POST /api/training/internships/:batchId/assignments/:assignmentId/submission/submit`
- `POST /api/training/internships/:batchId/assignments/:assignmentId/submission/withdraw`
- `POST /api/training/internships/:batchId/assignments/:assignmentId/submission/evidence`
- `DELETE /api/training/internships/:batchId/assignments/:assignmentId/submission/evidence/:evidenceId`

The evidence POST is a minimal authenticated backend surface using multipart field `evidence`; no participant UI invokes it yet.

## 10. Feature flags

```text
INTERNSHIP_ENABLED=false
INTERNSHIP_ASSIGNMENTS_ENABLED=false
INTERNSHIP_SUBMISSIONS_ENABLED=false
```

- Internship off: no Internship routes.
- Internship on, assignments off: Phase 1B behavior.
- Assignments on, submissions off: Phase 2A behavior.
- All on: Phase 2B-1 backend contract.

## 11. UI and learning progress

No UI files were changed for Phase 2B-1. There is no file input, drag-and-drop surface, upload control, submission-state projection, mentor browser, or review UI.

Learning progress still comes exclusively from Phase 1 server evidence. Submission repository methods never write learning completion events, attempts, or progress. Assignment/submission state is not included in the percentage.

## 12. Files added

- `backend/services/internshipEvidenceService.js`
- `backend/scripts/20260925-internship-phase2b1.sql`
- `backend/scripts/20260925-internship-phase2b1-rollback.sql`
- `backend/scripts/run-internship-phase2b1-migration.js`
- `backend/tests/internship-phase2b1.test.js`
- `docs/BCL_INTERNSHIP_PHASE_2B1_IMPLEMENTATION_REPORT_20260925.md`

## 13. Files modified

- `.env.example`
- `.gitignore`
- `backend/server.js`
- `backend/features/internshipFeature.js`
- `backend/routes/internshipRoutes.js`
- `backend/services/internshipProgramService.js`
- `backend/repositories/internshipRepository.js`
- `package.json`

All other dirty-worktree files are pre-existing Phase 0/1/2A work and were preserved.

## 14. Verification

Completed:

- JavaScript syntax checks for all Phase 2B-1 backend/test files and `backend/server.js`: passed.
- `node --test backend/tests/internship-phase2b1.test.js`: 11/11 passed.
- `npm run test:internship`: 52/52 passed across Phase 1A, 1B, 2A, and 2B-1.
- `npm run migrate:internship:submissions:validate`: passed; Phase 1A, Phase 2A, and Phase 2B-1 were applied inside a validation transaction and rolled back. No persistent migration was applied.
- `node --test backend/tests/p0-1-security.test.js backend/tests/p0-2-auth.test.js`: 2/2 passed.
- `node --check backend/routes/trainingBatchRoutes.js`: passed.
- `node scripts/smoke-elearning-theory.js`: passed.
- `git diff --check`: passed; only expected Windows line-ending conversion warnings were emitted.
- `npm run smoke:unified-learning`: failed on the pre-existing debt explicitly excluded from Phase 2B-1: optional table `learning_materials` is absent and SME decisions remain 337/371. No Phase 2B-1 code is on that data path.

## 15. Security coverage

Automated coverage includes:

- feature disabled behavior;
- non-member, wrong batch, wrong assignment, locked, upcoming, and closed denial;
- canonical owner isolation and same-assignment identity uniqueness;
- authoritative client identity rejection;
- evidence ID ownership predicates and submitted-set freeze;
- withdrawal policy;
- traversal (`../../` and `..\\..\\`), native paths, reserved names, double executable extension;
- extension/MIME mismatch, zero-byte, size limit, and content signature mismatch;
- SHA-256 generation;
- controlled classification;
- quarantine/pending scan state;
- no storage/native path in API projections;
- no submission authority in local storage;
- no submission influence on learning completion/progress;
- migration additive/rollback contract;
- absence of mentor review, Projects integration, and download endpoints.

## 16. Known limitations and operational constraints

- Malware scanning is not integrated. Evidence remains `scanStatus=pending` and `storageStatus=quarantined`; there is deliberately no retrieval endpoint.
- The local storage adapter is a foundation implementation, not a production object store. Capacity, backup, encryption-at-rest, retention cleanup, and disaster recovery need an operations decision before production rollout.
- Lightweight OOXML validation verifies container markers and expected `word/` or `xl/` entries; it is not a malware/content-disarm scanner.
- Removed Draft evidence is retained, but no scheduled retention cleanup exists yet.
- The single logical submission retains transition history and soft-removed evidence metadata; it does not create full immutable submission-version snapshots.
- Staff operational read and mentor evidence access are intentionally not added in this phase.
- The rollback drops Phase 2B-1 evidence metadata columns and transition history. It is safe for validation/pre-rollout reversal; after production data exists it requires a maintenance window and backup/export rather than blind execution.
- Existing Unified Learning smoke debt remains unchanged: optional `learning_materials` is unavailable and the SME decision count is 337/371.

## 17. Phase 2B-2 recommendation

Phase 2B-2 UI implementation is safe to begin behind the default-off flags because the backend now enforces canonical ownership, assignment eligibility, file policy, quarantine, hashes, and frozen submitted evidence.

Production upload rollout should remain blocked until:

1. the Phase 2B-1 migration is reviewed and deliberately applied;
2. storage capacity, backup, retention, and encryption ownership are approved;
3. a malware scanning worker promotes clean objects out of quarantine, or policy explicitly accepts quarantine-only submission with no retrieval;
4. Phase 2B-2 consumes only the safe metadata contract and never exposes storage paths;
5. end-to-end upload tests run in the target deployment environment.

Mentor review, direct evidence retrieval, Projects Explorer/native project storage, and combined program progress remain outside the approved stop point.
