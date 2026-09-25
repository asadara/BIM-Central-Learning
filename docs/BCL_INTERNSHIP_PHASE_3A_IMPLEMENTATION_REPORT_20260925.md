# BCL Internship Program — Phase 3A Implementation Report

Date: 25 September 2026

Scope: Mentor Review Foundation & Authorization

Status: Implemented and verified behind a default-OFF feature flag

## 1. Phase 3A implementation report

Phase 3A adds the backend/data foundation for human review of a fixed Internship submission revision. The implementation provides a scoped review queue, object-level authorization, reviewer claim, rubric validation, score and feedback persistence, explicit decisions, optimistic locking, an append-only transition trail, a participant-safe read contract, and authorization-gated evidence streaming.

No Mentor UI, participant feedback/revision UI, Projects integration, automatic acceptance, AI review, certificate action, learning completion write, or combined progress calculation was added.

## 2. Audit of existing Training review structures

The existing generic Training structures were reused as follows:

- `review_criteria`: already provides batch/assignment scope, title, description, maximum score, weight, and order. Phase 3A adds `required`.
- `review_scores`: already provides submission/criterion score and reviewer comment. Phase 3A links rows to a review and submission revision while retaining legacy generic rows.
- `submission_comments`: already has `participant` and `internal` visibility semantics. Phase 3A constrains those values and links feedback history to review/revision.
- `batch_evaluations`: represents final participant/program evaluation and is intentionally not used for per-assignment review decisions.
- `assignment_submissions` and `submission_files`: remain the canonical submission/evidence structures and gain stable revision numbers.

The generic Training review route previously wrote review results directly into submission status and had no review claim, explicit review lifecycle, revision binding, or optimistic version. Those gaps justify the additive generic `submission_reviews` lifecycle table. No Internship-specific duplicate review tables were created.

## 3. Final review lifecycle

Canonical states are:

`not_started → under_review → accepted`

or:

`not_started → under_review → revision_requested`

Absence of a review row is returned as canonical `not_started`. Starting review atomically creates/claims `under_review`. `accepted` and `revision_requested` are terminal in Phase 3A. Restart, cross-decision, and `revision_requested → accepted` are rejected. Participant resubmission is deliberately deferred to Phase 3B.

## 4. Data-model decisions

- `assignment_submissions.submission_revision`: current logical submission revision, initially `1`.
- `submission_files.submission_revision`: binds evidence to the revision on which it was submitted.
- `submission_reviews`: one primary review per submission/revision; stores state, authenticated reviewer, timestamps, participant feedback, internal note, and `review_version`.
- `review_scores.review_id` and `submission_revision`: reuse the generic score table without overwriting another revision.
- `submission_comments.review_id` and `submission_revision`: reuse generic visibility-aware feedback history.
- `submission_review_history`: append-only started/updated/decision transitions with actor, revision, optimistic version, and a non-content change summary.
- `review_criteria.required`: supports decision-time completeness validation.

The logical submission remains one row per participant/assignment. Future Phase 3B resubmission must increment `submission_revision` and add a new revision-bound evidence set; it must not mutate the evidence reviewed in an earlier revision.

## 5. Migration files

- `backend/scripts/20260925-internship-phase3a.sql`
- `backend/scripts/20260925-internship-phase3a-rollback.sql`
- `backend/scripts/run-internship-phase3a-migration.js`

The migration is versioned, advisory-locked, additive to generic Training tables, constrained, and indexed. The rollback refuses to proceed when review records exist, requiring explicit export/removal in an approved maintenance window rather than silently destroying review history.

## 6. Review authorization matrix

| Role | Queue/detail | Start/save/decision | Participant result | Evidence stream |
|---|---:|---:|---:|---:|
| Participant | No | No | Own submission only | No |
| Mentor in batch | Yes | Yes | N/A | Yes, policy-gated |
| Reviewer in batch | Yes when `allowReviewerRole` | Yes when `allowReviewerRole` | N/A | Yes, policy-gated |
| Batch admin | Yes | Yes | N/A | Yes, policy-gated |
| System admin | Yes | Yes | N/A | Yes, policy-gated |
| Observer | No by default | No | No | No |
| Non-member / other batch | No | No | No | No |

