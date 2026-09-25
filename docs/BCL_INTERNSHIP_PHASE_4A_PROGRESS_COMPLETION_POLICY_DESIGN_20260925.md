# BCL Internship Program — Phase 4A Program Progress & Completion Policy Design

Date: 25 September 2026

Status: Proposed policy contract for approval

Scope: Architecture and policy only; no runtime implementation

## A. Executive Summary

Phase 4A recommends a deliberately small Internship completion model:

1. Display **Learning Progress**, **Assignment Submission Progress**, and **Assignment Acceptance Progress** as separate dimensions.
2. Do not publish or use one combined weighted Program Progress percentage for the initial pilot.
3. Derive `requirements_met` only when all frozen required learning and quizzes are complete and every frozen required assignment has a latest logical revision explicitly accepted by an authorized reviewer.
4. Store `completed` only after an authorized mentor or admin performs an explicit closeout while `requirements_met = true`.
5. Keep rubric scores descriptive. A score never silently accepts an assignment or completes the program.
6. Show terminal criterion scores, decision, and feedback to the participant; never show draft scores or internal mentor notes.
7. Keep revision count descriptive and non-punitive.
8. Keep attendance administrative for the initial pilot.
9. Keep structured Final Evaluation optional and separate from the completion gate. The required closeout is a short accountable action, not a duplicate rubric form.
10. Make completion create certificate **eligibility**, not a certificate itself.

The proposed participant lifecycle is:

```text
not_started → in_progress → requirements_met → completed
```

`requirements_met` is derived and rebuildable. `completed` is an explicit, stored, audited decision. Withdrawal is a separate participation status rather than another progress state.

The recommended policy location is an immutable, normalized Internship policy-version record referenced by `internship_batch_config`. The current mutable `policy_json` is useful as a compatibility seam but is not sufficient by itself for audit-grade version history.

This document does not implement any migration, service, API, UI, feature flag, formula, evaluation form, certificate, or production behavior.

## B. Existing Completion Architecture Audit

### Audit summary

