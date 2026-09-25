# BCL Internship Program — Manifest v3 Mentor Reconciliation Implementation

Date: 25 September 2026
Artifact status: **PROPOSED — NOT DEPLOYED**
Configuration validation: **VALID**
Pilot readiness: **CONDITIONAL**
Scope stop: configuration, 37-item coverage, and read-only validation only; no batch creation, enrollment, migration apply, feature activation, evidence mutation, review, closeout, certificate, or production rollout.

## 1. Outcome

The mentor-approved reconciliation is implemented as a new immutable candidate package:

- manifest `INT-BIM-PILOT-MANIFEST-v3`;
- 10 required learning items and one optional overview;
- zero required quizzes;
- six required assignments, including Automation / Digital Workflow Improvement;
- zero optional assignments;
- capstone and the unrelated external smoke task excluded;
- six usable rubrics with explicit reviewer acceptance authority;
- six evidence-compatible required assignments;
- a machine-readable 37-item mentor-program source bound by the original DOCX SHA-256.

Manifest v1 and v2 remain unchanged. V3 is not frozen, deployed, or bound to database IDs. Its planned learning path uses configuration key `internship-bim-path-v3` instead of inventing a database version ID.

## 2. Approved Decision Implementation

| Decision | v3 implementation |
|---|---|
| Use mentor-source program emphasis | 25% Fundamental, 25% Coordination, 40% Automation, 10% Documentation |
| Never use taxonomy as progress/score weighting | `taxonomySemantics: program_emphasis_only`; Phase 4 contract unchanged |
| Promote reconciled prerequisite learning | L01–L06 and L08–L11 required; broad L07 4D/5D overview remains optional |
| Retain consolidated practical assessment | FA1–FA5 retained; no 37-classwork expansion |
| Make automation a formal demonstration | Automation Improvement is required with explicit operational gates |
| Expand documentation/handover | FA5 v2 covers governance, SOP/limitations, knowledge transfer, handover, presentation, and closeout evidence |
| Preserve safe evidence boundary | No source code, executable, secret, native project file, or production path is uploaded |
| Keep capstone out of pilot | `capstone-improvement-project` remains excluded/future |
| Preserve completion policy | `internship-completion-v1`, latest revision controls, explicit reviewer acceptance, explicit closeout |

## 3. Versioned Artifacts

| Artifact | Version | Purpose |
|---|---|---|
| `internship-pilot-manifest-v3.json` | `INT-BIM-PILOT-MANIFEST-v3` | Mentor-approved required denominator and package bindings |
| `internship-pilot-assignments-v2.json` | `internship-pilot-assignments-v2` | Six required assignment briefs and safe evidence contracts |
| `internship-pilot-rubrics-v2.json` | `internship-pilot-rubrics-v2` | Six review rubrics; automation and handover criteria expanded |
| `internship-mentor-program-37-v1.json` | `internship-mentor-program-37-v1` | Reproducible 37-row source classification and approved decisions |
| `BCL_INTERNSHIP_PILOT_ASSIGNMENT_PACK_v2.md` | participant pack v2 | Human-readable six-assignment guidance and safe evidence boundary |

The mentor source package binds `Program_Tugas_Internship_BIM_Ridho.docx` by SHA-256 `ebbd07f538704b1f4aa3be5009ec0b2a5f334f71c31a2ada6af2c6825bed404d`. The external DOCX is not a runtime dependency.

## 4. V3 Completion Denominator

| Dimension | Required | Optional | Excluded |
|---|---:|---:|---:|
| Learning | 10 | 1 | 0 |
| Quiz | 0 | 0 | 0 |
| Assignment | 6 | 0 | 2 |

The six required assignments are:

1. Model Quality & Information Review.
2. Federated Model Coordination & Clash Review.
3. 4D Model–Schedule Linkage.
4. QTO / 5D Validation.
5. Automation / Digital Workflow Improvement.
6. BIM Documentation, Governance & Handover Package.

Scores remain descriptive review support. No numeric score automatically accepts work, and revision history never inflates the assignment denominator.

## 5. Curriculum Coverage Re-run

The read-only validator resolved all 11 learning references and reconciled all 37 mentor-program rows.

| Program category | Total | Covered | Partially covered | Not covered/future |
|---|---:|---:|---:|---:|
| BIM Fundamental | 9 | 4 | 4 | 1 |
| BIM Coordination | 7 | 2 | 3 | 2 |
| Automation / Digital Engineering | 15 | 5 | 7 | 3 |
| Documentation / Delivery | 6 | 2 | 4 | 0 |
| **Total** | **37** | **13** | **18** | **6** |

