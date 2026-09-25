# BCL Internship Program — Phase 2B-2 Implementation Report

Date: 25 September 2026
Scope: Participant Submission & Evidence Upload UI
Status: Implemented and verified; production evidence enablement remains gated

## 1. Phase 2B-2 implementation report

Phase 2B-2 extends the existing Training → Magang / Internship assignment surface with the participant lifecycle `Belum Dikerjakan → Draft → Terkirim`. It reuses the Phase 2B-1 submission and evidence contract; no second submission store, mentor-review state, Projects integration, or learning-progress writer was added.

The UI stays embedded beneath each assignment and retains the Phase 2A hierarchy. Submission controls are rendered only when the assignment API advertises the participant-submission capability.

## 2. UI flow description

1. An available assignment with no submission shows `Belum Dikerjakan` and `Mulai Tugas`.
2. `Mulai Tugas` explicitly creates or resumes the one logical server-side Draft.
3. Draft shows a simple file picker, policy summary, safe evidence metadata, remove controls, and `Kirim Tugas`.
4. Upload shows minimal progress and locks other mutations until the request completes.
5. `Kirim Tugas` requires confirmation and then reloads the authoritative server state.
6. Submitted state shows `Terkirim`, server timestamp, evidence metadata, and a frozen notice. Upload, remove, replace, and submit controls are absent.

Learning Current Focus and overall learning percentage remain driven only by the existing learning APIs.

## 3. Files added

- `BC-Learning-Main/elearning-assets/js/internship-submission.js` — narrow file policy, safe status/error mapping, formatting, API path construction, and XMLHttpRequest upload progress helper.
- `backend/tests/internship-phase2b2-ui.test.js` — Phase 2B-2 participant UI and client-contract tests.
- `docs/BCL_INTERNSHIP_PHASE_2B2_IMPLEMENTATION_REPORT_20260925.md` — this report.
- `output/playwright/internship-phase2b2/internship-phase2b2-desktop.png` — desktop verification artifact, ignored runtime output.
- `output/playwright/internship-phase2b2/internship-phase2b2-mobile.png` — mobile verification artifact, ignored runtime output.

## 4. Files modified

- `BC-Learning-Main/elearning-assets/internship.html` — loads the submission helper before the page controller and updates asset cache versions.
- `BC-Learning-Main/elearning-assets/js/internship.js` — submission rendering, server reconstruction, upload, remove, submit, withdrawal-policy handling, concurrency guards, and enrollment-state isolation.
- `BC-Learning-Main/elearning-assets/css/internship.css` — compact inline submission/evidence styling, progress, status, frozen state, and narrow-screen stacking.
- `backend/routes/internshipRoutes.js` — publishes the boolean participant-submission capability on the assignment response.
- `backend/services/internshipProgramService.js` — includes server-authoritative `withdrawalAllowed` in the submission read response.
- `scripts/serve-internship-ui-fixture.js` — stateful browser fixture for draft/evidence/submit behavior and multi-program isolation.
- `backend/tests/internship-phase2a.test.js` — keeps the Phase 2A no-submission assertion scoped to feature-off rendering.
- `backend/tests/internship-phase2b1.test.js` — keeps Phase 2B-1 security assertions valid after the Phase 2B-2 UI is introduced.
- `package.json` — includes the Phase 2B-2 test file in `test:internship`.

No database schema or migration file was changed in Phase 2B-2.

## 5. API integration details

The page consumes the existing Phase 2B-1 endpoints for submission read/create, multipart evidence upload, Draft evidence soft-removal, submit, and policy-controlled withdrawal. URLs contain only the selected batch ID, assignment ID, action, and opaque evidence ID. The frontend never sends `participant_user_id`, submission ownership, a client timestamp, a storage key, or a file path.

The assignment response exposes `capabilities.participantSubmissions`. The UI does not probe or render submission behavior unless that exact capability is `true`. After every mutation it reloads the submission response from the API.