| Structure | Current role and authority | Reuse in Phase 4B | Risk or restriction |
|---|---|---|---|
| `learning_path_versions` | A batch points to one published path version through `internship_batch_config`. This is the intended frozen curriculum identity. | Reuse as the learning denominator boundary. | The reference is immutable, but published modules/mappings are not fully protected against later direct mutation. A completion evaluator must fail closed on integrity drift. |
| `learning_path_modules` | Orders modules within a path version. Only active modules enter the current Internship projection. | Reuse module identity/order for explanation. | Filtering an unexpectedly inactive frozen module could silently shrink a denominator if reused without integrity checks. |
| `module_content_mappings` | Stores canonical content, `required`/`elective`, completion rule, mapping status, and sequence. | Authoritative required/optional semantics for page/video/PDF items. | Required mappings must be frozen with the published path version; `candidate`, rejected, retired, or missing mappings cannot count. |
| assessment definitions in `learning_path_versions.definition` | Defines quiz identity, module, required state, passing score, status, and href. | Authoritative quiz requirement set for the frozen version. | Only published definitions should count. Missing or mutated required quiz definitions are configuration blockers, not permission to reduce the denominator. |
| `learning_activity_events` | Server evidence for page/video/PDF completion. Phase 1 uses `event_type='completed'` and canonical completion-rule keys. | Reuse unchanged as activity evidence. | Opened events, browser state, and noncanonical module IDs are not completion. |
| verified `learning_attempts` | Server evidence for quiz pass; Phase 1 requires both `is_verified=true` and `passed=true`. | Reuse unchanged as quiz evidence. | Attempt count or unverified/local quiz history must never satisfy a requirement. |
| `training_batches` | Cohort/program run with start/end dates and cohort-level `draft`, `active`, `completed`, or `archived`. | Reuse cohort identity and schedule. | Batch `status='completed'` describes the cohort, not an individual participant. Dates currently have no automatic Internship-completion semantics and remain editable. |
| `batch_members` | Canonical enrollment and scoped role; includes enrollment status and `completed_at`. | Reuse enrollment, participant identity, and role scope. | `enrollment_status='completed'` can currently be set through generic membership administration without evaluating Internship requirements. `completed_at` lacks closeout actor, policy version, reason, and audit history; it is not sufficient completion authority. Hard deletion of membership would damage traceability. |
| `batch_topics` | Presentation grouping for classwork. | Reuse for labels/grouping only. | It is not a progress or requirement source. |
| `classwork_items` | Holds mutable batch classwork. Internship assignments are visible `practice_task` items in published/closed state. | Reuse assignment identity and content. | There is no frozen required/optional flag or assignment version. Items can be edited, archived, or deleted; deletion cascades into submissions. Current rows alone are unsafe as a historical denominator. |
| `classwork_content_links` | Connects assignment prerequisites/references to canonical learning content or quiz IDs. | Reuse for availability and explanation. | A prerequisite controls availability, not necessarily program completion. It must not create a second learning denominator. |
| `assignment_submissions` | One logical participant/assignment submission thread and its current revision state. | Reuse as the logical assignment anchor. | Generic legacy submission statuses are not equivalent to Phase 3 review acceptance. Do not infer acceptance from `score`, `reviewed`, or `completed` fields. |
| `submission_revisions` | Immutable lineage metadata for Revision 1..N with a unique current revision. | Reuse to select the current logical revision and preserve history. | Historical revisions must never increase the assignment denominator or numerator. |
| `submission_reviews` | Per-revision lifecycle with explicit `accepted` or `revision_requested`, claimant, timestamps, and optimistic version. | Authoritative acceptance decision for a revision. | Only terminal `accepted` satisfies an assignment. `not_started`, `under_review`, and `revision_requested` do not. |
| `submission_review_history` | Append-only transition audit. | Reuse for reconstructability and investigation. | It describes review transitions, not final program completion. |
| `review_criteria` / `review_scores` | Dynamic rubric and criterion results; supports required criteria, max score, and weight. | Reuse for descriptive assessment and participant feedback. | Criteria are mutable and scores do not have an approved completion threshold. Weighted scores must not silently become acceptance/completion authority. |
| `submission_comments` | Separates participant-visible feedback from internal comments. | Reuse safe participant feedback and internal audit context. | Internal visibility must remain excluded from participant and Online projections. |
| `batch_evaluations` | Generic manually upserted final status/score/note. Generic readiness also derives status from legacy submission counts. | May remain a separate generic Training evaluation or become an optional final mentor summary only after contract hardening. | It is mutable, lacks policy version and append-only history, accepts broad reviewer/observer scope, and does not evaluate Phase 1 learning or Phase 3 review states. It must not be reused as Internship completion authority as-is. |
| `attendance_sessions` / `attendance_records` | Generic Training attendance administration. | Reuse as an administrative metric and possible future optional gate. | No formal Internship threshold exists. Current records must not block pilot completion. |
| generic batch readiness endpoint | Uses non-archived task counts, legacy submission statuses, 80% completion, score 70, and generic final status. | Keep separate from Internship completion. | Its denominator, thresholds, and status derivation conflict with the versioned Internship contract. Calling it “ready” does not mean Internship requirements are met. |
| `user_certificates` | Verified certificate records, currently manually issued by admin and bound to approved official exam `quiz_id`. | Reuse only for existing exam certificates. | It is not an Internship completion record, and its uniqueness/issuance contract is exam-specific. Certificate existence must never back-propagate completion. |
| generic My Progress | Derives counts from server evidence and persists a rebuildable `user_progress` cache. | Useful global learning presentation, not Internship authority. | It is not cohort/path-version scoped and includes certificates/practice counts. It cannot determine Internship completion. |
| Dashboard / legacy readiness UI | Some presentation logic still takes maxima against local state or uses local readiness history. | None for completion authority. | Browser/localStorage state is explicitly unsafe for program policy. |
| My Training | Lists batch and enrollment statuses from generic Training. | Future entry point for a safe Internship summary. | Current cohort/enrollment labels are not proof of evaluated requirements. |
| `internship_batch_config` | Binds one Internship batch to an immutable published learning-path version and carries operational `policy_json`. | Reuse as the batch-to-policy reference seam. | `policy_json` is currently a mutable single document without policy history, checksum, frozen actor/time, or critical-field protection. |

### What is currently authoritative

- User identity: canonical authenticated user ID.
- Enrollment and scoped role: `batch_members`.
- Learning set: the batch's referenced published `learning_path_version_id`.
- Page/video/PDF completion: matching completed `learning_activity_events`.
- Quiz completion: verified and passed `learning_attempts`.
- Logical assignment thread: participant + assignment in `assignment_submissions` and its `submission_revisions` lineage.
- Assignment acceptance: explicit `submission_reviews.state='accepted'` for the relevant revision.
- Review audit: `submission_review_history`.

### Presentation or derived state only

- Percentages, counts, labels, blockers, and `requirements_met`.
- Generic readiness level and skill-gap presentation.
- Dashboard/My Training summaries.
- Any browser cache or localStorage marker.

### Dangerous sources to reuse as authority

