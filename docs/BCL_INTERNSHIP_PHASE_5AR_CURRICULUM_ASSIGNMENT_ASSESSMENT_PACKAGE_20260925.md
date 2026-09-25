# BCL Internship Program — Phase 5A-R Curriculum, Assignment & Assessment Package Remediation

Tanggal: 25 September 2026
Status artifact: **PROPOSED — NOT DEPLOYED**
Technical/configuration readiness: **HOLD — 37-ITEM RECONCILIATION REVIEW REQUIRED**
Scope stop: curriculum/configuration package only; no batch creation, enrollment, feature activation, evidence, review, closeout, certificate, Projects integration, or BCL Online.

Follow-up status: the mentor subsequently approved the reconciliation decisions and they were implemented as a separate proposed manifest v3 package. The historical v2 HOLD analysis below remains unchanged for audit context; current implementation and readiness results are recorded in `BCL_INTERNSHIP_PHASE_5AR_MANIFEST_V3_IMPLEMENTATION_20260925.md`.

## A. Executive Summary

Phase 5A-R addresses the Phase 5A root cause by producing a cross-validated candidate v2 package:

- 1 required learning item;
- 10 optional/reference learning items outside the denominator;
- 0 required quizzes;
- 5 consolidated required practical assignments;
- 1 optional/conditional automation assignment;
- capstone and the external-batch smoke task excluded;
- 5/5 required assignments with clear briefs, safe deliverables, usable rubrics, and evidence-compatible formats.

The package validates with zero structural errors. The later-supplied mentor work-program source, `Program_Tugas_Internship_BIM_Ridho.docx`, materially changes the curriculum-readiness conclusion: the five required assignments broadly cover the foundation, coordination, 4D, QTO, and delivery demonstrations, but the current one-item required-learning denominator and optional automation classification do not yet represent the full mentor intent. Phase 5B is therefore **on hold pending reconciliation review**, even though the package remains technically valid.

The reconciliation does not turn 37 activities into 37 assignments. It recommends retaining a small consolidated assignment set, reviewing a new manifest v3 before any freeze, and treating the attached document as mentor program intent rather than an official MagangHub syllabus, database seed, rubric, or completion formula.

Manifest v1 was not edited. Its byte SHA-256 remains `db9d53ddf5f78420d1e39637f19fad96e9af16dfb76f98e9732636bf01652c90`.

## B. Phase 5A Blocker Review

| Phase 5A blocker | Remediation | Result |
|---|---|---|
| 0 required assignments | Five meaningful competency demonstrations proposed | Resolved at package level |
| No executable briefs | Full context, instruction, workflow, deliverable, effort, dependency, and acceptance expectation | Resolved |
| Rubrics missing | Five required + one optional rubric, five criteria each | Resolved |
| Evidence compatibility unknown | All required outputs use locked safe allowlist, max 5 files/10 MiB each | Resolved |
| Unsafe automatic required fallback | Existing conservative behavior retained and tested | Resolved |
| Case data unavailable | Explicit sanitized/synthetic execution contracts prepared | Phase 5B operational condition |
| Batch/policy/users/dates absent | Deliberately not deployed in Phase 5A-R | Phase 5B operational condition |

## C. Source Documents Reviewed

Priority sources reviewed:

1. approved Phase 4A completion policy;
2. accepted Phase 1–4 implementation artifacts and current code/tests;
3. Phase 5A audit and immutable v1 manifest;
4. current `learning-paths.json`, canonical registry/database, and mapping-candidate inventory;
5. BCL training readiness/review documents;
6. current assignment, evidence, review, and completion services;
7. mentor work-program source `Program_Tugas_Internship_BIM_Ridho.docx`, SHA-256 `ebbd07f538704b1f4aa3be5009ec0b2a5f334f71c31a2ada6af2c6825bed404d`.

The repository search still found no official MagangHub 37-task syllabus. The attached document is instead treated exactly as supplied: a **mentor-level BIM Division work program** describing activities, practices, and expected outputs. It is not treated as an official syllabus, seed, manifest, 37 formal assignments, progress weighting, rubric, API contract, or replacement learning catalog.

The 337-item mapping file explicitly says decisions remain SME candidates and are not publishable without review. Candidate mappings therefore remain optional/reference only; they are not silently promoted to required learning.

## D. Program Taxonomy

The four locked development areas are retained:

| Taxonomy | Proposed coverage |
|---|---|
| BIM Fundamental | Mindset, model quality/information, QTO readiness |
| BIM Coordination | Federation/clash and 4D integration |
| Automation / Digital Engineering | 4D digital integration plus optional workflow improvement |
| Documentation / Delivery | QA/QC evidence, issue traceability, QTO reconciliation, delivery package |

The direct reconciliation brief describes the four areas as a conceptual 25/25/25/25 balance. The attached DOCX itself records **25% Fundamental, 25% Coordination, 40% Automation, and 10% Documentation**. This discrepancy requires mentor confirmation before manifest metadata is revised. Under either interpretation, the percentages are taxonomy/program-emphasis labels only: they are not progress weighting, score weighting, rubric weighting, or a completion formula. No combined Program Progress percentage is introduced and the Phase 4A policy remains unchanged.