Compared with the pre-v3 reconciliation, full coverage increases from 6 to 13 items and explicit not-covered/future items fall from 8 to 6. Coverage is not presented as a completion percentage and is not artificially raised by treating mentoring activities as formal assignments.

### Explicit remaining gaps

| Source item | Gap | Treatment |
|---|---|---|
| A-03 Standards & BIM NKE Regulation | Approved internal/regulatory learning source absent | Mentor-guided authoritative reference; do not duplicate content |
| B-03 Synchro Pro 4D | Module, licence, and approved exercise absent | Future guided module |
| B-07 Dashboard / Data Visualization Exposure | Stakeholder and platform schema absent | Future integration work |
| C-04 4D ID Plugin Development | Dedicated learning/toolchain/source-release governance incomplete | Derived evidence only; operational plugin claim deferred |
| C-11 Engineering & BIM Platform Readiness | Target platform contract unavailable | Future platform architecture scope |
| C-15 Final Capstone | Case, governance, rubric, and mentor capacity absent | Excluded/future |

The 18 partially covered rows remain explicit because they depend on mentor-guided instruction, approved cases/tools, real-project security gates, external repository governance, or future integration schemas.

## 6. Assignment and Evidence Readiness

All six required assignments have a matching rubric and evidence-compatible deliverables. Automation is deliberately classified `conditional_required`: its completion requirement is approved, but release requires a mentor-approved non-confidential workflow, baseline dataset, local toolchain, feedback users, and external source/release-governance boundary.

Automation evidence is restricted to reports, benchmark/validation tables, governance/SOP records, and screenshots. Source code and executables remain outside BCL. FA5 similarly accepts derived documentation/registers/presentation evidence rather than native project or source artifacts.

## 7. Readiness Result

Read-only validation result:

```json
{
  "valid": true,
  "readiness": "CONDITIONAL",
  "errors": [],
  "summary": {
    "requiredLearning": 10,
    "optionalLearning": 1,
    "requiredQuizzes": 0,
    "requiredAssignments": 6,
    "optionalAssignments": 0,
    "rubricReady": 6,
    "evidenceReady": 6,
    "contentGaps": 6
  },
  "curriculumCoverage": {
    "total": 37,
    "covered": 13,
    "partiallyCovered": 18,
    "notCovered": 6
  },
  "source37TaskPlanFound": true,
  "source37TaskPlanRole": "mentor_program_intent",
  "mutationPerformed": false
}
```

Readiness is conditional—not blocked—because approved exclusions and gaps are explicit and outside the frozen denominator. The remaining operational conditions are:

1. publish the new learning-path version from the approved v3 configuration;
2. approve sanitized/synthetic cases and local tools for all six assignments;
3. satisfy the automation operational gates;
4. provide canonical participant and mentor IDs;
5. set program/release/due dates;
6. approve the pilot environment and storage/quarantine checks;
7. create the batch, classwork, criteria, and policy only through a later authorised Phase 5B operation;
8. resolve planned keys to real database IDs/digests and freeze the exact v3 manifest/policy pair;
9. run participant-to-closeout E2E before pilot activation.

## 8. Integrity and Non-Mutation

- Manifest v1 byte SHA-256 remains `db9d53ddf5f78420d1e39637f19fad96e9af16dfb76f98e9732636bf01652c90`.
- Manifest v2 byte SHA-256 remains `b31b4cf8b4e504acb6375ec581c048a20f916df508efdf9368b988bd908f0f6f`.
- The database inspection uses `BEGIN READ ONLY` followed by `ROLLBACK`.
- No database migration, seed/import, batch creation, enrollment, file upload, policy freeze, or production mutation was performed.

## 9. Verification Record

| Check | Result |
|---|---|
| V3 targeted tests | PASS — 22/22 |
| Phase 5A-R v2 + v3 tests | PASS — 46/46 |
| Full Internship test suite | PASS — 198/198 |
| V3 package/curriculum validator | PASS — valid, zero errors, CONDITIONAL |
| 37-item source reconciliation | PASS — 37/37 rows |
| Canonical content resolution | PASS — 11/11 |
| Rubric/evidence readiness | PASS — 6/6 required assignments |
| V1/V2 immutability hashes | PASS |
| JavaScript syntax | PASS |
| Production mutation | None |