- `training_batches.status='completed'` for individual completion.
- `batch_members.enrollment_status='completed'` without a closeout contract.
- `batch_evaluations.final_status` as currently implemented.
- Generic `assignment_submissions.score/status` rather than Phase 3 review decisions.
- Generic readiness thresholds.
- Certificate existence.
- Browser/localStorage progress.

## C. Progress Dimensions

The pilot should expose three independent descriptive dimensions and no combined percentage.

| Dimension | Numerator | Denominator | Display |
|---|---|---|---|
| Learning Progress | Completed required learning items and passed required quizzes | Frozen required items in the cohort's learning-path version | `8 / 10 selesai`, `80%` |
| Assignment Submission Progress | Required logical assignments whose current revision has reached submitted/review lifecycle | Frozen required assignment requirements | `5 / 6 terkirim` |
| Assignment Acceptance Progress | Required logical assignments whose applicable revision has explicit accepted decision | Frozen required assignment requirements | `4 / 6 diterima` |

Additional counts should be shown without becoming progress dimensions:

- revision required;
- draft/not submitted;
- under review;
- optional items completed;
- revision count as mentoring analytics.

No fourth Capstone dimension is recommended now. Repository audit found no implemented Capstone entity or workflow. A future Capstone should be represented as a required assignment with an appropriate rubric, not as another progress engine.

Historical revisions never affect denominators. Assignment A with Revision 1 requested and Revision 2 accepted counts as one required assignment, one submitted assignment, and one accepted assignment.

## D. Required vs Optional Model

### Learning

The only authoritative learning requirement marker remains the frozen learning-path version:

- content mapping `requirement_type='required'` blocks completion;
- `elective` does not block completion;
- published assessment `required !== false` blocks completion;
- optional/reference content does not block completion.

Do not duplicate these flags into Internship policy.

### Assignments

Current `classwork_items` has no versioned required/optional contract. The policy version must therefore carry one authoritative frozen assignment requirement manifest. Each entry should include:

- `assignmentId`;
- `requirement`: `required` or `optional`;
- stable participant label for explanations;
- definition digest or revision marker to detect drift.

The manifest is a policy snapshot, not a second mutable flag on `classwork_items`. An assignment absent from a valid manifest is a configuration error, not implicitly optional.

For the initial Internship pilot, policy validation should require at least one required learning/quiz item in the frozen path and at least one required assignment. This prevents vacuous completion.

## E. Learning Progress Policy

1. The denominator comes only from the cohort's frozen published learning-path version.
2. Required page/video/PDF items are complete only with matching authoritative `learning_activity_events` completion evidence.
3. Required quizzes are complete only with a verified, passed `learning_attempts` record.
4. Optional/elective items may be displayed separately but never change the required percentage.
5. Unavailable or unexpectedly inactive required content remains in the required set and produces a `configuration_blocked` requirement. It must not silently disappear from the denominator.
6. Content removed after freeze must fail integrity validation. The current foreign keys help, but published/frozen modules and mappings also need future mutation protection.
7. A new global learning-path version does not affect an active cohort; the batch remains bound to its original version.
8. No new learning progress table or browser writer is proposed.

## F. Assignment / Acceptance Policy

Use two concise metrics:

- **Tugas Terkirim**: current logical revision has been submitted and remains in a submitted/review state.
- **Diterima Mentor**: the applicable revision has an explicit accepted decision.

`revision_requested` and `under_review` count as submitted for descriptive submission progress but not accepted. Draft and not-created work count as not submitted. Acceptance is sufficient proof of prior submission, so the completion gate need only require acceptance of every required assignment; a second submitted gate would be redundant.

Closed or archived UI state must not remove a frozen required assignment. An archived required assignment either retains its historical requirement/evidence or becomes a visible configuration blocker requiring controlled policy remediation.

## G. Revision Policy

- Revision count does not reduce progress, score, eligibility, or completion.
- Only the current logical revision is used for operational state.
- The accepted revision satisfying the requirement remains historically identifiable.
- A revision request is descriptive mentoring data and a current blocker until a later revision is accepted.
- Historical evidence, feedback, scores, and decisions remain immutable.
- Revision analytics may later expose count and turnaround time to authorized mentors, but not as punitive scoring.

Rationale: revision is an intended learning loop. Penalizing it automatically would discourage early feedback, reward late submission behavior, and introduce an unapproved grading policy.

## H. Rubric / Score Policy

Recommended pilot model: **explicit reviewer acceptance is authoritative; numeric scores are descriptive**.

- Required rubric fields must still be completed before the reviewer can decide, as Phase 3 already enforces.
- There is no minimum assignment score or weighted program score in the pilot.
- `score >= X` never auto-accepts an assignment.
- A reviewer may accept a low-scoring but adequate submission or request revision on a high aggregate with a critical deficiency; the explicit audited decision remains the authority.
- Rubric configuration should be frozen for a submitted revision. Later rubric changes apply to future work or an explicit version, never retroactively to decided reviews.
- No final Internship numeric score is proposed initially.