## E. 37-Item Internship Program Reconciliation

### E.1 Interpretation and reference legend

The source contains 37 rows: Fundamental has nine rows (`1–6`, `8–10`; source number `7` is absent), Coordination seven, Automation fifteen, and Documentation six. Source numbering is preserved and not silently repaired.

Canonical BCL references used below:

| Code | Canonical reference |
|---|---|
| L01 | `page:bim-mindset` |
| L02 | Model production PDF |
| L03 | Coordination model-preparation PDF |
| L04 | Common Data Environment PDF |
| L05 | Navisworks Clash Detective video |
| L06 | Navisworks Timeliner tasks video |
| L07 | Navisworks 4D/5D overview video |
| L08–L10 | QTO concept, model preparation, and extraction PDFs |
| L11 | Technical drawing documentation PDF |

Formal relationships: FA1 Model Quality, FA2 Federated Coordination, FA3 4D Linkage, FA4 QTO/5D, FA5 Documentation/Delivery, and OA1 optional Automation Improvement. `COVERED`, `PARTIALLY COVERED`, and `NOT COVERED` below assess the current package as a whole, not merely whether a similarly named content file exists.

### E.2 37-item classification table

| Source | Task | Program category | Competency | Activity type | Existing BCL learning | Formal assignment relation | Evidence/output | Readiness and gap |
|---|---|---|---|---|---|---|---|---|
| A-01 | Fundamental BIM | BIM Fundamental | BIM concepts, lifecycle, uses, LOD/LOI, CDE, coordination, 4D/5D, as-built | LEARNING | L01/L04/L05/L07/L08 — partial | Foundation for FA1–FA5 | Summary + internal presentation | **PARTIALLY COVERED** — lifecycle/LOD/as-built depth missing |
| A-02 | ISO 19650 & BIM Governance | BIM Fundamental | EIR/OIR/AIR, BEP, MIDP/TIDP, naming/status/revision/CDE | LEARNING | L04 — partial | FA5 support | ISO-to-NKE workflow mapping | **PARTIALLY COVERED** — no dedicated ISO/governance module |
| A-03 | Standar & Regulasi BIM NKE | BIM Fundamental | Internal SOP/templates/library and applicable PUPR rules | REFERENCE | None verified | FA1/FA5 support | Project-standard checklist | **NOT COVERED** — approved internal/regulatory sources required |
| A-04 | Workflow BIM Project | BIM Fundamental | End-to-end authoring, coordination, drawing/QTO, 4D, as-built flow | GUIDED PRACTICE | L02/L03/L06/L07/L10/L11 — partial | FA1–FA5 integration | Actual workflow diagram | **PARTIALLY COVERED** — needs mentor observation and as-built flow |
| A-05 | Model Authoring | BIM Fundamental | ARS/STR/MEP modelling to standards | PRACTICAL ACTIVITY | L02 | FA1 support | Model/sample; derived PDF/images in BCL | **COVERED** subject to approved local tool/case |
| A-06 | Model Quality & Information Checking | BIM Fundamental | Parameter, naming, level/category/family/workset and data QA/QC | FORMAL ASSIGNMENT SUPPORT | L02 — partial | FA1 direct | PDF review + XLSX/CSV checklist | **COVERED** by required assignment and safe evidence |
| A-08 | Quantity / 5D Foundation | BIM Fundamental | Quantity extraction and model–BOQ/WBS relationship | LEARNING | L08–L10 | FA4 direct | QTO sample + mapping/reconciliation | **COVERED** by canonical learning and FA4 |
| A-09 | 4D BIM Fundamental | BIM Fundamental | WBS, coding, sequence, grouping, schedule linkage | LEARNING | L06/L07 | FA3 direct | Manual 4D baseline/mapping/screens | **COVERED** subject to synthetic case/tool |
| A-10 | MS Project Integration Fundamental | BIM Fundamental | WBS/task IDs, dates, predecessors, duration, mapping | GUIDED PRACTICE | L06 — partial | FA3 direct | Model–schedule XLSX/CSV + report | **PARTIALLY COVERED** — no dedicated MS Project module |
| B-01 | Federation & Clash Coordination | BIM Coordination | ARS/STR/MEP federation, clash grouping, issue tracking/recheck | FORMAL ASSIGNMENT SUPPORT | L03–L05 | FA2 direct | Federated review, clash report/log/screens | **COVERED** by canonical refs and FA2 |
| B-02 | Navisworks 4D | BIM Coordination | TimeLiner, sets, task attachment, simulation/update | PRACTICAL ACTIVITY | L06/L07 | FA3 direct | 4D demonstrator evidence | **COVERED** subject to approved local tool/case |
| B-03 | Synchro Pro 4D | BIM Coordination | Resource/task linking and workflow comparison | GUIDED PRACTICE | None | FA3 extension only | Synchro demonstrator/comparison | **NOT COVERED** — content, licence, and case absent |
| B-04 | Project Pilot | BIM Coordination | Apply 4D/automation on an actual NKE project | PRACTICAL ACTIVITY | None dedicated | FA3/OA1 extension | Pilot implementation report | **PARTIALLY COVERED** — no approved real-project case/security boundary |
| B-05 | 4D to Progress Integration | BIM Coordination | Planned-versus-actual linkage through common IDs | PRACTICAL ACTIVITY | L06 — partial | FA3 extension | Planned-vs-actual dataset | **PARTIALLY COVERED** — actual-progress source/schema absent |
| B-06 | 4D to 5D Readiness | BIM Coordination | Common key linking schedule, quantity, and cost | GUIDED PRACTICE | L07/L08–L10 — partial | FA3 + FA4 | Relationship prototype | **PARTIALLY COVERED** — integrated common-key case absent |
| B-07 | Dashboard / Data Visualization Exposure | BIM Coordination | Stakeholder information needs and dashboard-ready BIM data | REFERENCE | None | OA1/future integration | Dashboard data requirement | **NOT COVERED** — stakeholder and platform schema needed |
| C-01 | Identify Automation Opportunities | Automation / Digital Engineering | Workflow audit and prioritised automation backlog | FORMAL ASSIGNMENT SUPPORT | None | OA1 direct | Prioritised automation backlog | **PARTIALLY COVERED** — OA1 optional and no learning module |
| C-02 | Automation Fundamental | Automation / Digital Engineering | Dynamo/Python/API/data processing for real BIM needs | GUIDED PRACTICE | None | OA1 direct | Small validated automations | **PARTIALLY COVERED** — tool baseline and approved module absent |
| C-03 | 4D ID Information Architecture | Automation / Digital Engineering | ID, parameter, rule, and Revit–schedule–4D relationship | FORMAL ASSIGNMENT SUPPORT | None | FA3 + OA1 | 4D ID specification | **PARTIALLY COVERED** — explicit ID schema/case missing |
| C-04 | 4D ID Plugin Development | Automation / Digital Engineering | Operational Revit plugin generation/update | FUTURE / GAP | None | OA1 extension is insufficient | External governed source + build/release proof | **NOT COVERED** — toolchain, security, source governance, evidence channel absent |
| C-05 | 4D ID Validation | Automation / Digital Engineering | Missing/duplicate/format/consistency checks and error handling | PRACTICAL ACTIVITY | None | OA1 direct | Validation outputs + test report | **PARTIALLY COVERED** — depends on C-03/C-04 case |
| C-06 | Revit–MS Project Integration | Automation / Digital Engineering | Element-to-WBS/task mapping | PRACTICAL ACTIVITY | L06 — partial | FA3 + OA1 | Integrated model-schedule dataset | **PARTIALLY COVERED** — application-specific integration absent |
| C-07 | Navisworks/Synchro Integration | Automation / Digital Engineering | Cross-application automated/semi-automated assignment | PRACTICAL ACTIVITY | L06/L07 — Navisworks only | FA3 + OA1 | 4D workflow evidence | **PARTIALLY COVERED** — Synchro path missing |
| C-08 | Benchmark Automation | Automation / Digital Engineering | Compare time, steps, error, and repeatability | FORMAL ASSIGNMENT SUPPORT | None | OA1 direct | Before/after performance report | **PARTIALLY COVERED** — brief supports it but OA1 is optional |
| C-09 | BIM Data Structure | Automation / Digital Engineering | Project/model/element/WBS/task/discipline/zone data schema | FORMAL ASSIGNMENT SUPPORT | None | FA3 + OA1 | BIM data schema | **PARTIALLY COVERED** — schema deliverable not explicit/required |
| C-10 | Machine-readable BIM Data | Automation / Digital Engineering | CSV/JSON/database/API-ready exchange | PRACTICAL ACTIVITY | None | OA1 + FA4 support | Machine-readable export | **PARTIALLY COVERED** — CSV/XLSX supported; JSON/API evidence not defined |
| C-11 | Engineering & BIM Platform Readiness | Automation / Digital Engineering | Integration architecture for model/schedule/progress/quantity/issues | FUTURE / GAP | None | Future OA1/platform extension | Data-integration architecture | **NOT COVERED** — platform contract and target schema unavailable |
| C-12 | Improvement Cycle | Automation / Digital Engineering | User feedback, correction, and revised release | MENTORING ACTIVITY | None | OA1 extension | Feedback record + revised release | **PARTIALLY COVERED** — no formal feedback/release gate |
| C-13 | Technical Research | Automation / Digital Engineering | Technology/interoperability study tied to real problems | REFERENCE | Topic refs only; no research module | Mentor-guided, no required assignment | Short technical study | **NOT COVERED** — research method/source approval missing |
| C-14 | Innovation Proposal | Automation / Digital Engineering | Independent improvement opportunity and rationale | MENTORING ACTIVITY | None | OA1/mentor activity | BIM improvement proposal | **PARTIALLY COVERED** — suitable guided activity, not denominator |
| C-15 | Final Capstone | Automation / Digital Engineering | End-to-end automation/workflow/data-integration system | FUTURE / GAP | None | Explicitly excluded | Integrated prototype | **NOT COVERED** — case, governance, rubric, and capacity absent |
| D-01 | Tool Documentation | Documentation / Delivery | Manual, installation, workflow, requirements, limitations | DOCUMENTATION | None dedicated | OA1 + FA5 extension | PDF/DOCX technical documentation | **PARTIALLY COVERED** — FA5 brief needs explicit tool-documentation branch |
| D-02 | Source Code Governance | Documentation / Delivery | Version control, release/tag/changelog/repository/backup | FUTURE / GAP | None | OA1 extension is insufficient | Governed external repository record | **NOT COVERED** — source upload is intentionally unsupported |
| D-03 | BIM Automation Standard | Documentation / Delivery | SOP for input/output, validation, responsibility, limitations | DOCUMENTATION | None | OA1 + FA5 extension | Draft automation SOP | **PARTIALLY COVERED** — brief/rubric does not require it yet |
| D-04 | Knowledge Transfer | Documentation / Delivery | Demo, training, feedback, and usability review | MENTORING ACTIVITY | None | Program closeout activity | Slides, attendance/feedback record | **PARTIALLY COVERED** — operational workflow/evidence not configured |
| D-05 | Final Handover | Documentation / Delivery | Code/app/dataset/docs/SOP/architecture/tests/backlog handover | DOCUMENTATION | L04/L11 — partial | FA5 + OA1 extension | Controlled handover register/package | **PARTIALLY COVERED** — native code/application channel remains external |
| D-06 | Final Presentation | Documentation / Delivery | Problem, method, implementation, result, limits, next steps | MENTORING ACTIVITY | None | Closeout; not a new assignment | PDF slides + mentor sign-off | **PARTIALLY COVERED** — presentation/sign-off workflow not configured |