Every reviewer operation validates authenticated principal, Internship batch context, active membership/system-admin status, permitted role, batch scope, submission ownership by the batch, published/closed visible practice assignment, active participant enrollment, and submitted state. Reviewer and participant IDs supplied by the client are rejected.

## 7. Rubric contract

Rubrics reuse `review_criteria` and may be assignment-scoped or batch-default. Participant-facing BIM criteria are data, not backend constants. Each criterion exposes:

- `criterionId`
- `title`
- `description`
- `maxScore`
- `weight`
- `required`
- `displayOrder`

The generic Training criteria endpoint now persists and returns `required`. Criteria from another batch or assignment are rejected by Phase 3A score validation.

## 8. Scoring contract

Scores remain criterion-level values in generic `review_scores`. Each score must be finite and within `0..criterion.maxScore`; invalid, duplicate, and out-of-scope criterion IDs are rejected rather than clamped. Required criterion scores must exist before a decision when `requireAllCriteria` is enabled, which is the default.

No final Internship score, overall percentage, grade threshold, or automatic acceptance is calculated. Decision remains a separate explicit mentor action.

## 9. Feedback visibility contract

Current feedback is stored separately as `participant_feedback` and `internal_note`. Changes also append visibility-constrained rows to `submission_comments`:

- `participant`: eligible for the participant-safe response after a terminal decision.
- `internal`: mentor/admin only.

Reviewer DTOs are allowlisted to include both where authorized. Participant DTOs are separately constructed and never include `internalNote`, internal history, reviewer criterion comments, storage metadata, or mentor-only content. The backend does not rely on frontend hiding.

## 10. Revision-request contract

`revision_requested` stores the explicit decision, reviewer identity, decision time, criterion scores, participant feedback, and the exact `submission_revision` reviewed. It does not change submission evidence, reopen Draft, increment revision, or alter progress. Phase 3B must provide the controlled creation of the next revision.

## 11. Review API endpoints

- `GET /api/training/internships/:batchId/review-queue`
- `GET /api/training/internships/:batchId/submissions/:submissionId/review`
- `POST /api/training/internships/:batchId/submissions/:submissionId/review/start`
- `PATCH /api/training/internships/:batchId/submissions/:submissionId/review`
- `POST /api/training/internships/:batchId/submissions/:submissionId/review/decision`
- `GET /api/training/internships/:batchId/assignments/:assignmentId/submission/review`
- `GET /api/training/internships/:batchId/submissions/:submissionId/evidence/:evidenceId/content`

The participant read endpoint is backend-only in Phase 3A; the current participant page does not consume or display it.

## 12. Evidence-access rules for reviewer

Review detail returns allowlisted evidence metadata only. The content endpoint validates reviewer scope, submission/batch membership, revision ownership, and evidence membership before accessing storage. It never returns a storage key, filesystem path, UNC path, or direct internal URL.

Streaming is allowed only when `scanStatus=clean` and `storageStatus=stored`. Pending/quarantined, rejected, or failed evidence returns a safe locked response and is never bypassed for mentors. Responses use attachment disposition, `nosniff`, and `private, no-store`.

## 13. Concurrency strategy

The pilot uses one active primary reviewer per submission revision:

- Unique `(submission_id, submission_revision)` prevents two review records.
- First authorized reviewer atomically claims the review.
- A second reviewer receives a safe conflict.
- Review writes lock the row and require the authenticated reviewer to match the claim.
- Every save/decision requires `reviewVersion`.
- `review_version` increments on each successful update.
- Stale writes receive a conflict and never overwrite newer data.
- Decisions are terminal and recorded in append-only history.

## 14. Feature-flag behavior

`INTERNSHIP_REVIEW_ENABLED=false` is documented in `.env.example` and remains the default.

- Internship OFF → no Internship routes.
- Assignments OFF → Phase 1B only.
- Submissions OFF → Phase 2A only.
- Review OFF → Phase 2B-2 submission remains available; review endpoints are not mounted.
- Review ON → Phase 3A backend routes are mounted, provided all earlier flags are ON.

Phase 2B participant read/upload queries deliberately do not reference Phase 3A revision columns, preserving operation on the earlier schema while review remains OFF.