## I. Attendance Policy

Attendance remains an administrative metric in the initial pilot:

- display to authorized staff if useful;
- do not include it in `requirements_met`;
- do not derive failure from absence automatically;
- do not include attendance in a combined percentage.

Attendance may become a future gate only after an approved formal rule defines eligible sessions, threshold, treatment of `late` and `excused`, correction authority, cohort freeze, and appeals. Until then, coupling it to completion would be arbitrary.

## J. Final Evaluation Policy

The existing `batch_evaluations` facility is not safe as Internship completion authority. It is a generic mutable summary that can derive values from legacy submission status and broad role access.

For the pilot:

- a structured Final Evaluation is **optional**;
- it is a mentor summary after requirements are met, not a duplicate of every assignment rubric;
- it is not a completion gate and does not create a final score;
- the explicit program closeout is mandatory but deliberately short: confirm requirements, optional closeout note, and submit the audited action.

If a later official syllabus approves final dimensions, they belong in the immutable program policy version and should be rendered dynamically. Candidate dimensions in the brief must not be hard-coded before that approval.

This design avoids leaving fully qualified participants indefinitely incomplete because a redundant long evaluation form was not filled. Operational UI should still surface a closeout queue and escalation after `requirements_met`.

## K. Program Status Lifecycle

### Primary participant program states

| State | Indonesian label | Entry condition | Exit condition | Authority |
|---|---|---|---|---|
| `not_started` | Belum Dimulai | Active enrollment, no authoritative completed required learning, no draft/submitted assignment, and no closeout | First authoritative progress or assignment activity | Derived by system |
| `in_progress` | Sedang Berjalan | Active enrollment with activity but one or more requirements unmet | All requirements met, or participation withdrawn | Derived by system |
| `requirements_met` | Persyaratan Terpenuhi | Every frozen required gate passes and no integrity blocker exists | Explicit closeout, a controlled policy reassignment, or withdrawal | Derived by system |
| `completed` | Selesai | Authorized closeout while requirements are met | Admin-only controlled reopen | Stored audited action |

`withdrawn` is a separate participation state mapped from a controlled non-active enrollment status. It overrides normal progress presentation but preserves historical summary. `paused` is not proposed because the repository has no approved pause lifecycle. Cohort cancellation remains a batch-level concern.

### Time and program-period policy

1. A participant may meet requirements early.
2. Early requirement completion does not auto-complete the program.
3. For the initial pilot, an authorized mentor/admin may close out early after `requirements_met`; no formal minimum duration exists in the repository.
4. Passing `end_date` with unmet requirements does not automatically fail, close, or delete access. The participant remains in progress with an explicit `program_period_elapsed` operational blocker/attention signal.
5. A reviewer requesting revision near or after the end date must not create an impossible workflow. The revision remains allowed while enrollment is active, or an admin must explicitly extend/withdraw under policy.
6. Program extension is admin-only, requires reason and audit, and changes the schedule rather than the frozen requirement denominator.
7. Cohort-level `training_batches.status` must not overwrite participant program state.

## L. Requirements-Met Logic

Conceptual evaluator:

```text
requirements_met =
  active_participation
  AND frozen_policy_integrity_valid
  AND all_required_learning_items_completed
  AND all_required_quizzes_verified_and_passed
  AND all_required_assignments_have_explicit_accepted_review
```

Not included:

- optional learning or assignments;
- revision count;
- numeric rubric threshold;
- attendance;
- end-date passage;
- certificate presence;
- structured Final Evaluation;
- one combined percentage.

The evaluator must return structured blockers, not only `false`:

- unmet required learning;
- required quiz not passed;
- required assignment not submitted;
- assignment under review;
- revision required;
- required assignment not accepted;
- frozen content/assignment missing or changed;
- inactive/withdrawn participation;
- closeout pending after requirements are met.

## M. Final Closeout Authority

Recommended authority split:

- **System:** derives dimensions, blockers, integrity, and `requirements_met`.
- **Mentor:** may close out participants in their authorized batch when policy allows and `requirements_met=true`.
- **Reviewer:** may review assignments but does not automatically receive program closeout authority.
- **Admin/system admin:** may close out, perform controlled override, or reopen with elevated audit requirements.
- **Observer:** read-only when explicitly allowed.
- **Participant:** reads own summary only.

Future closeout should store:

- participant and batch identity;
- immutable policy-version ID and checksum;
- `completed_at` and canonical `completed_by`;
- optional closeout note;
- evaluated requirements snapshot/digest;
- append-only action/audit record.