### E.3 Coverage summary

Coverage is intentionally not inflated. On a whole-package assessment, **6 items are covered, 23 partially covered, and 8 not covered/future**. Canonical BCL learning strongly supports five items and partially supports ten; 22 items have no dedicated learning reference. Absence of dedicated learning is not automatically a failure where mentor-led practice is appropriate, but it prevents a claim of complete curriculum coverage.

| Coverage mode | Reconciled result |
|---|---|
| Covered by BCL Learning | Strong for model authoring, QTO, 4D/Navisworks, and federation/clash; partial for mindset breadth, ISO/CDE, model QA/QC, MS Project, progress/5D integration, and handover |
| Covered by Guided Practice | Appropriate for project workflow, modelling, schedule mapping, Synchro exposure, progress/common-key exercises, automation fundamentals, research, and innovation proposal |
| Covered by Formal Assignment | Strongest for model QA/QC, clash coordination, 4D linkage, QTO validation, and controlled delivery; automation is only conditional/optional |
| Documentation/Mentoring activity | ISO/internal mapping, workflow observation, technical research, improvement feedback, knowledge transfer, handover, and final presentation should not all become separate assignments |
| Gap | Internal standards/regulations, Synchro, real project pilot, dashboard/platform architecture, dedicated automation learning, operational plugin governance, source-code governance, and capstone |

