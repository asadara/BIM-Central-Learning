# BCL Internship Program — Phase 3B Implementation Report

Date: 25 September 2026
Scope: Mentor Review UI, participant feedback, controlled revision/resubmission, and revision history
Status: Implemented and verified; feature remains disabled by default

## 1. Executive outcome

Phase 3B is complete within the requested stop point. The implementation adds a native BCL mentor review workspace and extends the participant Internship assignment area with safe review results, immutable revision history, controlled Revision N+1 creation, revision-specific evidence, and resubmission.

The five state domains remain independent: learning, assignment, submission, review, and revision. Review decisions do not change canonical learning completion, assignment availability, overall Internship percentage, program completion, or certificate state. No Phase 4 final-evaluation or combined-progress behavior was added.

The `frontend-skill` visual direction produced a compact operational workspace: queue on the left, one linear review surface on the right, native BCL navigation, restrained status styling, and readable responsive stacking without decorative dashboard widgets.

## 2. Mentor Review UI

The new native page is `BC-Learning-Main/elearning-assets/internship-review.html`, with dedicated CSS and JavaScript. It is linked through the existing Training/Internship experience only for a role and capability that can review. Hiding the entry is a convenience; every read and mutation is still authorized by the backend.

The page provides:

- an authorized, program-scoped review queue;
- human-readable filters for all four review states;
- participant, assignment, revision, submission time, reviewer, and status context;
- assignment brief, required deliverable, related learning, and evidence;
- a rubric generated from the backend criteria and existing score scale;
- explicit `Simpan Review`, `Minta Revisi`, and `Terima Submission` actions;
- current claim owner and server timestamp;
- read-only behavior when the current actor cannot mutate the active review;
- safe conflict handling for an existing claim and a stale `reviewVersion`.

The detail hierarchy is deliberately linear: submission header, assignment context, evidence, rubric, feedback/internal note, then decision.

## 3. Participant Feedback UI

The existing Internship assignment/submission view now displays:

- `Belum Direview`, `Sedang Direview`, `Perlu Revisi`, or `Diterima` rather than raw enums;
- participant feedback, decision time, reviewed revision number, and terminal rubric scores;
- no draft scores while a review is in progress;
- no internal note, claim internals, reviewer version, or other participants' data;
- a revision-history list with revision number, submission time, decision, and review time;
- `Buat Revisi Baru` only after the current revision receives `revision_requested`;
- no revision action after acceptance.

Numeric criterion scores are visible only after a terminal decision. This is the explicit Phase 3B policy and can be made configurable when a broader Training policy is established.

## 4. Revision and resubmission lifecycle

The implemented lifecycle is:

1. Revision N is submitted and frozen.
2. Its own review reaches `revision_requested`.
3. The participant requests a new revision.
4. The server transaction validates identity, enrollment, assignment, latest decision, feature flags, and the absence of a newer active revision.
5. The server generates Revision N+1 as a draft with an empty evidence set and a parent reference.
6. Phase 2B file type, size, count, quarantine, and ownership rules apply to the new revision.
7. Submitting Revision N+1 freezes it and creates a new `not_started` review lifecycle.
8. Revision N remains immutable and historically addressable.

The client cannot provide a revision number, owner, assignment identity, or lineage identity. Two concurrent attempts cannot create parallel next revisions because the repository locks the logical submission, current review, and lineage rows inside one transaction.

## 5. Submission lineage model

The additive `submission_revisions` table represents one logical participant/assignment submission thread:

```text
Participant + Assignment + logical submission
  ├─ Revision 1 → submission/evidence/review 1
  ├─ Revision 2 → submission/evidence/review 2
  └─ Revision N → submission/evidence/review N
```

Key properties:

- monotonic, server-generated `revision_no`;
- `parent_revision_id` for explicit ancestry;
- one unique revision number per logical submission;
- one partial unique `is_current = true` row per logical submission;
- revision state and timestamps retained independently;
- participant and assignment identities remain canonical rather than duplicated;
- pre-Phase-3B active submissions are backfilled as Revision 1;
- each revision uses its own submission row, evidence rows, review row, scores, comments, and append-only review audit.

## 6. Migration files

- `backend/scripts/20260925-internship-phase3b.sql`
- `backend/scripts/20260925-internship-phase3b-rollback.sql`
- `backend/scripts/run-internship-phase3b-migration.js`

The migration is versioned and additive; there is no runtime DDL. The runner supports dry-run, validation, and explicit apply modes. Rollback refuses to remove the lineage model once revisions beyond Revision 1 exist, preventing destructive loss of revision history.

## 7. API changes

Existing Phase 3A review routes are reused:

- `GET /api/training/internships/:batchId/review-queue`
- `GET /api/training/internships/:batchId/submissions/:submissionId/review`
- `POST /api/training/internships/:batchId/submissions/:submissionId/review/start`
- `PATCH /api/training/internships/:batchId/submissions/:submissionId/review`
- `POST /api/training/internships/:batchId/submissions/:submissionId/review/decision`
- `GET /api/training/internships/:batchId/submissions/:submissionId/evidence/:evidenceId/content`