Completion is stable. Reopen is admin-only, requires reason, records previous/new state, actor, timestamp, and policy version, and never deletes the original closeout record. A mentor cannot casually toggle completion.

Admin override should be exceptional. It requires an explicit reason and an append-only audit event; the response should distinguish `normal_closeout` from `admin_override`. Direct database edits are not a normal workflow.

## N. Certificate Policy

- Program completion determines `certificateEligible=true`.
- Completion does not auto-issue a certificate.
- Certificate issuance is a separate authorized action and may have operational/template checks.
- A certificate is an output, never the source of completion truth.
- Revoking or correcting a certificate does not silently reopen a completed program.
- The current exam-bound `user_certificates` contract is not suitable for Internship certificates without a separately approved extension.

## O. Score Visibility

Recommended participant policy:

- show terminal review decision;
- show participant feedback;
- show individual criterion scores and criterion comments after a terminal decision;
- do not show draft scores during `not_started` or `under_review`;
- do not calculate or present a final program score;
- never expose internal mentor notes.

This preserves Phase 3B transparency and makes feedback actionable without turning the program into a score race. If governance later chooses qualitative-only visibility, that is a critical policy-version change and must not apply silently mid-cohort.

## P. Policy Versioning

### Recommended model

Use a small normalized immutable policy-version model in Phase 4B, referenced from `internship_batch_config`. Conceptually:

```text
internship_program_policy_versions
  id
  policy_key
  version_number
  status: draft | frozen | retired
  payload_json
  checksum
  created_by / created_at
  frozen_by / frozen_at

internship_batch_config
  batch_id
  learning_path_version_id
  policy_version_id
```

The policy payload should absorb existing relevant `policy_json` options so there is one policy authority. Existing documents can be migrated into Version 1 during a future Phase 4B migration. The current `policy_json` should not remain a second mutable authority after cutover.

### Why normalized versions are recommended

The current single `policy_json` field cannot preserve prior versions when overwritten and has no checksum or frozen actor/time. A one-table immutable version model gives auditability, reusable policy templates, controlled assignment to cohorts, and safe comparison without normalizing every policy field into many columns.

### Freeze point

Critical policy is frozen before the batch becomes active or before the first participant activity, whichever occurs first. An active cohort cannot mutate critical fields in place.

### Critical fields

- learning-path version reference;
- assignment requirement manifest and definition digests;
- acceptance rule;
- score role and participant visibility;
- attendance gate setting;
- Final Evaluation gate setting;
- early closeout rule;
- completion authority roles;
- certificate eligibility rule;
- blocker/integrity behavior;
- policy contract/calculation versions.

A necessary active-cohort change creates a new policy version, requires impact preview and explicit batch reassignment, records reason/actor/time, and never rewrites historical completion evidence. Prefer applying changes to new cohorts unless correction is essential.

## Q. Authorization Matrix

| Capability | Participant | Mentor | Reviewer | Observer | Admin/System Admin |
|---|---:|---:|---:|---:|---:|
| Read own summary | Yes | Own summary if enrolled | Own summary if enrolled | Own summary if enrolled | Yes |
| Read participant summary | No | Authorized batch | Authorized review scope, read-only | Explicit policy, read-only | Yes |
| Review assignment | No | Yes | If review policy allows | No | Yes |
| Close program normally | No | If closeout policy allows | No | No | Yes |
| Override completion | No | No | No | No | Yes, reason required |
| Reopen completed program | No | No | No | No | Yes, reason required |
| Change/freeze policy | No | No | No | No | Designated admin governance only |
| Issue certificate | No | No by default | No | No | Separate certificate authority |

Review authority and completion authority are intentionally independent. Object-level batch and participant authorization remains server-side; hiding controls is not authorization.

## R. Edge Cases

