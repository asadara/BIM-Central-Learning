# BCL Internship Program — Phase 1A Implementation Report

**Date:** 24 September 2026
**Baseline:** `b298380`
**Scope:** backend/data contract, versioned schema, read-only progress projection, authorization, feature flag, and tests. No participant UI or navigation was added.

## 1. Implementation summary

Phase 1A adds a default-off Internship API under the existing Training namespace. It reuses:

- canonical `public.users.id` from the authenticated principal;
- `training_batches` as the program run;
- `batch_members` as enrollment and batch-scoped role;
- published `learning_path_versions`, modules, and approved canonical content mappings;
- existing `learning_activity_events` for page/video/PDF completion;
- verified, passed `learning_attempts` for quiz completion.

The implementation does not add a content-completion table, does not write `user_content_progress`, and does not read browser state.

## 2. Implemented architecture decisions

- API composition is additive and mounted only when `INTERNSHIP_ENABLED=true`.
- Unified Learning Catalog canonical IDs are the content reference contract.
- Responses use an allowlisted reference: `contentId`, `type`, `title`, and safe BCL `href`.
- Native source locators are never returned. PDF/video hrefs are reconstructed from canonical IDs rather than raw paths.
- A batch points to one published path version through `internship_batch_config`.
- The config trigger rejects a non-Internship batch, an unpublished version, and path-version replacement.
- Program progress is calculated on each read with `calculationVersion=internship-progress-v1`.
- Participant projection contains only active modules, approved mappings, active content, and published assessments.
- No Training submission/review endpoint was duplicated or changed.

## 3. Data-flow

```text
Authenticated User (canonical public.users.id)
        ↓
batch_members enrollment + scoped role
        ↓
training_batches(program_type=internship)
        ↓
internship_batch_config (immutable version FK)
        ↓
published learning_path_versions / active modules / approved mappings
        ↓
learning_content_registry canonical ID
        ↓
learning_activity_events + verified learning_attempts
        ↓
read-only Internship item/module/program progress
```

## 4. Migration files and strategy

Files:

- `backend/scripts/20260924-internship-phase1a.sql`
- `backend/scripts/20260924-internship-phase1a-rollback.sql`
- `backend/scripts/run-internship-phase1a-migration.js`
- `backend/scripts/configure-internship-batch.js`

Schema delta:

- `training_batches.program_type TEXT NOT NULL DEFAULT 'training'`
- constraint allowing `training` and `internship`
- index on `(program_type, status)`
- `internship_batch_config` with one row per batch, published path-version FK, minimal `policy_json`, and timestamps
- validation/immutability triggers

Existing batches retain `program_type='training'`, so default behavior is preserved.

The migration also freezes one pilot version of existing `bim-mindset-foundation`, referencing `page:bim-mindset`. The existing page remains the content source. Its existing activity ID `bim-mindset__bim-mindset` is recorded as a versioned evidence alias in `completion_rule`.

Operational commands:

```text
npm run migrate:internship:dry-run
npm run migrate:internship:validate
npm run migrate:internship
node backend/scripts/configure-internship-batch.js --batch-id <existing-batch-id>
node backend/scripts/configure-internship-batch.js --batch-id <existing-batch-id> --apply
```

`migrate:internship:validate` executes the complete migration in a transaction and rolls it back. The persistent apply command was not run during this implementation.

Rollback is fail-closed: it refuses while any Internship batch config exists. Registry/path parent rows are retained because they may predate the migration and contain references, not copied content.

## 5. Backend services and repositories

- `canonicalLearningContentResolver.js`
  - resolves canonical IDs;
  - maps approved legacy references deterministically;
  - rejects unknown and ambiguous matches;
  - emits safe portable hrefs.
- `internshipRepository.js`
  - contains read-only PostgreSQL queries for enrollment, path mapping, activity, and verified quiz evidence.
- `internshipProgramService.js`
  - enforces principal/batch access;
  - allowlists visible path data;
  - derives item, module, and program progress.
- `internshipFeature.js`
  - constructs and mounts the feature only when enabled.

## 6. API routes

Mounted at `/api/training/internships` when enabled:

| Method and path | Result |
|---|---|
| `GET /me` | Internship enrollments for the authenticated canonical user |
| `GET /:batchId` | Safe program header, role, frozen path reference, mentor display |
| `GET /:batchId/learning-path` | Versioned modules, canonical references, authoritative item status |
| `GET /:batchId/progress` | Read-only item/module aggregate with provenance and calculation version |

The endpoints accept no authoritative `user_id` input.

## 7. Canonical content resolver behavior

- Supported namespaces remain `page:`, `video:`, and `pdf:`.
- Canonical ID must exactly match its normalized `source_type:source_id`.
- Legacy resolution can use a type plus legacy/source ID, page route slug, or PDF `material` query parameter.
- No match returns `UNKNOWN_CONTENT_REFERENCE`.
- More than one match returns `AMBIGUOUS_CONTENT_REFERENCE`.
- Duplicate active path mappings fail rather than being silently counted twice.
- Page href is restricted to safe BCL HTML routes. PDF and video hrefs are built from canonical identity and never from source filesystem locators.

## 8. Progress derivation

For every approved required content mapping:

- page/video/PDF is complete only when a matching `learning_activity_events` row has `event_type='completed'` for the canonical user;
- versioned `completion_rule.activity.moduleIds` can bridge an approved legacy evidence ID;
- quiz is complete only when `learning_attempts.is_verified=true AND passed=true`;
- candidate/rejected/retired mappings, inactive modules/content, and draft assessments are excluded;
- module and overall percentages are `completed required items / required items`;
- no completion or aggregate row is written.

The projection never receives or reads `localStorage`, local quiz history, or client progress snapshots.

## 9. Authorization matrix

| Actor | `/me` | Own/member batch | Other batch | Write behavior |
|---|---:|---:|---:|---:|
| Participant | Own enrollments | Active/completed cohort only | Hidden (`404`) | None |
| Mentor | Own enrollments | Member cohort | Hidden (`404`) | None |
| Reviewer | Own enrollments | Member cohort | Hidden (`404`) | None |
| HC observer | Own enrollments | Member cohort | Hidden (`404`) | None |
| Batch member role `admin` | Own enrollments | Member cohort | Hidden (`404`) | None |
| System admin | Own enrollments | Any configured Internship batch | Any configured Internship batch | None in Phase 1A |
| Unauthenticated | Denied (`401`) | Denied (`401`) | Denied (`401`) | None |

No observer/reviewer permission was broadened; all new endpoints are GET-only.

## 10. Feature flag

`INTERNSHIP_ENABLED=false` is the repository default in `.env.example`.

When disabled:

- Internship routes are not mounted;
- the Internship repository/service is not constructed;
- the Unified Catalog is not constructed solely for Internship;
- existing Courses, My Progress, My Training, certificates, and Training routes remain on their original code paths;
- no navigation item exists.

The existing Unified Catalog flag remains unchanged and default-off. When Internship alone is enabled, the internal catalog service is available to its resolver without exposing `/api/learning/catalog` unless the catalog flag is separately enabled.

## 11. Automated tests and results

Command:

```text
npm run test:internship
```

Result: **13 tests passed, 0 failed**.

Covered contracts:

1. deterministic canonical and legacy content resolution;
2. unknown and ambiguous reference rejection;
3. safe href/no native or UNC path output;
4. existing page, video, and PDF activity evidence reflected in Internship progress;
5. verified-passed quiz authority only;
6. draft/inactive/retired visibility filtering;
7. read-only/local-state-independent projection;
8. same canonical user identity across principal shapes;
9. participant, staff, system-admin, and non-member authorization;
10. authenticated GET API contract and invalid batch ID handling;
11. flag-off representative existing-route regression;
12. migration/no-duplicate-completion-state contract.

Migration verification:

- `npm run migrate:internship:dry-run`: prerequisites found; no state changed.
- `npm run migrate:internship:validate`: full migration executed successfully and rolled back; schema state remained unchanged afterward.
- JavaScript syntax checks and `git diff --check`: passed.

## 12. Files changed

Configuration/registration:

- `.env.example`
- `package.json`
- `backend/server.js`

Backend:

- `backend/features/internshipFeature.js`
- `backend/repositories/internshipRepository.js`
- `backend/routes/internshipRoutes.js`
- `backend/services/canonicalLearningContentResolver.js`
- `backend/services/internshipProgramService.js`

Migration/operations:

- `backend/scripts/20260924-internship-phase1a.sql`
- `backend/scripts/20260924-internship-phase1a-rollback.sql`
- `backend/scripts/run-internship-phase1a-migration.js`
- `backend/scripts/configure-internship-batch.js`

Tests/docs:

- `backend/tests/internship-phase1a.test.js`
- this report
- `docs/security/BCL_PROJECTS_ROUTE_AUTH_REMEDIATION_20260924.md`

The approved Phase 0 audit document remains in `docs/BCL_INTERNSHIP_PHASE_0_INTEGRATION_AUDIT_20260924.md`.

## 13. Known limitations and remaining risks

- Migration has been validated transactionally but not persistently applied to the configured database.
- No real pilot batch was converted/configured because no batch ID was designated in the brief.
- The repository-wide `npm test` command is still a pre-existing placeholder; verification used the new focused `test:internship` suite rather than claiming a full-repository test run.
- The pilot freezes one existing page only. Expanding curriculum requires explicit approved canonical mappings and a new published version.
- Formal exam is not part of the pilot and remains out of scope.
- Existing learning activity writes still use legacy IDs; the versioned evidence alias bridges the selected pilot item. Broader paths need reviewed aliases or future canonical activity writes with a controlled cutover.
- The service performs live read aggregation; caching and reconciliation are intentionally deferred.
- Published path tables remain administratively mutable at the database level. Normal Internship config cannot swap its version, and JSON edits do not affect the frozen DB version, but DB governance remains required.
- Training's legacy runtime table creation still exists for old structures; Phase 1A adds no new runtime DDL.
- Projects route authentication remains a separate open security item; Projects is not referenced by Internship.

## 14. Phase 1B recommendation

The backend contract is ready for a controlled Phase 1B UI **after** these deployment gates are reviewed and completed:

1. approve and persist the Phase 1A migration in a staging environment;
2. designate/configure one pilot `training_batch` and confirm its participant/mentor roster;
3. run authenticated live smoke tests for all four endpoints against staging evidence;
4. review the API response for the chosen cohort and approve the single-page pilot curriculum;
5. keep `INTERNSHIP_ENABLED=false` in production until the migration and smoke evidence are signed off.

Until those gates are approved, do not add the final participant page or Training navigation submenu.
