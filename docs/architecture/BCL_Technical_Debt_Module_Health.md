# BCL Internal — Technical Debt / Module Health

Architecture contract: [BCL Online Architecture Roadmap](BCL_Online_Architecture_Roadmap_Codex.md).

User review 18 September 2026 closed P0-1 and accepted the following as **known non-blocking issues for P0-1**. No fix or migration for these issues is part of P0-1/P0-2. Acceptance does not mean the underlying issue is resolved.

| ID | Domain | Observed issue | Evidence | Status / required checkpoint |
|---|---|---|---|---|
| LEARNING-001 | Learning material source | `public.learning_materials` missing; optional PostgreSQL content load logs warnings and other content sources continue | Source `backend/services/learningMaterialsSource.js`; PostgreSQL read-only check; warning existed in 16 September logs | OPEN technical debt. Inspect intended content source, schema/data provenance and migration/recovery **before or when P0-3 touches Learning**. Do not create an empty table just to hide warnings. |
| LEARNING-002 | PDF read counts | One PostgreSQL connection timeout during runtime validation; later SQL read and endpoint check succeeded | `logs/backend-public-5052-20260918-135340-661.err.log`; `/api/pdf-display/selected` retest HTTP 200 | MONITOR. Revisit if repeated during Learning module health review; original timeout cause unproven. Non-blocking for P0-1. |

Full observations: [P0-1 Runtime Activation & Exit Validation](P0_1_Runtime_Activation_Exit_Validation.md).

## P0-2 follow-ups

| ID | Domain | Issue / checkpoint | Status |
|---|---|---|---|
| AUTH-001 | Legacy Google ownership | Existing schema had no Google sub; require verified first-link per holder, with local reauthentication or explicit admin ownership review. Do not infer mapping from email, merge15/20 or assign23. | Per-user onboarding; pending subjects remain unlinked until proof. |
| AUTH-002 | Session operations | Define retention/cleanup for expired session/challenge/link rows and security events. Expiry/revocation is already enforced during authorization. Use shared throttle storage before adding backend processes. | Operational follow-up; no module data migration. |
| AUTH-003 | Recovery/client storage | General user email recovery and provider unlink need reviewed ownership/last-credential policies. Frontend JWT remains in localStorage for compatibility; full XSS/cookie/BFF migration requires separate scope. | Deferred policy/architecture review. |
| DEP-001 | Dependency security | After Google verifier adoption and rate limiter8.7.0 upgrade, npm audit reports11 findings (8high,3moderate): axios, body-parser, brace-expansion, express, follow-redirects, form-data, minimatch, multer, nodemailer, path-to-regexp, qs. Assess reachability and test module-specific/major upgrades; do not treat them as fixed. | Security maintenance; review before affected module exposure/work. Rate-limiter IPv4-mapped IPv6 issue is fixed and regression-tested in P0-2. |
