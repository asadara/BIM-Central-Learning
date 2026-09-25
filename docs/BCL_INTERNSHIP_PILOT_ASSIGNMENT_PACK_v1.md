# BCL Internship Pilot — Assignment Pack v1

Status: **Proposed for review; not deployed**
Program: `INT-BIM-2026-PILOT`
Manifest candidate: `INT-BIM-PILOT-MANIFEST-v2`

This pack gives participants and mentors a readable view of the proposed practical work. The machine authority is the assignment/rubric JSON package. Scores support mentoring; only an explicit reviewer decision can produce `accepted` or `revision_requested`.

Evidence policy for every assignment: maximum 5 files, maximum 10 MiB per file, using only PDF, DOCX, XLSX, CSV, JPG/JPEG, or PNG. Native model, coordination, automation-source, archive, executable, and video files are not uploaded.

## 1. Model Quality & Information Review — Required candidate

Purpose: demonstrate a systematic review of model structure, information consistency, and production readiness.

Prerequisite:

- Required: `page:bim-mindset`
- Reference: `pdf:manual-book-bim-modeller-1-pemodelan-dan-produksi-data-bim-struktur-dan-arsitektur-4-memproduksi-data-model-bim-pdf`

Participant task:

1. Confirm the mentor-approved case scope and QA/QC checklist.
2. Inspect model structure, naming, levels/grids, parameters, completeness, and information consistency.
3. Record reproducible findings and severity.
4. Assess drawing and QTO readiness.
5. Prioritize corrective recommendations.

Submit:

- required PDF model-quality review report;
- required XLSX or CSV QA/QC findings checklist;
- optional PNG/JPG annotated screenshots.

Mentor inspects: model structure/information, accuracy/consistency, QA/QC method, technical reasoning, and documentation quality.

Accepted means the review is coherent and traceable, recommendations are defensible, and no critical QA/QC issue is left unexplained.

Phase 5B case input: one approved non-confidential model with known quality issues and an approved checklist.

## 2. Federated Model Coordination & Clash Review — Required candidate

Purpose: demonstrate federation setup, clash/issue analysis, coordination reasoning, ownership recommendations, and recheck traceability.

Prerequisite:

- Required: `page:bim-mindset`
- References: coordination preparation, CDE model exchange, and the canonical Navisworks Clash Detective lesson listed in the machine package.

Participant task:

1. Verify ARS/STR/MEP scope, coordinates, units, and alignment assumptions.
2. Define the supplied clash-test scope.
3. Identify, group, classify, and prioritize material issues.
4. Recommend responsible discipline/owner and resolution action.
5. Document revision/recheck state and issue traceability.

Submit:

- required PDF coordination report;
- required XLSX/CSV clash and issue log;
- required PNG/JPG coordination screenshots.

Mentor inspects: federation/setup, clash identification, issue classification, coordination reasoning, and report traceability.

Accepted means significant coordination issues are correctly classified, evidence is traceable, and proposed actions are technically usable.

Phase 5B case input: approved non-confidential discipline models containing known issues and an approved clash-test brief.

## 3. 4D Model–Schedule Linkage — Required candidate

Purpose: demonstrate WBS interpretation, model breakdown, activity mapping, sequence review, and detection of linkage/data problems.

Prerequisite:

- Required: `page:bim-mindset`
- Reference: canonical Navisworks Lesson 31 Timeliner material.

Participant task:

1. Review supplied WBS, activity IDs, dates, dependencies, and assumptions.
2. Define model selection/grouping rules.
3. Build and validate the model-to-activity mapping.
4. Review key sequence states.
5. Identify and explain linkage/data problems and corrections.

Submit:

- required PDF workflow report;
- required XLSX/CSV mapping table;
- required PNG/JPG sequence screenshots.

MP4 is not required or accepted. The rubric covers WBS understanding, model breakdown, schedule mapping, sequence logic, and documentation.

Accepted means the mapping and sequence reasoning are coherent and supported by traceable evidence.

Phase 5B case input: approved synthetic model breakdown and schedule containing stable IDs, dates, dependencies, and deliberate mapping issues.

## 4. QTO / 5D Validation — Required candidate

Purpose: demonstrate controlled quantity extraction, validation, discrepancy analysis, and reconciliation.

Prerequisite:

- Required: `page:bim-mindset`
- References: the three canonical QTO concept, model-preparation, and extraction PDFs listed in the machine package.

Participant task:

1. Confirm scope, categories, units, and reference basis.
2. Check parameter/classification readiness.
3. Produce a controlled quantity extract.
4. Compare with the supplied manual/BOQ/reference quantity.
5. Reconcile justified differences and document reliability limitations.

Submit:

- required XLSX/CSV extract and reconciliation;
- required PDF methodology/discrepancy report;
- optional PNG/JPG screenshots.

Mentor inspects: model readiness, extraction, validation method, discrepancy analysis, and documentation.

Accepted means results are reproducible, discrepancies are reasoned rather than hidden, and critical reliability concerns are resolved or explicitly escalated. No numerical tolerance automatically accepts the work.

Phase 5B case input: approved quantity scope and reference table with known reconciliations/discrepancies.

## 5. BIM Documentation / Delivery Package — Required candidate

Purpose: demonstrate controlled deliverable structure, revision/issue traceability, consistency checking, and handover communication.

Prerequisite:

- Required: `page:bim-mindset`
- References: canonical BIM documentation and CDE model-exchange PDFs.

Participant task:

1. Define delivery scope, naming/status rules, and information authority.
2. Build a deliverable/revision register.
3. Check consistency across model-derived reports, drawings, and issue records.
4. Record open issues, approvals, and handover assumptions.
5. Prepare a controlled delivery summary.

Submit:

- required PDF or DOCX delivery/handover narrative;
- required XLSX or CSV deliverable, revision, and issue register.

Mentor inspects: structure, naming/status, revision/issue traceability, information consistency, and handover communication.

Accepted means the package is internally consistent and explicit about status, revisions, issues, responsibility, and handover assumptions.

Phase 5B case input: approved non-confidential derived outputs and a delivery scenario with revisions and issue states.

## 6. Automation / Digital Workflow Improvement — Optional/conditional

Purpose: demonstrate problem definition, improvement logic, local prototyping, validation, and practical benefit without requiring source-code upload.

This remains optional because no approved dedicated automation learning module is available and source-code evidence is outside the current allowlist.

Participant task:

1. Define a mentor-approved repetitive BIM/data problem and baseline.
2. Design a controlled improvement and validation method.
3. Prototype or simulate locally.
4. Compare derived output with the baseline.
5. Document benefit, failure modes, limitations, and safe-use boundaries.

Submit:

- PDF/DOCX technical report;
- CSV/XLSX before/after output;
- PNG/JPG workflow screenshots.

Do not upload scripts, executables, source repositories, or native automation files. Optional completion never affects `requirements_met`.

## 7. Capstone / Improvement Project — Excluded/future

Capstone has no approved case, scope, prerequisite bundle, rubric, or governance. It is not part of the v2 denominator and is not a separate progress engine. A future version may add it only after full readiness review.

## Reviewer decision guide

- Use all required rubric criteria on the current submission revision.
- Criterion score range is 0–5 because current review architecture supports per-criterion `maxScore`; this does not introduce a new completion threshold.
- Choose `accepted` only when the qualitative acceptance expectation is met and no critical issue remains.
- Choose `revision_requested` when the output or evidence needs correction, even if descriptive scores are high.
- Record participant feedback clearly. Internal notes remain separate and are not exposed to the participant.