### E.4 Coverage by source program category

| Source category | Items | Covered | Partial | Not covered/future | Assessment |
|---|---:|---:|---:|---:|---|
| BIM Fundamental | 9 | 4 | 4 | 1 | Practical baseline is credible; ISO/internal standards/as-built depth remains weak |
| BIM Coordination | 7 | 2 | 3 | 2 | Federation and Navisworks 4D are strong; Synchro/dashboard and actual-project integration remain gaps |
| Automation / Digital Engineering | 15 | 0 | 11 | 4 | Broadly referenced by OA1/FA3, but not ready as a complete required program |
| Documentation / Delivery | 6 | 0 | 5 | 1 | Outputs are partly representable; code governance and closeout workflow are incomplete |

### E.5 Formal assignment consolidation

| Assignment | Consolidated source items | Reconciliation conclusion |
|---|---|---|
| FA1 Model Quality & Information Review | A-03/A-04 support; A-05/A-06 direct | Retain required; add mentor-provided standard/checklist references |
| FA2 Federated Model Coordination & Clash Review | A-02/A-03/A-04 support; B-01 direct | Retain required; sufficiently consolidates federation, clash, issue handling, and recheck |
| FA3 4D Model–Schedule Linkage | A-09/A-10, B-02/B-05/B-06, C-03/C-06/C-07/C-09; B-03 only future extension | Retain required; clarify common-ID and validation outputs, without requiring Synchro |
| FA4 QTO / 5D Validation | A-08, B-06, C-10 partial | Retain required; sufficiently demonstrates model-to-quantity reliability, not full cost integration |
| FA5 BIM Documentation / Delivery Package | A-02/A-03/A-04, D-01/D-03/D-05 and D-06 closeout support | Retain one assignment; expand brief/rubric to cover governance, handover limitations, and traceability |
| OA1 Automation / Digital Workflow Improvement | B-04/B-07, C-01–C-14 excluding capstone, D-01–D-05 in part | Existing brief is a useful consolidation vehicle but cannot represent the mentor automation program while optional and without content/tool/source governance |
| Excluded Capstone | C-15 | Keep excluded/future; do not force into the pilot |

### E.6 Gap analysis and manifest impact

The five required assignments are sufficient for a **foundation pilot**, not for claiming that the full mentor work program is executed. One required learning item is no longer a substantively adequate prerequisite set once the 37-item source is considered; it remains defensible only as a record of what the current published learning path has formally approved.