| Edge case | Safe policy behavior |
|---|---|
| 1. Requirements completed before program end | Derive `requirements_met`; allow early audited closeout in the pilot. Do not auto-complete. |
| 2. End date passes while assignments are incomplete | Remain `in_progress`; return unmet requirements plus `program_period_elapsed`. No automatic failure or closure. |
| 3. Assignment archived after cohort freeze | Keep it in the frozen denominator. Preserve accepted/history data. If it becomes impossible to act on, return a configuration blocker for controlled remediation. |
| 4. Required content becomes unavailable | Do not shrink denominator. Mark configuration integrity blocked and require restoration or explicit policy-version migration. |
| 5. Revision requested near/after end date | Allow the required revision while enrollment remains active, or require an explicit admin extension/withdrawal. Never strand the participant automatically. |
| 6. Accepted assignment definition changes | The accepted result continues to satisfy the frozen assignment definition/digest. New definition applies to a new policy/cohort, not retroactively. |
| 7. Participant withdraws | Set participation to withdrawn/dropped through a controlled status change, preserve history, deny new work, and do not mark completed. |
| 8. Enrollment is removed | Do not hard-delete an enrollment with Internship activity. Use a retained status and audit. Existing generic delete behavior is unsafe for completed-history governance. |
| 9. Mentor changes | New authorized mentor may continue review/closeout; historical actions retain original canonical actors. |
| 10. Program is extended | Admin changes schedule with reason/audit. Requirement and scoring policy remain the same unless separately versioned. |
| 11. Rubric changes mid-cohort | Do not alter decided reviews or in-flight revision snapshots. Publish a new rubric/policy version for future applicable work. |
| 12. Optional item becomes required | Do not flip it in place. Prefer next cohort; otherwise create a new policy version with impact preview and explicit reassignment. |
| 13. Content path version changes | Existing cohort stays on its frozen path version. New version is used only by explicitly configured future cohorts. |
| 14. Assignment is accidentally deleted | Treat as integrity failure, not successful completion. Restore from recovery data; future Phase 4B must protect frozen required assignments from hard deletion. |

If a completed participant later encounters source-data drift, completion remains stable and an integrity alert is raised. Only an audited admin reopen changes completed state.

## S. Online Compatibility

BCL Internal remains authoritative for Internship enrollment, submission/review, confidential evidence, internal feedback, requirement evaluation, and final closeout.

A future BCL Online projection may include only an approved derived subset:

- program ID/public label;
- participant's own program status label;
- required/completed learning counts;
- required/submitted/accepted assignment counts;
- safe unmet requirement labels;
- completion date and certificate eligibility if approved.

It must not include evidence, storage identifiers, project identifiers, internal mentor notes, review claim/version internals, other participants' information, or administrative override detail. Online must remain a projection, never a second completion authority. Projection packages need policy/calculation schema versions and monotonic revision so stale summaries cannot overwrite newer ones.

## T. Options / Tradeoff Analysis

| Decision | Alternatives and advantages | Risks / complexity | Recommendation |
|---|---|---|---|
| Separate dimensions vs combined percentage | Separate metrics are explainable and map directly to authoritative states. One percentage is compact. | Combined weighting hides blockers, double-counts related submission/acceptance, and has no defensible weights. | Separate Learning, Submitted, and Accepted dimensions. No combined pilot percentage. |
| Explicit acceptance vs score threshold | Explicit acceptance supports professional judgment and matches Phase 3. Threshold is mechanically consistent. | Threshold can accept critical deficiencies and creates appeals/config burden. | Explicit acceptance remains authoritative; scores descriptive. |
| Automatic completion vs derived requirements + closeout | Auto completion is fast. Closeout adds accountability and handles operational exceptions. | Closeout can create backlog if the UI lacks a queue/SLA. | Derive `requirements_met`, then require short mentor/admin closeout with admin fallback. |
| Automatic certificate vs eligibility | Auto issuance is convenient. Eligibility separates governance and artifact operations. | Auto issuance couples templates/storage/revocation to completion. | Completion creates eligibility; separate authorized issuance. |
| Attendance gate vs administrative metric | Gate may support formal attendance rules. Administrative mode avoids arbitrary blocking. | No approved eligible-session or threshold policy exists. | Administrative only in pilot. |
| Revision penalty vs descriptive only | Penalty may discourage repeated poor work. Descriptive treatment supports mentoring. | Automatic penalty is punitive, gameable, and lacks approved basis. | Revision count descriptive only. |
| Numeric scores vs qualitative only | Criterion scores improve transparency; qualitative-only reduces score fixation. | Numeric display may invite comparison, but hiding existing rubric outcomes reduces actionability. | Show terminal criterion scores plus feedback; no draft/final program score. |
| Current `policy_json` vs normalized policy versions | `policy_json` is lowest initial effort. Immutable version records provide history, checksum, reuse, and controlled cohort assignment. | Normalized versions require one future migration/service contract; mutable JSON cannot meet freeze/audit requirements alone. | Normalized immutable policy-version record with JSON payload, referenced by batch config. |

## U. Recommended Minimal Pilot Policy