## 6. Draft creation behavior

Opening or rendering an assignment does not create a Draft. `Mulai Tugas` is the explicit mutation. The initiating control is disabled while the request is active, while Phase 2B-1 uniqueness/idempotency remains the authority for repeated requests and multiple tabs. A withdrawn submission can be resumed through the same controlled Draft action.

## 7. Evidence upload behavior

- Uses a simple, semantically labelled file picker; no drag-and-drop manager was added.
- Client allowlist remains PDF, DOCX, XLSX, CSV, JPG, JPEG, and PNG.
- Early client limits are 10 MiB per file and 5 evidence files per submission.
- The backend remains authoritative for filename, content/MIME, size, count, ownership, assignment availability, and submission-state validation.
- Upload is multipart field `evidence` and shows per-file request progress where the browser reports it.
- While uploading, evidence mutation and submit controls are disabled.
- A successful upload is reconstructed from the subsequent server response.
- Participant wording maps `pending` to `Menunggu validasi`; nothing promotes it to `clean`.

## 8. Evidence removal behavior

Draft evidence exposes `Hapus` only while the assignment is available and no mutation is active. The participant must confirm `Hapus evidence ini dari draft?`. The UI calls the Phase 2B-1 soft-delete endpoint and reloads the submission. No participant action performs a physical hard delete. Submitted evidence never renders a remove action, and backend state validation remains authoritative against tampered requests.

## 9. Submit behavior

`Kirim Tugas` is enabled only for an available Draft with at least one evidence item and no active upload/mutation. It shows the required freeze confirmation. The backend revalidates assignment availability, evidence policy, ownership, and submission state. Double-clicks are suppressed in the UI, while the backend handles races and multiple tabs.

## 10. Submitted/frozen UI behavior

Submitted state displays `Terkirim`, the server `submittedAt` value, safe evidence metadata, scan wording, and `Pengumpulan telah dikunci. Menunggu proses evaluasi.` It does not render upload, replace, remove, or submit controls. Withdrawal is absent by default and appears only when the submission API explicitly returns `withdrawalAllowed: true`.

## 11. Feature flag behavior

- `INTERNSHIP_ENABLED=false`: existing Phase 1 behavior keeps Internship unavailable.
- `INTERNSHIP_ASSIGNMENTS_ENABLED=false`: Phase 1B remains without assignments.
- `INTERNSHIP_SUBMISSIONS_ENABLED=false`: the assignment API advertises no submission capability and the page renders the Phase 2A assignment UI only.
- `INTERNSHIP_SUBMISSIONS_ENABLED=true`: participant submission/evidence controls become available.

The default submission flag remains OFF. Browser verification confirmed that turning submissions off removes `Status Pengumpulan` and `Mulai Tugas` while retaining Phase 2A assignments.

## 12. Security behavior

Phase 2B-1 authorization and storage behavior is unchanged: authenticated-principal ownership, batch/assignment object authorization, private quarantine storage, opaque evidence identity, safe response allowlists, SHA-256 integrity metadata, soft deletion, and Submitted freeze remain server-enforced.

The participant DOM includes only display name, type, size, upload time, and safe validation status. Tests verify that raw paths, UNC paths, storage keys, hashes, direct internal URLs, and participant identity authority are not introduced by the UI. Safe error mapping prevents backend details and stack traces from reaching participant copy. Executable/archive/native BIM file types remain excluded.

## 13. Playwright results

Real-browser verification used the Playwright CLI against the checked-in Internship UI fixture. All required scenarios passed:

- Available/no submission → `Mulai Tugas` visible.
- Explicit create → Draft UI appears.
- Supported PDF upload → evidence row appears with `Menunggu validasi`.
- Draft remove → confirmation shown and row removed.
- Unsupported EXE → `Jenis file tidak didukung.`
- Five evidence limit → `5 / 5 file` shown and picker removed.
- Submit → confirmation shown and state becomes `Terkirim`.
- Submitted → upload/remove controls absent.
- Refresh → state remains `Terkirim`, reconstructed from fixture API state.
- Submissions OFF → Phase 2A UI restored.
- Switching to the second Internship program → no stale submission/evidence state; switching back restores the first program state.
- 390 × 844 viewport → document `scrollWidth` equals `clientWidth`; no horizontal overflow.
- Console → 0 errors and 0 warnings in both submissions-on and submissions-off sessions.

## 14. Internship test results

`npm run test:internship` passed: **63 passed, 0 failed**. This includes all prior 52 Phase 1A/1B/2A/2B-1 tests plus 11 Phase 2B-2 tests.

The Phase 2B-2 tests cover feature-off rendering, explicit Draft start, safe evidence metadata, frozen Submitted state, upload locking/progress, withdrawal policy, allowlist/size/count/path validation, safe errors, scan wording, ownership-free API construction, script ordering, and fixture isolation/quarantine behavior.

## 15. Regression results

- JavaScript syntax checks for the changed frontend, backend, fixture, and test files: passed.
- `node --test backend/tests/p0-1-security.test.js backend/tests/p0-2-auth.test.js`: **2 passed, 0 failed**.
- `node scripts/smoke-elearning-theory.js`: passed.
- `npm run migrate:internship:submissions:validate`: passed; Phase 1A and 2A were temporarily applied as needed, the Phase 2B-1 schema was validated, and the transaction restored the starting schema.
- `git diff --check`: passed; only expected Windows LF/CRLF conversion warnings were emitted.
- `npm run smoke:unified-learning`: still reports the pre-existing, out-of-scope debt: optional relation `learning_materials` is absent and SME decisions remain **337/371**. No Phase 2B-2 code uses or changes that path.

## 16. Desktop screenshot

Desktop, 1440 × 1100 viewport, Submitted/frozen state:

![Phase 2B-2 desktop](../output/playwright/internship-phase2b2/internship-phase2b2-desktop.png)

## 17. Mobile screenshot

Mobile, 390 × 844 viewport, single-column Submitted/frozen state:

![Phase 2B-2 mobile](../output/playwright/internship-phase2b2/internship-phase2b2-mobile.png)

## 18. Known limitations

- Malware scanning is not operationally approved; evidence remains `scanStatus=pending` and quarantined.
- No participant preview or download endpoint is exposed in this phase.
- Upload UX intentionally handles one selected file/request at a time and has no background queue, pause, or retry manager.
- The browser fixture uses in-memory state for deterministic UI verification; it is not a storage or antivirus substitute.
- No live production storage, backup, retention, or disaster-recovery exercise was performed.
- No mentor review, rubric, score, feedback, revision request, accepted state, Projects browser, native BIM evidence type, or combined program progress was added.

## 19. Explicit production-readiness note

**Phase 2B-2 is not production-ready for unrestricted real project evidence.** The implementation is suitable for code review, controlled test environments, and feature-flagged acceptance. Production enablement remains blocked until all of the following are approved and exercised:

1. malware scanning policy and operational integration;
2. production storage operations and access controls;
3. backup and restore policy;
4. retention and deletion policy;
5. an approved production change window, including migration and rollback procedures.

Pending evidence must remain quarantined and must not be treated or exposed as trusted content.

## 20. Phase 3 Mentor Review recommendation

**Phase 3 design and feature-flagged development may begin after Phase 2B-2 product/security acceptance.** The submission boundary, ownership model, freeze behavior, safe evidence metadata, and participant state reconstruction are stable enough to serve as the input contract for mentor review.

Phase 3 must not be interpreted as approval to enable real evidence in production. Mentor access should be designed around an explicit authorization matrix and server-controlled evidence access, while the scanner/storage/backup/retention gates above remain independent release blockers.