Recommended manifest decision: **do not freeze or deploy v2; prepare a separately reviewed manifest v3**. A denominator-changing revision is better represented as v3 than an in-place edit or ambiguous decimal version.

| Current v2 | Reconciled gap | Recommended v3 change | Impact |
|---|---|---|---|
| 1 required learning | Required assignments depend on skills not represented by the sole mindset item | After SME/path approval, promote L02–L06 and L08–L11; keep broad L07 overview optional | Required learning would become 10 total; new path/policy version and participant UX review required |
| OA1 is optional | Automation is a central mentor outcome (40% in DOCX; 25% in the direct brief) | Make OA1 required only after tool, case, mentor support, safe source governance, and automation learning are approved; otherwise label the pilot explicitly as foundation-only | Required assignment denominator would become 6 if gates pass; otherwise no full-program alignment claim |
| FA5 is generic delivery | Tool documentation, automation SOP, knowledge transfer, and handover are only partial | Expand FA5 brief/rubric and define closeout presentation/sign-off; do not create six micro-assignments | Assignment count can stay small while documentation evidence becomes explicit |
| No actual-project pilot contract | B-04/B-05 and improvement feedback depend on real operational conditions | Add an approved sanitized/synthetic-to-project progression and project-security gate, not a new automatic requirement | Remains an operational gate; no production data in BCL evidence |
| Taxonomy note says 25/25/25/25 | DOCX says 25/25/40/10 | Mentor confirms the display taxonomy before v3; retain non-weighting semantics | No Phase 4A progress/score change |
| Capstone excluded | C-15 is not ready | Keep excluded/future | No denominator impact |

Answer to the key reconciliation questions:

1. The 37-item program is **broadly but not fully represented**; foundation/coordination are strongest, automation and organizational handover weakest.
2. One required learning item is not sufficient for a full mentor-program pilot.
3. Nine active references (L02–L06 and L08–L11) are candidates for required promotion, but only after SME/path approval; no silent promotion is permitted.
4. Five required assignments remain a sound consolidation for the foundation pilot.
5. Do not split them into 37 tasks. Retain FA1–FA4, expand FA5, and conditionally promote OA1 rather than adding many assignments.
6. Automation may remain optional only if the pilot is explicitly scoped as foundation-only. It should become required before claiming alignment with the mentor program.
7. Important uncovered areas are ISO/internal standards, Synchro, real-project/progress/dashboard/platform integration, dedicated automation learning, plugin/source governance, and capstone.
8. Workflow observation, Synchro exposure, research, innovation proposal, feedback, knowledge transfer, and final presentation are valid guided/mentored activities and need not enter the completion denominator.

## F. Existing BCL Curriculum Coverage

| Area | Real canonical source | Proposed class | Readiness |
|---|---|---|---|
| BIM Mindset | `page:bim-mindset` | REQUIRED | Approved published Internship mapping |
| Model production/quality | Active canonical model-production PDF | REFERENCE_ONLY | Available; no required-path promotion |
| Coordination/CDE | Two active canonical PDFs | REFERENCE_ONLY | Available |
| Clash | Active canonical Navisworks lesson | REFERENCE_ONLY | Available; candidate mapping |
| 4D | Active canonical Timeliner lesson | REFERENCE_ONLY | Available; candidate mapping |
| 4D/5D overview | Active canonical video | OPTIONAL | Elective candidate |
| 5D/QTO | Three active canonical PDFs | REFERENCE_ONLY | Available |
| Documentation | Active canonical documentation PDF | REFERENCE_ONLY | Available |
| Automation | No approved dedicated module found | CONTENT GAP | Assignment remains optional |
| As-built/handover | No end-to-end approved practical module | CONTENT GAP | Future enhancement |
| Capstone | No approved case/module | GAP/EXCLUDE | Future |

All 11 non-excluded manifest references resolved as active canonical registry entries during read-only validation.

## G. Learning Requirement Proposal

Required denominator remains conservative:

| Class | Count | Completion impact |
|---|---:|---|
| REQUIRED | 1 | Server activity evidence counts |
| OPTIONAL | 1 | Does not block |
| REFERENCE_ONLY | 9 | Does not count or block |
| EXCLUDE | 0 | Not rendered as a requirement |

Only `page:bim-mindset` is required because it is the only learning item explicitly approved in the published Internship path. References support practical work without overriding SME/path governance.

The 10 optional/reference items are assignment-linked catalog references, not additional published path mappings. They can appear through existing classwork reference links; Phase 5B must not present them as required path completion items.

## H. Quiz Requirement Proposal

Required quiz count is **0**. The published path definition has `assessments: []`. Quiz-like pages in the registry are content pages, not verified quiz IDs, so they are not treated as required assessments. A future quiz must use a real registered ID and verified server attempts.

## I. Formal Assignment Strategy

Five required assignments consolidate the practical capability areas:

1. Model Quality & Information Review
2. Federated Model Coordination & Clash Review
3. 4D Model–Schedule Linkage
4. QTO / 5D Validation
5. BIM Documentation / Delivery Package