1. The cohort uses one frozen published learning-path version.
2. All required learning mappings must have authoritative completed activity evidence.
3. All required quizzes must have verified passed attempts.
4. The frozen assignment manifest identifies every required and optional assignment.
5. Every required assignment must have an explicit accepted review for its applicable logical revision.
6. Optional learning and assignments do not block completion.
7. Revision count does not penalize score or completion.
8. Rubric scores are descriptive; acceptance remains an explicit human decision.
9. Participants see decision, feedback, and terminal criterion scores only.
10. Attendance is administrative.
11. Structured Final Evaluation is optional and does not block completion.
12. The system derives `requirements_met`; an authorized mentor/admin performs explicit closeout.
13. Requirements may be met and closed out early.
14. End-date passage does not automatically fail or complete a participant.
15. Completion creates certificate eligibility but does not issue a certificate.
16. No combined weighted progress percentage is calculated.

This is deterministic, understandable, auditable, and directly compatible with the accepted Phase 1–3B architecture.

## V. Proposed Data Contract

### Conceptual policy document

```json
{
  "contractVersion": "internship-program-policy-v1",
  "policyVersion": 1,
  "learning": {
    "pathVersionSource": "internship_batch_config.learning_path_version_id",
    "requiredContentRule": "all_required_completed",
    "requiredQuizRule": "all_required_verified_passed",
    "unavailableRequiredItem": "configuration_blocked"
  },
  "assignments": {
    "manifest": [
      {
        "assignmentId": "assignment-id",
        "label": "Stable participant label",
        "requirement": "required",
        "definitionDigest": "sha256:..."
      }
    ],
    "requiredRule": "all_required_explicitly_accepted",
    "historicalRevisionCounting": "logical_assignment_once"
  },
  "reviews": {
    "explicitAcceptance": true,
    "revisionCountPenalty": false
  },
  "scores": {
    "completionThreshold": null,
    "finalProgramScore": false,
    "participantVisibility": "terminal_criterion_scores_and_feedback"
  },
  "attendance": {
    "completionGate": false
  },
  "finalEvaluation": {
    "required": false,
    "affectsCompletion": false
  },
  "program": {
    "allowEarlyRequirementsMet": true,
    "allowEarlyCloseout": true,
    "autoComplete": false,
    "closeoutRequired": true,
    "endDateAction": "attention_only"
  },
  "certificate": {
    "automatic": false,
    "eligibleAfterCompletion": true
  }
}
```

Values are conceptual and illustrative; no database row or runtime parser has been created.

### Future derived participant response

```json
{
  "programId": "batch-id",
  "policyVersion": 1,
  "calculationVersion": "internship-program-status-v1",
  "programStatus": "in_progress",
  "programStatusLabel": "Sedang Berjalan",
  "participationStatus": "active",
  "requirementsMet": false,
  "learning": {
    "required": 10,
    "completed": 8,
    "percent": 80
  },
  "assignments": {
    "required": 6,
    "submitted": 5,
    "accepted": 4,
    "underReview": 0,
    "revisionRequired": 1,
    "notSubmitted": 1
  },
  "unmetRequirements": [
    {
      "type": "required_learning",
      "label": "Materi wajib",
      "current": 8,
      "required": 10,
      "references": []
    },
    {
      "type": "required_assignment_acceptance",
      "label": "Tugas diterima mentor",
      "current": 4,
      "required": 6,
      "references": []
    }
  ],
  "closeout": {
    "required": true,
    "eligible": false,
    "completedAt": null
  },
  "certificateEligible": false,
  "authority": "server-derived"
}
```

`references` must contain only safe opaque IDs and participant-safe labels/links. It must never contain paths, storage keys, or internal notes.

### Derived vs stored

| Derived/rebuildable | Stored/audited |
|---|---|
| Learning counts and percentage | Immutable policy version and checksum |
| Required/submitted/accepted assignment counts | Policy-to-batch assignment |
| Revision-required/under-review counts | Explicit closeout action |
| Unmet requirement list | Closeout actor/time/note |
| `requirements_met` | Requirements snapshot/digest at closeout |
| `not_started`, `in_progress`, `requirements_met` | Admin override/reopen audit events |
| Certificate eligibility | Issued certificate artifact, separately |

No authoritative `internship_progress`, `internship_learning_progress`, or `internship_assignment_progress` table is proposed. A rebuildable cache may be added only if later performance evidence justifies it.

## W. Proposed Future APIs

Avoid separate APIs that return overlapping progress and status models. Recommended minimal contracts:

```text
GET  /api/training/internships/:batchId/program-status
     Participant reads own complete derived summary.

GET  /api/training/internships/:batchId/participants/:userId/program-status
     Authorized mentor/admin/observer reads scoped summary.

GET  /api/training/internships/:batchId/participant-statuses
     Authorized mentor/admin list for operational closeout/blocker summary.

POST /api/training/internships/:batchId/participants/:userId/complete
     Authorized closeout; server re-evaluates requirements in the same transaction.

POST /api/training/internships/:batchId/participants/:userId/reopen
     Admin-only controlled reopen with mandatory reason.
```