Phase 3B adds or extends participant-facing contracts:

- `GET /api/training/internships/:batchId/assignments/:assignmentId/submission/review` returns the safe current result plus history;
- `POST /api/training/internships/:batchId/assignments/:assignmentId/submission/revision` creates the server-authoritative next revision;
- existing submission and evidence endpoints operate on the current revision;
- review detail accepts an authorized historical `revision` query for inspection;
- `/me` and assignment DTOs expose safe capabilities for role/feature-aware UI rendering.

Rejected client-supplied revision identity or numbering cannot alter server selection. Reviewer identity is derived from the authenticated actor.

## 8. Review queue behavior

The queue is scoped in the repository/service layer before serialization. It shows active submitted work for the selected authorized program and supports `Semua`, `Belum Direview`, `Sedang Direview`, `Perlu Revisi`, and `Diterima`. A newly submitted Revision N+1 appears as its own `Belum Direview` queue item; Revision N remains historical rather than active work.

## 9. Evidence access behavior

Both mentor and participant evidence reads remain object-authorized and revision-scoped. Only `clean + stored` evidence can stream. Pending/quarantined, rejected, and failed evidence render safe user states and cannot be opened. Responses do not expose physical paths, storage keys, quarantine directories, UNC paths, or internal URLs.

## 10. Rubric UI behavior

Criteria, descriptions, ordering, required state, bounds, and existing score scale are rendered from backend data. No BIM criterion or score scale is hard-coded. Draft scores are saved only through the explicit save action and guarded by `reviewVersion` optimistic locking.

## 11. Participant feedback and internal-note separation

Participant feedback and internal notes use distinct inputs and backend fields. The participant-safe DTO is allow-listed and never includes the internal note. This separation is enforced in the service response, not with CSS. Automated tests additionally assert the absence of the note from participant responses.

## 12. Decision behavior

There are exactly two decisions: request revision and accept. Both require explicit confirmation. The backend verifies the `under_review` state, active claim owner, required rubric scores, required participant feedback for a revision request, and matching `reviewVersion`.

Acceptance freezes the revision's result without enabling a new participant revision. Revision request freezes Revision N and enables controlled creation of Revision N+1. Neither decision alters learning or overall program progress.

## 13. Revision creation behavior

Revision creation is transactional and only succeeds when the authenticated participant owns the latest logical submission, the latest review decision is `revision_requested`, the program/assignment still permits the operation, all feature flags are enabled, and no newer active revision exists. The server computes the next number and creates an empty draft. Historical evidence is never copied or unlocked.

## 14. Revision history behavior

Participants receive only their own safe history. Authorized reviewers can inspect historical revision detail and evidence under the same object-level policy. Each entry preserves the revision number, submission timestamp, review decision, review timestamp, safe feedback, and allowed terminal scores. Historical submission, evidence, scores, feedback, decisions, and timestamps are not mutated when a later revision is created.

## 15. Feature-flag and rollback behavior

The implementation respects all four existing flags:

- `INTERNSHIP_ENABLED`
- `INTERNSHIP_ASSIGNMENTS_ENABLED`
- `INTERNSHIP_SUBMISSIONS_ENABLED`
- `INTERNSHIP_REVIEW_ENABLED`

`INTERNSHIP_REVIEW_ENABLED` remains `false` by default and also gates revision creation, because controlled revision is inseparable from `revision_requested`; no additional flag was introduced. With review disabled, the accepted Phase 2B-2 submission flow continues, mentor review routes/UI are unavailable, participant review controls are absent, and repository queries do not require the Phase 3B lineage table.

## 16. Files added

- `BC-Learning-Main/elearning-assets/internship-review.html`
- `BC-Learning-Main/elearning-assets/css/internship-review.css`
- `BC-Learning-Main/elearning-assets/js/internship-review.js`
- `backend/scripts/20260925-internship-phase3b.sql`
- `backend/scripts/20260925-internship-phase3b-rollback.sql`
- `backend/scripts/run-internship-phase3b-migration.js`
- `backend/tests/internship-phase3b.test.js`
- `docs/BCL_INTERNSHIP_PHASE_3B_IMPLEMENTATION_REPORT_20260925.md`

## 17. Files modified

- `BC-Learning-Main/elearning-assets/internship.html`
- `BC-Learning-Main/elearning-assets/css/internship.css`
- `BC-Learning-Main/elearning-assets/js/internship.js`
- `backend/features/internshipFeature.js`
- `backend/repositories/internshipRepository.js`
- `backend/routes/internshipRoutes.js`
- `backend/services/internshipProgramService.js`
- `backend/services/internshipReviewService.js`
- `scripts/serve-internship-ui-fixture.js`
- `package.json`

The fixture was extended only for browser verification; it is not an alternate production authority.

## 18. Backend tests and totals

| Check | Result |
|---|---:|
| Complete Internship suite (`npm run test:internship`) | PASS — 97/97 |
| New Phase 3B backend cases | PASS — 18/18 |
| Phase 3A focused regression | PASS — 16/16 |