Automation / Digital Workflow Improvement is optional/conditional because a dedicated approved learning module and source-code evidence channel are absent. Capstone remains excluded/future. This set tests understanding, application, coordination, problem solving, digital workflow, and documentation without producing dozens of micro-assignments.

## J. Assignment Package

The machine package is `internship-pilot-assignments-v1`. Entries are planned configuration entities, not claimed database rows. Phase 5B must create actual topics/classwork/content links and then resolve configuration keys to real DB IDs.

| Key | Classification | Effort | Evidence | Case contract |
|---|---|---:|---|---|
| `model-quality-information-review` | REQUIRED | 12–20 h | PDF + XLSX/CSV + images | sanitized/synthetic model |
| `federated-coordination-clash-review` | REQUIRED | 16–24 h | PDF + XLSX/CSV + images | sanitized/synthetic discipline set |
| `model-schedule-4d-linkage` | REQUIRED | 14–22 h | PDF + XLSX/CSV + images | synthetic model/WBS/schedule |
| `qto-5d-validation` | REQUIRED | 12–20 h | XLSX/CSV + PDF + images | quantity case/reference table |
| `bim-documentation-delivery-package` | REQUIRED | 12–20 h | PDF/DOCX + XLSX/CSV | derived-output delivery scenario |
| `automation-digital-workflow-improvement` | OPTIONAL | 16–32 h | PDF/DOCX + XLSX/CSV + images | mentor-approved workflow/baseline |
| `capstone-improvement-project` | EXCLUDE | — | none | missing/future |

Exact dates are intentionally absent.

## K. Assignment Briefs

Each formal assignment defines purpose, competency objective, taxonomy, context, prerequisite/reference content, participant instruction, expected workflow, required deliverables, safe evidence, acceptance expectation, effort, dependencies, and readiness. The mentor-readable version is `docs/BCL_INTERNSHIP_PILOT_ASSIGNMENT_PACK_v1.md`.

No brief uses vague goals such as “learn Navisworks.” Each asks for a reviewable output such as a coordinated issue log, model-activity mapping, or quantity reconciliation.

## L. Rubric Package

`internship-pilot-rubrics-v1` contains six rubrics: five required-assignment rubrics and one optional automation rubric. Each has five meaningful criteria.

Current repository behavior permits criterion-specific `maxScore` and accepts values from 0 through that maximum. The package configures `maxScore: 5` without changing the review engine. All required criteria must be scored before a decision, but score magnitude never determines acceptance.

| Assignment | Rubric domains |
|---|---|
| Model Quality | structure/information, consistency, QA/QC method, reasoning, documentation |
| Coordination | setup, clash identification, classification, reasoning, traceability |
| 4D | WBS understanding, breakdown, mapping, sequence, documentation |
| QTO/5D | model readiness, extraction, validation, discrepancy, documentation |
| Documentation | structure, naming/status, revision/issues, consistency, handover |
| Automation optional | problem, workflow, result, validation/limits, benefit/documentation |

Explicit reviewer `accepted`/`revision_requested` remains authoritative. There is no automatic threshold, revision penalty, attendance gate, final evaluation gate, or automatic certificate.

## M. Evidence Compatibility

All five required assignments are `EVIDENCE READY` under the locked policy:

- formats: PDF, DOCX, XLSX, CSV, JPG/JPEG, PNG;
- maximum 10 MiB per file;
- maximum 5 files per submission.

No native BIM, coordination, IFC, automation source, executable, archive, or video format was enabled. Work may be performed locally using approved tools; only safe derived evidence is submitted.

## N. 4D Readiness

Status: **READY — REQUIRED, conditional on Phase 5B case selection/tool access**.

The assignment tests WBS interpretation, model breakdown, activity mapping, sequence review, and linkage/data problems. Evidence uses PDF, XLSX/CSV, and screenshots; MP4 is neither required nor accepted. A real active canonical Timeliner reference resolves, though its formal path mapping remains an SME candidate.

## O. 5D/QTO Readiness

Status: **READY — REQUIRED, conditional on approved quantity case/reference data**.

Three active canonical QTO PDFs resolve. The assignment requires extraction, validation, reconciliation, and discrepancy explanation. Acceptance is a reviewer decision; no numerical tolerance auto-accepts the work.

## P. Automation Readiness

Status in current v2: **CONDITIONAL — OPTIONAL**. Reconciliation recommendation: **promote to REQUIRED only after the stated readiness gates pass**.

The brief and rubric are usable with safe derived evidence, but no approved dedicated automation learning module was found. Source code and native automation artifacts cannot be uploaded. It may remain optional for an explicitly foundation-only pilot; it cannot remain optional if the pilot claims alignment with the full mentor work program.

## Q. Coordination Readiness

Status: **READY — REQUIRED, conditional on approved sanitized/synthetic discipline models**.

Canonical coordination/CDE PDFs and a Clash Detective lesson resolve. The package requires federation assumptions, material issue classification, ownership/action reasoning, recheck logic, and a traceable report—not merely a raw clash count.

## R. Documentation/Delivery Readiness

Status: **PARTIALLY READY — REQUIRED, conditional on brief/rubric expansion and approved exercise outputs**.