The existing Internship `/progress` endpoint should remain the learning-only Phase 1 contract for backward compatibility. The future `program-status` endpoint composes it internally with assignment/review data rather than forcing clients to merge competing authorities.

A Final Evaluation API should be added only if its optional structure is separately approved. Certificate issuance remains outside these endpoints.

## X. Proposed Phase 4B Scope

After policy approval, Phase 4B should implement only:

1. versioned/frozen program-policy persistence and migration with validate/rollback paths;
2. assignment requirement-manifest validation and frozen-definition integrity checks;
3. server-derived program-status evaluator over existing authoritative evidence;
4. separate learning/submission/acceptance counts;
5. structured participant-safe unmet requirement explanations;
6. participant summary endpoint/UI;
7. mentor scoped list/detail summary;
8. deterministic `requirements_met` projection;
9. explicit mentor/admin closeout, policy snapshot, and append-only audit;
10. admin-only override/reopen with reason and audit;
11. object-level authorization and comprehensive regression tests;
12. BCL Online-safe projection schema definition only if separately requested.

Phase 4B should not implement certificate issuance, combined weighting, attendance gate, mandatory structured Final Evaluation, Capstone engine, AI grading, evidence-production bypass, notifications, Projects integration, or BCL Online synchronization unless separately approved.

## Y. Risks / Open Decisions

### Decisions recommended for approval

- No combined percentage.
- Explicit acceptance over score threshold.
- Derived `requirements_met` plus explicit closeout.
- Terminal criterion-score visibility.
- Attendance and structured Final Evaluation are not gates.
- Normalized immutable policy versions.
- Early closeout allowed for the pilot.

### Technical risks to handle in Phase 4B

1. Published learning-path internals are semantically versioned but need stronger protection against direct mutation.
2. `classwork_items` is mutable and has cascading deletion; frozen required assignments need integrity protection.
3. Existing `batch_members.completed_at` and generic completed enrollment status can be changed outside a future closeout service.
4. Generic `batch_evaluations` and readiness labels can conflict with Internship terms; UI/API naming must keep them separate.
5. Mentor membership is batch-wide; there is no narrower participant-to-mentor assignment model. Pilot closeout therefore scopes mentor authority to the batch.
6. Closeout queues need an operational owner/SLA to prevent `requirements_met` participants waiting indefinitely.

### Production evidence gate

Evidence operational readiness is not part of the mathematical completion rule. It is a production rollout prerequisite. Unrestricted production activation remains blocked until malware scanning policy/integration, storage operations, backup, retention, and the production change window are approved. The completion evaluator should consume accepted review decisions, not attempt to become a scanner-readiness engine.

### Existing technical debt

- The unavailable optional `learning_materials` table does not affect the current canonical Internship path, but becomes a reliability risk if a future frozen path depends on it. Such a dependency must fail preflight.
- SME decision 337/371 means the broader learning mapping inventory is not fully approved. A cohort must freeze only approved mappings; unresolved candidates cannot enter a required denominator.

Neither debt item is changed by Phase 4A.

## Z. Approval Checklist

- [ ] Approve separate Learning, Submitted, and Accepted dimensions.
- [ ] Approve no combined weighted Program Progress percentage for the pilot.
- [ ] Approve frozen learning-path and assignment requirement sets.
- [ ] Approve explicit review acceptance as assignment authority.
- [ ] Approve revision count as descriptive only.
- [ ] Approve numeric criterion scores as descriptive and visible only after terminal decision.
- [ ] Approve attendance as administrative only.
- [ ] Approve structured Final Evaluation as optional/non-blocking.
- [ ] Approve four-state program lifecycle and separate withdrawal status.
- [ ] Approve early requirements-met and early closeout behavior.
- [ ] Approve no automatic failure/completion at end date.
- [ ] Approve system-derived `requirements_met` plus mentor/admin closeout.
- [ ] Approve reviewer and observer exclusion from closeout authority.
- [ ] Approve admin-only audited override/reopen.
- [ ] Approve completion as certificate eligibility, not auto-issuance.
- [ ] Approve immutable normalized policy versions referenced by batch configuration.
- [ ] Approve derived-vs-stored classification and no new progress writer.
- [ ] Approve participant-safe blocker contract.
- [ ] Approve the bounded Phase 4B scope.
- [ ] Confirm operational owner/SLA for closeout after requirements are met.

## Phase 4A Stop Confirmation

Phase 4A stops with this proposed policy/design document. No source code, schema, migration, service, API, UI, final-evaluation form, certificate logic, progress formula, feature flag, or production behavior was implemented or changed. Phase 4B must wait for explicit policy approval.