The 18 new cases cover every requested backend condition: creation-state rules, accepted/under-review rejection, duplicate prevention, server numbering, lineage isolation, historical submission/evidence/review immutability, separate evidence, new `not_started` review, participant and mentor authorization, internal-note exclusion, stale version, evidence authorization, and unchanged learning state/progress.

## 19. Security tests and totals

`node --test backend/tests/p0-1-security.test.js backend/tests/p0-2-auth.test.js`: PASS — 2/2.

Phase 3B tests also cover batch/submission/participant/revision/evidence object boundaries, wrong-owner access, wrong mentor scope, observer read-only behavior, participant denial from reviewer operations, server-derived identity, and internal-note non-disclosure.

## 20. Playwright mentor results

PASS — 15/15 requested scenarios:

1. authorized queue;
2. participant lacks mentor controls;
3. submitted revision detail;
4. safe evidence states;
5. start review;
6. dynamic rubric;
7. score save;
8. participant feedback save;
9. internal note absent from participant UI;
10. stale-version two-session conflict safely rejected and reloaded;
11. accept decision;
12. revision-request decision;
13. updated queue state;
14. normal desktop flow 0 console errors/0 warnings;
15. 390 × 844 layout has no critical horizontal overflow.

The deliberate stale-version request returns the required HTTP 409, which Chromium reports as one expected failed-resource diagnostic. There was no JavaScript exception or unhandled UI failure; the page displayed `Data berubah di sesi lain. Detail terbaru sudah dimuat.` and restored server data. Normal mentor flows remained console-clean.

## 21. Playwright participant results

PASS — 14/14 requested scenarios: waiting and in-review states, accepted state, no revision after acceptance, revision-request feedback, internal-note absence, Revision N+1 creation, frozen history, new draft, revision-specific evidence, resubmission, history persistence after refresh, program isolation, and no localStorage authority.

Normal participant flows reported 0 console errors/0 warnings. At 390 × 844, `document.documentElement.scrollWidth <= innerWidth` was true.

## 22. Desktop and mobile screenshots

- `output/playwright/internship-phase3b/mentor-review-desktop.png`
- `output/playwright/internship-phase3b/mentor-accepted-desktop.png`
- `output/playwright/internship-phase3b/participant-revision-requested-desktop.png`
- `output/playwright/internship-phase3b/participant-revision-2-desktop.png`
- `output/playwright/internship-phase3b/mentor-review-mobile.png`
- `output/playwright/internship-phase3b/participant-feedback-mobile.png`
- `output/playwright/internship-phase3b/mentor-stale-conflict-desktop.png`

Visual inspection confirmed native BCL composition, readable hierarchy, usable controls, and no core-field horizontal overflow. The fixed native BCL navigation can overlap part of a full-page capture while scrolling; this is existing shell behavior and does not block the review controls.

## 23. Known limitations

- The review/revision capability is intentionally disabled by default and has not been enabled in production.
- The browser fixture exercises contracts and UI but is not production storage or authorization infrastructure.
- Participant numeric scores use the Phase 3B terminal-only policy; an organization-wide configurable Training policy remains future work.
- No notifications, analytics, combined progress, final evaluation, certificate, Projects Explorer, BCL Online, or Data Bridge behavior was added.
- Existing unified-learning debt is unchanged: the optional `learning_materials` table is unavailable and SME decision 337/371 remains open.

## 24. Production evidence readiness

Phase 3B does not make evidence unrestricted-production-ready. The `clean + stored` gate remains intact. Production activation still requires approved malware-scanner operations, storage operations, backup policy, retention policy, and a controlled production change window. None was bypassed for the demo or tests.

## 25. Regression and verification findings

| Verification | Result |
|---|---:|
| Internship suite | PASS — 97/97 |
| Auth/security | PASS — 2/2 |
| Elearning theory smoke | PASS |
| Phase 3B migration validate + rollback | PASS |
| JavaScript syntax checks | PASS |
| `git diff --check` | PASS |
| Mentor Playwright | PASS — 15/15 |
| Participant Playwright | PASS — 14/14 |
| Normal browser console | PASS — 0 errors, 0 warnings |
| Narrow overflow check | PASS |

Migration validation built the temporary dependency chain through Phases 1A, 2A, 2B-1, and 3A, applied Phase 3B, verified the lineage table/current-revision index, then rolled the chain back successfully. The checked-in root/backend placeholder `npm test` scripts were intentionally not used, per repository guidance.

## 26. Phase 4 recommendation

Recommendation: **conditional GO for Phase 4 policy/design work, but not for production final-evaluation rollout**.

The technical foundation now cleanly separates learning, assignments, revisioned submissions, and per-revision reviews, so Program Progress / Final Evaluation policy can be specified next. Implementation or rollout should wait for explicit decisions on progress weighting, score visibility, final-evaluation authority, completion/certificate rules, and operational evidence controls. Phase 3B itself should first be migrated and enabled in a controlled non-production environment with the evidence prerequisites reviewed.

## Scope stop confirmation

Work stops at the requested Phase 3B boundary. No combined Internship progress, final evaluation, certificate issuance, production evidence rollout, Projects integration, BCL Online projection, or notification system was implemented.