The package evaluates naming/status, revision and issue traceability, cross-output consistency, CDE/handover assumptions, and communication quality using safe documents and registers. The reconciliation additionally requires explicit tool-documentation/automation-SOP branches where applicable and a separate closeout presentation/sign-off workflow.

## S. Capstone Status

**FUTURE / EXCLUDE.** Capstone has no approved case, scope, prerequisite bundle, rubric, or governance and does not enter the denominator. It is not a separate progress engine.

## T. Content Gap Backlog

| Gap | Competency | Impact | Priority | Suggested location/action | Required before pilot? |
|---|---|---|---|---|---|
| Approved automation learning module | digital improvement | Automation remains optional | P1 | New versioned BCL learning module after SME review | No |
| End-to-end as-built/handover practical module | delivery/handover | Covered only conceptually in documentation assignment | P1 | Documentation/Delivery path | No |
| Capstone curriculum/case governance | cross-domain improvement | Capstone excluded | P2 | Future Internship program version | No |
| SME publish decision for broader references | learning governance | References cannot become required completion items | P1 | Existing mapping review workflow | No for v2 denominator |
| ISO 19650/internal NKE/PUPR governance bundle | information governance | A-02/A-03 remain partial or uncovered | P1 | Versioned authoritative references after owner approval | Yes for full mentor-program claim |
| Synchro, progress, dashboard, and platform integration | cross-application integration | B-03/B-05/B-07/C-07/C-11 remain partial/gaps | P2 | Guided cases plus future modules | No for foundation-only pilot |
| Source-code/release governance | sustainable automation | C-04/D-02 cannot be evidenced safely in current channel | P1 | External governed repository contract; BCL stores derived proof only | Yes before operational plugin claim |

## U. Assignment Gap Backlog

| Candidate | Gap | Classification/action |
|---|---|---|
| Five required assignments | Exact approved case files/tool access not selected | Phase 5B operational input under defined execution contract |
| Automation improvement | Dedicated learning prerequisite, governed tool/case, and source-code evidence boundary absent | Keep OPTIONAL only for foundation pilot; promote in v3 after gates |
| Documentation/delivery | Tool documentation, automation SOP, knowledge transfer, and closeout sign-off are not explicit | Expand FA5 brief/rubric and define closeout workflow; do not add micro-assignments |
| Actual project pilot | Project-security boundary and approved real-project case absent | Keep as operational progression gate, not an automatic assignment |
| Capstone | Case, scope, rubric, mentor capacity, governance missing | EXCLUDE/FUTURE |
| Existing smoke task | Wrong batch, no deliverable, no pilot competency | EXCLUDE |

No confidential production project material, UNC path, or Projects Explorer dependency is used.

## V. Practical Competency Matrix

| Competency | BCL learning | Formal assignment | Rubric | Evidence | Readiness |
|---|---|---|---|---|---|
| Model quality/information | required mindset + model PDF reference | Model Quality Review | Ready | Ready | Conditional on case |
| Coordination/clash | PDFs + clash video references | Federated Coordination | Ready | Ready | Conditional on case/tool |
| 4D | Timeliner reference | 4D Linkage | Ready | Ready without video | Conditional on case/tool |
| 5D/QTO | three QTO references | QTO Validation | Ready | Ready | Conditional on case |
| Automation | content gap | Optional Improvement in v2; proposed required in v3 after gates | Ready rubric | Conditional derived evidence | Reconciliation hold |
| Documentation/delivery | documentation/CDE references | Delivery Package requiring expansion | Rubric amendment needed | Safe derived evidence available | Partially ready |
| Capstone | gap | none | none | none | Future/excluded |

Mentor usability: every active brief answers what the participant does, what is submitted, what evidence is available, what criteria are scored, and what qualitatively justifies acceptance or revision.

Participant usability: the human-readable pack states prerequisites, workflow, deliverables, evidence limits, and review expectations in direct language.

## W. Manifest v2 Status and v3 Recommendation

`INT-BIM-PILOT-MANIFEST-v2` is a separate **proposed** candidate and does not modify v1. It uses:

- planned assignment configuration keys, not fake DB IDs;
- explicit classifications on every learning and assignment entry;
- zero implicit requirements;
- stable references to assignment/rubric packages;
- Phase 4 `internship-completion-v1` semantics unchanged;
- expected policy identity `INT-BIM-PILOT-POLICY-v2` for creation only after approval.

After Phase 5B creates classwork, configuration keys must be resolved to real IDs and definition digests before freezing the database policy. Any later denominator change requires a new manifest/policy version.

The 37-item reconciliation is exactly such a denominator-impacting review. Manifest v2 remains an immutable proposed audit artifact and is **not approved for freeze**. No v3 file is created by this reconciliation. A future v3 must be reviewed before authoring and must record the approved learning promotions, automation decision, expanded documentation contract, taxonomy clarification, and corresponding new policy/path versions.

No write-capable seed/import script was added or executed in Phase 5A-R. The packages expose deterministic configuration keys for a future idempotent Phase 5B importer, after human approval and operational inputs are available.

## X. Validation Results

Cross-package read-only validator result:

```json
{
  "valid": true,
  "readiness": "CONDITIONAL",
  "errors": [],
  "summary": {
    "requiredLearning": 1,
    "optionalLearning": 10,
    "requiredQuizzes": 0,
    "requiredAssignments": 5,
    "optionalAssignments": 1,
    "rubricReady": 5,
    "evidenceReady": 5,
    "contentGaps": 3
  },
  "mutationPerformed": false
}
```

Warnings are limited to six case selections (five required plus optional automation), participant/mentor IDs, dates, and deliberately undeployed batch/policy.

This result proves internal package consistency only. It does not override the later substantive reconciliation. Therefore `valid: true` / `CONDITIONAL` must not be interpreted as authorization to start Phase 5B or freeze v2.

The validator's existing `source37TaskPlanFound: false` flag means no such source exists inside the repository inputs inspected by that script. It is not a claim that the later external mentor DOCX was unavailable to this report; the external source is identified by filename and digest above and is deliberately not made a runtime dependency.

Evaluator fixture confirms denominator = 1 required learning + 5 required assignments. Ten optional/reference learning items, one optional assignment, capstone, smoke task, and unknown Training task do not enter the required denominator. Three historical revisions still represent one assignment; a high descriptive score cannot override `revision_requested`.

No schema migration was necessary. Existing path mapping, classwork/content-link, review criteria, immutable policy JSON, and evaluator structures are sufficient.

## Y. Pilot Readiness Recommendation

Technical/configuration decision after 37-item reconciliation: **HOLD — REVIEW AND APPROVE A NEW MANIFEST VERSION BEFORE PHASE 5B**.

| Category | Remaining items |
|---|---|
| CURRICULUM BLOCKER | Required-learning prerequisites, automation scope, ISO/internal standards, and documentation/handover contract require mentor/SME decisions |
| CONFIGURATION BLOCKER | v2 is structurally valid but must not be frozen; approved denominator changes require a new manifest/path/policy version |
| OPERATIONAL INPUT | approved case datasets/tools, participant ID, mentor ID, optional reviewer ID, dates, environment, migration/apply approval, storage approval |
| NON-BLOCKING DEBT | missing optional `learning_materials`; SME 337/371; broader references still await mapping governance |
| FUTURE ENHANCEMENT | Synchro/dashboard/platform modules, operational plugin/source governance, as-built depth, capstone |

Unified Learning debt remains technically non-blocking for current v2, but the mentor-program reconciliation now requires an explicit SME/path decision on nine existing references before a new denominator can be approved. Their route availability must be rechecked before any later Phase 5B environment validation.

## Z. Phase 5B Prerequisites

1. Mentor/SME review and sign-off of the 37-row classification, including the source-weight discrepancy (25/25/40/10 versus the brief's 25/25/25/25).
2. Decide whether the pilot is foundation-only or claims full mentor-program alignment.
3. Approve or reject the proposed L02–L06 and L08–L11 required-learning promotions through the learning-path governance process.
4. Decide whether OA1 passes the prerequisites to become required; otherwise document the foundation-only limitation.
5. Approve FA5 brief/rubric expansion and the closeout presentation/sign-off workflow.
6. Author and independently validate a new manifest v3 plus matching path/policy versions; do not overwrite v1 or v2.
7. Approved sanitized/synthetic case selection for each required assignment, including tools/licensing/access checks.
8. Canonical participant and mentor user IDs; optional reviewer/observer scope decision.
9. Exact start/end dates and per-assignment release/due decisions.
10. Approved test/pilot environment and migration-apply authorization.
11. Apply accepted Phase 1–4 migrations in order, then create the pilot batch without production rollout.
12. Idempotently create topics, classwork, canonical links, and review criteria from configuration keys.
13. Resolve each planned assignment key to its real database ID and compute the immutable definition digest.
14. Freeze the approved new policy with exact manifest version/digest and resolved assignment IDs.
15. Verify evidence storage/quarantine and mentor review operations in the test/pilot environment.
16. Enable feature flags progressively and run full participant→submission→review→revision→requirements_met→explicit closeout E2E.
17. Re-run canonical content routes, package validator, auth/security, and denominator checks before pilot activation.

### Verification record

| Check | Result |
|---|---|
| `npm run test:internship` | PASS — 176/176 |
| Phase 5A-R targeted tests | PASS — 24/24 |
| Attached mentor source extraction | PASS — 37 rows: Fundamental 9, Coordination 7, Automation 15, Documentation 6 |
| Reconciliation table integrity | PASS — 37/37 classified; 6 covered, 23 partial, 8 not covered/future |
| Security/auth tests | PASS — 2/2 |
| Elearning theory smoke | PASS |
| Manifest v1 validator | Expected BLOCKED baseline; v1 unchanged |
| Candidate v2 cross-package validator | PASS — valid, zero errors, CONDITIONAL |
| Canonical content resolution | PASS — 11/11 non-excluded references |
| Phase 4B migration validate + rollback | PASS; temporary Phase 1–4 schema fully rolled back |
| JavaScript syntax | PASS |
| `git diff --check` | PASS; line-ending notices only |
| Unified Learning smoke | Existing debt: optional `learning_materials` missing and SME 337/371 |
| Playwright | Skipped; no UI changes |

No migration `--apply` or production mutation was authorized or performed.