## 15. Files added

- `backend/services/internshipReviewService.js`
- `backend/scripts/20260925-internship-phase3a.sql`
- `backend/scripts/20260925-internship-phase3a-rollback.sql`
- `backend/scripts/run-internship-phase3a-migration.js`
- `backend/tests/internship-phase3a.test.js`
- `docs/BCL_INTERNSHIP_PHASE_3A_IMPLEMENTATION_REPORT_20260925.md`

## 16. Files modified

- `.env.example`
- `package.json`
- `backend/server.js`
- `backend/features/internshipFeature.js`
- `backend/routes/internshipRoutes.js`
- `backend/repositories/internshipRepository.js`
- `backend/services/internshipEvidenceService.js`
- `backend/routes/trainingBatchRoutes.js`

No maintained frontend file was changed in Phase 3A.

## 17. Tests executed and results

- `npm run test:internship`: **79 passed, 0 failed**.
- Phase 3A focused tests: **16 passed, 0 failed**.
- JavaScript syntax checks for all changed backend/test/runner files: passed.
- `node --test backend/tests/p0-1-security.test.js backend/tests/p0-2-auth.test.js`: **2 passed, 0 failed**.
- `node scripts/smoke-elearning-theory.js`: passed.
- `git diff --check`: passed; only expected Windows LF/CRLF conversion warnings were emitted.

No Playwright run was required because Phase 3A adds no final Mentor, admin, or participant UI.

## 18. Authorization/security test results

Coverage passes for participant write denial, observer write denial, non-member and other-batch denial, reviewer scope, mentor/admin authorization, authenticated reviewer identity, client identity rejection, wrong submission/batch rejection, single-reviewer claim, stale version conflict, terminal-state protection, invalid/duplicate/out-of-range rubric scores, required criteria, internal-note isolation, safe metadata, evidence enumeration, cross-submission evidence denial, and quarantine enforcement.

All Phase 2B evidence security tests remain passing.

## 19. Migration validate/rollback result

`npm run migrate:internship:review:validate` passed in `validated-and-rolled-back` mode.

The validator temporarily applied Phase 1A, Phase 2A, and Phase 2B-1 inside the validation transaction because those schemas are not persistently applied in the current environment. It then applied Phase 3A, confirmed lifecycle/history/revision links, ran the Phase 3A rollback, rolled back temporary prerequisites, and confirmed the schema matched its starting state. No persistent migration was applied.

## 20. Known limitations

- Phase 3A supports one primary reviewer per revision; collaborative multi-review is not implemented.
- Participant resubmission/revision creation is intentionally absent.
- No Mentor UI or participant feedback UI exists yet.
- Rubric configuration reuses the generic Training criteria API; there is no dedicated Internship rubric screen.
- Evidence content remains unavailable while scanner output is `pending`; this is intentional.
- No aggregate assignment/program score or acceptance threshold exists.
- Rollback after real review data exists requires an approved export/removal plan and maintenance window.
- Production evidence enablement remains separately gated by scanner, storage operations, backup, retention, and change-window approval.

## 21. Regression findings

All previous 63 Internship tests continue to pass, alongside 16 new Phase 3A tests. Phase 2B-2 participant submission behavior remains schema-compatible when review is OFF. Learning projection, Current Focus, overall learning progress, assignment availability, generic Training data, and participant evidence freeze are unchanged.

`npm run smoke:unified-learning` continues to report the pre-existing out-of-scope debt: optional relation `learning_materials` is missing and SME decisions remain **337/371**. Phase 3A does not use or modify that path.

## 22. Phase 3B recommendation

**Phase 3B Mentor UI and participant feedback display may begin as feature-flagged development after Phase 3A API/security acceptance and migration deployment in a controlled test environment.** The queue, authorization matrix, fixed-revision detail, rubric, feedback visibility, optimistic locking, explicit decisions, and participant-safe read DTO provide a stable UI contract.

Participant revision/resubmission work should begin only after a Phase 3B design explicitly defines how `submission_revision` increments, how a new evidence set is created, and how historical reviewed evidence remains immutable. Production evidence access remains blocked until malware-scanning and storage-operational gates are satisfied.
