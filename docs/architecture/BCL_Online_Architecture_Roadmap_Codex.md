# BCL Online — Architecture Roadmap & Codex Guidance

**Status:** Baseline v1.1  
**Purpose:** Mandatory implementation guidance for the BCL Online project  
**Audience:** Codex / developers / maintainers  
**Canonical Product:** BCL Internal remains the original operational system and primary source for internal-master data.

---

## 1. Project Intent

BCL Online is **not** a public clone of BCL Internal.

It is an internet-accessible BCL channel containing only functions, information, and workflows that are explicitly approved for online use.

The architecture must preserve these principles:

- BCL Internal remains operational even when internet, GitHub, BCL Online, IEN, or Online Relay are unavailable.
- BCL Online must remain operational when BCL Internal is offline.
- Internet must never initiate a connection into BCL Internal.
- BCL Online must never become a control plane for BCL Internal.
- Runtime data exchange must be explicit, constrained, auditable, and classified.
- Source-code distribution and runtime-data transfer are separate concerns.

---

## 2. Core Architecture

```text
                     SOURCE CODE CHANNEL

BCL Internal Source
      │
      │ internal development / test / approval
      ▼
Sanitized GitHub Mirror
      │
      ▼
BCL Online Build / Deployment
```

GitHub is downstream only.

GitHub is **not**:
- the operational SSOT,
- a runtime dependency,
- a transport mechanism for operational data,
- the authoritative source for internal production data.

Runtime architecture:

```text
               PT NKE INTERNAL                    INTERNET / CLOUD

┌──────────────────────────┐
│ BCL PRODUCTION           │
│ Existing internal system │
│ Office-hours availability│
└─────────────┬────────────┘
              │
              │ Controlled package exchange
              │ Shared folder + manifest
              ▼
┌──────────────────────────┐
│ IEN                      │
│ Internal Exchange Node   │
│ 24 / 7                   │
│                          │
│ - OUTBOUND_DROP          │
│ - INBOUND_QUARANTINE     │
│ - INBOUND_CLEAN          │
│ - Checkpoint             │
│ - Audit log              │
│ - Sync client            │
└─────────────┬────────────┘
              │
              │ outbound HTTPS only
              │ authenticated
              ▼
                              ┌──────────────────────────┐
                              │ ONLINE RELAY             │
                              │ 24 / 7                   │
                              │                          │
                              │ - Published Store        │
                              │ - Durable Queue          │
                              │ - Online Inbox           │
                              │ - Asset Store            │
                              │ - Audit Log              │
                              └─────────────┬────────────┘
                                            │
                                            ▼
                                      BCL ONLINE
                                      24 / 7
```

---

## 3. Absolute Security Rules

These are architecture invariants.

### 3.1 Network Boundary

```text
UNSOLICITED INTERNET → BCL INTERNAL = DENY
```

Required:

- BCL Internal must not expose a public-facing service.
- Online Relay must not possess direct network reachability to BCL Production.
- No VPN-style direct bridge between Online Relay and BCL Internal.
- IEN communicates outward using authenticated HTTPS only.
- BCL Internal does not accept inbound API calls from IEN.
- IEN does not authenticate into BCL Production database, source tree, backup store, or project storage.

### 3.2 Data Boundary

Online must never directly query Internal production databases.

Forbidden:

- raw PostgreSQL replication,
- unrestricted database mirroring,
- arbitrary SQL transfer,
- online-triggered commands,
- online-triggered script execution,
- remote shell,
- remote package installation,
- file shares exposed to Internet,
- copying unrestricted internal storage to Online.

### 3.3 Transport Rule

The Data Bridge transports **data, never instructions**.

Allowed example:

```json
{
  "user_id": "canonical-user-id",
  "module_id": "BIM-MINDSET-01",
  "event": "completed",
  "timestamp": "..."
}
```

Forbidden examples:

```text
run_command
execute_script
install_package
update_arbitrary_sql
powershell_payload
javascript_payload
dll
exe
```

---

## 4. P0 — Identity & Authentication Foundation

**P0 is a blocking prerequisite.**

Do not implement BCL Online user-state synchronization, learning progress, Workspace projection, or user-linked runtime data before this foundation is complete.

### 4.1 Canonical Immutable User Identity

The system must have one permanent canonical identifier per person.

Target rule:

```text
ONE PERSON = ONE CANONICAL USER ID
```

The canonical ID must:

- be immutable,
- remain unchanged if name changes,
- remain unchanged if email changes,
- remain unchanged if role changes,
- remain unchanged if BIM level changes,
- be used consistently by all modules,
- become the identity key used in cross-channel data exchange.

Before introducing a new ID format, inspect the existing PostgreSQL user schema.

If an existing `users.id` is already stable and suitable, reuse it.

Do not create a second identity system unnecessarily.

### 4.2 Authentication Providers

BCL may support more than one login mechanism.

Current target model:

```text
                 CANONICAL USER
                       │
              ┌────────┴────────┐
              │                 │
         LOCAL AUTH        GOOGLE OAUTH
              │                 │
              └──── same user_id┘
```

Local authentication and Google OAuth must never create duplicate logical users for the same person.

### 4.3 Required P0 Tasks

- Inspect current PostgreSQL `users` schema.
- Identify the current primary user identifier.
- Confirm whether it is safe to use as immutable canonical ID.
- Audit existing duplicate users.
- Ensure local login returns canonical `user_id`.
- Ensure Google login returns canonical `user_id`.
- Ensure Google signup links to existing canonical users when appropriate.
- Ensure account linking cannot silently create duplicate identities.
- Ensure frontend stores the canonical ID consistently.
- Ensure all modules use canonical ID rather than email/name fallback.
- Use canonical ID as the JWT identity subject where appropriate.
- Audit existing JWT claims.
- Audit local password hashing.
- Audit password policy.
- Audit login throttling / brute-force protection.
- Audit password reset/recovery.
- Audit local-account / Google-account linking.
- Preserve separate credentials and sessions for Internal and Online.

### 4.4 Identity vs Session

Same person does **not** mean same session.

Target:

```text
Canonical User
     │
     ├── Internal Session
     │      internal token / permission context
     │
     └── Online Session
            online token / permission context
```

Online tokens must not automatically be valid for Internal APIs.

Internal tokens must not automatically be valid for Online APIs.

---

## 5. Official Data Classification

Every feature or dataset must be classified before implementation.

### Class A — ONLINE NATIVE

Data born and primarily owned by BCL Online.

Examples:

- online learning profile data,
- YouTube completion state,
- practice history,
- personal learning progress,
- online learning dashboard state,
- selected certificate evidence,
- other explicitly approved online learner state.

### Class B — INTERNAL MASTER / PUBLISHED PROJECTION

Internal remains authoritative.

Online receives only an approved, reduced projection.

Examples:

- selected BIM Workspace dashboard information,
- selected task status,
- selected KPI result,
- selected training information,
- selected internal reference metadata.

Rule:

```text
Internal = Master
Online   = Projection
```

Never create a second independently authoritative copy of the same operational record.

### Class C — INTERNAL ONLY

Must never leave Internal unless explicitly reclassified through architecture review.

Examples:

- Revit models,
- IFC files,
- Navisworks files,
- native project files,
- internal server paths,
- confidential reports,
- internal administration data,
- production database,
- secrets,
- backups,
- internal source code,
- sensitive project evidence,
- unrestricted exports.

### Workflow State — INBOUND CANDIDATE

This is not an ownership class.

It is the temporary state of online-generated data waiting to enter Internal.

Flow:

```text
BCL Online
   ↓
Online Inbox
   ↓
Online Relay
   ↓
IEN INBOUND_QUARANTINE
   ↓
validation
   ↓
IEN INBOUND_CLEAN
   ↓
BCL Internal imports
```

No inbound candidate may write directly to production data.

---

## 6. BCL Internal ↔ IEN Exchange Contract

This baseline is locked.

Use:

```text
Shared Folder + Package + Manifest
```

Do not use:

- direct database connection,
- direct PostgreSQL credentials,
- inbound REST API into BCL Production,
- remote execution.

### 6.1 Exchange Locations

Conceptual folders on IEN:

```text
IEN/
├── OUTBOUND_DROP/
├── OUTBOUND_SENT/
├── INBOUND_QUARANTINE/
├── INBOUND_CLEAN/
└── AUDIT/
```

BCL Production should only need limited access:

```text
OUTBOUND_DROP  → write
INBOUND_CLEAN  → read
```

IEN must not require broad access to BCL Production.

### 6.2 Package Structure

Example:

```text
package-01842/
├── data.json
├── manifest.json
└── optional-approved-assets/
```

Example manifest:

```json
{
  "package_id": "01842",
  "type": "learning_progress",
  "created_at": "2026-09-17T14:00:00+07:00",
  "revision": 1842,
  "schema_version": "1",
  "files": [
    "data.json"
  ]
}
```

Recommended extensions:

- SHA-256 checksums,
- declared content types,
- record count,
- source channel,
- target channel,
- package size,
- previous revision / checkpoint,
- producer version.

### 6.3 Package Requirements

- Schema must be explicit.
- Unknown fields must not silently gain authority.
- Unknown file types must be rejected.
- Executable content must be rejected.
- Packages must be fully written before being processed.
- Partial files must never be imported.
- Processing must be idempotent where possible.
- Every accepted/rejected package must be auditable.

---

## 7. IEN Lifecycle

IEN is locked as **24/7 infrastructure**.

BCL Production remains office-hours / internal operational availability.

Online Relay remains 24/7.

BCL Online remains 24/7.

### When BCL Production is OFF

IEN may:

- retain outbound packages already available,
- communicate with Online Relay,
- retain inbound queue state,
- perform validation,
- maintain quarantine,
- maintain audit logs,
- maintain checkpoint state.

IEN must not:

- attempt privileged access into BCL Production,
- execute commands against BCL Production,
- access production DB directly,
- circumvent the package exchange boundary.

### When BCL Production returns

Perform startup synchronization:

- publish pending approved outbound packages,
- receive and validate pending inbound packages,
- expose only validated packages in `INBOUND_CLEAN`,
- maintain revision/checkpoint continuity.

---

## 8. Synchronization Model

Use **periodic controlled synchronization**, not a permanent live socket.

Baseline:

```text
Startup Sync
     │
sync every approximately 15 minutes
     │
Final Sync before planned shutdown
```

No 1–5 minute near-real-time requirement is assumed.

No permanent WebSocket or always-open bidirectional channel is required.

### 8.1 Outbound

```text
BCL Internal
   ↓
approved projection / export package
   ↓
IEN OUTBOUND_DROP
   ↓
validation
   ↓
Online Relay
   ↓
Published Store
   ↓
BCL Online
```

### 8.2 Inbound

```text
BCL Online
   ↓
Online Inbox
   ↓
Online Relay
   ↓
IEN pulls using internally initiated outbound HTTPS
   ↓
INBOUND_QUARANTINE
   ↓
validation
   ↓
INBOUND_CLEAN
   ↓
BCL Internal imports
```

The Online Relay never initiates a connection into Internal.

---

## 9. Last Known Good Data

BCL Online must not depend on BCL Internal uptime.

If Internal is unavailable:

```text
BCL Online = continue serving Last Known Good Data
```

New published versions should not become active until accepted.

Recommended pattern:

```text
upload candidate
      ↓
validate
      ↓
accept
      ↓
atomic switch current pointer
```

If validation fails, retain the previous known-good version.

The Online UI should eventually expose a last-sync timestamp.

Example:

```text
Data terakhir disinkronkan:
17 September 2026, 13:45 WIB
```

---

## 10. BCL Online Phase 1 Scope — LOCKED

Phase 1 is intentionally limited.

The scope may grow later, but Codex must not silently expand it.

### Included in Phase 1

#### Public / online-safe content

- BIM Mindset
- BIM Governance
- Delivery Workflow
- approved theory pages
- selected public theory quizzes

#### Online Learning Core

- Courses / Learning Path
- approved YouTube learning content
- Practice
- My Progress / Learning Dashboard
- Profile
- selected Certifications / certificate evidence

### Authenticated / later extension candidates

Not mandatory in the first implementation wave:

- My Training
- selected training workflows
- level request workflow

### Advanced Bridged Feature — Later Phase

- Divisi BIM Workspace

The Workspace is not a static page.

It is an operational management application and must be treated as higher-risk bridged functionality.

Initial online implementation, when approved, should favor:

```text
read / projection first
write later
```

### Internal Only

Do not move to Online in Phase 1:

- formal examination process,
- project models,
- Revit / IFC / Navisworks files,
- internal CDE/project storage,
- confidential reports,
- internal server file paths,
- internal admin/settings,
- production DB access,
- unrestricted exports,
- sensitive operational evidence.

---

## 11. Formal Exam Restriction

Current formal exam implementation must not be assumed internet-ready.

If frontend exam code includes:

- question,
- options,
- correct answer,
- explanation,

then that model is not sufficient for secure formal internet examination.

For Phase 1:

```text
Formal Exam = INTERNAL ONLY
```

If formal online examination is ever approved, redesign it so that:

- answer keys never ship to the browser,
- question delivery is server-side,
- attempts are bounded,
- question sets are randomized where appropriate,
- scoring authority remains server-side,
- integrity controls are reviewed independently.

Practice/self-assessment can follow a less restrictive model if explicitly classified as such.

---

## 12. YouTube Learning Model

Preferred online media strategy:

```text
BCL stores metadata
YouTube stores/delivers the video
```

Online-safe metadata may include:

- title,
- description,
- module mapping,
- learning objective,
- YouTube URL,
- video ID,
- completion rules.

Do not replicate internal MP4 files to Online merely because the learning page needs video.

Legacy internal video paths should remain Internal unless explicitly transformed to approved online media.

---

## 13. Divisi BIM Workspace Online Rules

When this phase begins:

### Internal remains SSOT

```text
Internal PostgreSQL = operational authority
Online Workspace    = approved projection
```

Do not build two independently authoritative Workspace systems.

### Initial candidates for Online

- Dashboard
- personal task list
- selected Gantt view
- selected performance metrics
- selected KPI projection

### Later controlled write candidates

Only after Data Bridge is proven:

- task progress updates,
- worklog confirmation,
- selected submission actions.

### Keep Internal

- admin/settings,
- sensitive project data,
- unrestricted CSV/export,
- sensitive reports,
- high-risk issue/meeting content,
- privileged approval workflows unless separately approved.

---

## 14. Local Browser Storage Rule

Current BCL uses localStorage heavily.

For BCL Online:

```text
localStorage = cache / convenience
NOT authoritative SSOT
```

Personal learning progress should eventually become server-backed Online data.

Reason:

- multi-device consistency,
- browser reset resilience,
- identity consistency,
- auditable user history,
- cross-channel synchronization.

Avoid designing new critical state that exists only in browser storage.

---

## 15. Permission Model

Identity and permission are separate.

Same canonical user may have different capability in each channel.

Example:

```text
Canonical User
   │
   ├── Internal
   │     Workspace: full
   │     project data: allowed
   │
   └── Online
         learning: full
         Workspace: read-only
         project data: denied
```

Never assume that Internal privileges automatically become Online privileges.

Use:

- least privilege,
- explicit role mapping,
- explicit online capability mapping,
- default deny.

---

## 16. Operational Guardrails

### 16.1 Environment Separation

At minimum distinguish:

```text
development
staging / validation
production
```

Production credentials, databases, queues, and storage must not be reused casually in development.

A deployment must be promotable through controlled environments rather than edited directly in production.

### 16.2 Secrets Management

Secrets must never be committed to GitHub or embedded in frontend code.

Examples:

- database credentials,
- OAuth client secrets,
- JWT signing secrets,
- relay credentials,
- storage keys,
- TLS private keys,
- service-account credentials.

Use environment-specific secret management.

### 16.3 Backup and Restore

Before Online Native data becomes operational, define:

- database backup frequency,
- retention policy,
- object-storage recovery,
- queue/inbox recovery expectations,
- restore test procedure,
- ownership of recovery actions.

A backup that has never been restore-tested must not be treated as sufficient recovery assurance.

### 16.4 Migration and Rollback

Every schema migration that affects identity, learning state, relay packages, or Workspace projections must have:

- forward migration plan,
- compatibility consideration,
- rollback or recovery plan,
- migration audit trail.

P0 identity remediation must include mapping/backfill for existing records before old fallback identity logic is removed.

### 16.5 Observability and Incident Traceability

At minimum retain visibility into:

- authentication failures,
- package publication failures,
- inbound validation failures,
- rejected packages,
- queue backlog,
- last successful sync,
- active published revision,
- application errors.

Operational logs must not expose secrets or sensitive payloads unnecessarily.

### 16.6 Channel Clarity

BCL Internal and BCL Online must be visibly distinguishable.

Use separate hostnames/origins and clear UI environment indicators.

A device having Internet access must not determine which channel is in use.

The accessed hostname/origin determines the channel.

Example conceptual model:

```text
Internal hostname → BCL Internal
Online hostname   → BCL Online
```

Exact DNS names are selected later.

---

## 17. Non-Goals for Initial Project

Do not spend Phase 1 effort on:

- Kubernetes,
- complex microservice decomposition,
- unnecessary message-broker infrastructure,
- live database replication,
- real-time sockets,
- public access to Internal BCL,
- full Workspace migration,
- formal online examination,
- raw BIM model hosting,
- internet-facing Internal APIs,
- direct Online-to-LAN access.

Prefer the simplest implementation that preserves the architecture contract.

---

## 18. Implementation Roadmap

## Phase P0 — Identity & Authentication Foundation

**Blocking phase**

Deliverables:

- canonical immutable user ID confirmed,
- duplicate identity audit,
- local + Google auth unified to same person,
- JWT identity normalized,
- frontend identity normalized,
- legacy email/name fallbacks removed from identity decisions,
- auth security review completed.

Exit criteria:

- one person cannot produce multiple logical BCL identities through different login methods,
- every authenticated request resolves to a canonical user ID.

---

## Gate G0 — Technology Selection

**Mandatory decision gate after P0 and before persistent BCL Online infrastructure is implemented.**

Codex may complete P0 without selecting the final Online technology stack.

At G0, evaluate and explicitly select the platform/stack for:

- Online frontend / hosting,
- Online backend / API,
- Online database,
- Online Relay,
- object / asset storage,
- authentication implementation,
- DNS / TLS,
- deployment pipeline,
- logging / observability,
- backup / recovery.

Selection criteria must include:

- compatibility with the locked architecture,
- security boundary preservation,
- operational simplicity,
- cost,
- maintainability by the Engineering/BIM team,
- 24/7 availability requirements,
- support for canonical identity,
- support for durable queue / inbox behavior,
- backup and restore capability,
- vendor lock-in risk,
- deployment and rollback simplicity.

Codex must not silently choose a permanent production stack before this gate is approved.

Exit criteria:

- target stack documented,
- responsibilities of each platform/service documented,
- no selected platform requires direct inbound connectivity to BCL Internal,
- no selected platform breaks the data-classification rules,
- deployment environments are defined.

---

## Phase P1 — BCL Online Shell

Goal:

Create the Online product boundary without sensitive runtime integration.

Deliverables:

- Online application shell,
- clear visual distinction from Internal BCL,
- public-safe navigation,
- online-safe config,
- deployment pipeline from sanitized GitHub mirror,
- environment separation,
- no Internal dependency.

Exit criteria:

- BCL Online loads independently even when BCL Internal is unavailable.

---

## Phase P2 — Public Learning Content

Deliverables:

- BIM Mindset,
- Governance,
- Delivery Workflow,
- selected theory pages,
- approved theory quizzes,
- approved YouTube material.

Exit criteria:

- no Internal-only asset path,
- no direct Internal API dependency,
- all content classified.

---

## Phase P3 — Online Learning Identity & State

Deliverables:

- Online account context,
- Profile,
- Learning Path,
- Practice,
- My Progress,
- Learning Dashboard,
- selected certificate evidence,
- server-backed learning state.

Exit criteria:

- localStorage is not authoritative,
- online learning data resolves through canonical user identity,
- multi-device state is consistent.

---

## Phase P4 — Online Relay

Deliverables:

- Published Store,
- Durable Queue,
- Online Inbox,
- Asset Store,
- audit logging,
- Last Known Good publication model.

Exit criteria:

- Online Relay operates 24/7,
- BCL Online remains usable while Internal is offline.

---

## Phase P5 — IEN

Deliverables:

- dedicated 24/7 IEN,
- OUTBOUND_DROP,
- INBOUND_QUARANTINE,
- INBOUND_CLEAN,
- checkpoint,
- audit log,
- outbound HTTPS client,
- package validation,
- manifest validation.

Exit criteria:

- no DB credential to BCL Production,
- no inbound Internal API,
- no public listener required for Online Relay,
- package exchange is auditable.

---

## Phase P6 — Controlled Outbound Publication

Deliverables:

- approved data projection,
- package generation,
- manifest generation,
- revision/checkpoint logic,
- Relay publication,
- Last Known Good switching.

Exit criteria:

- only explicitly classified projection data leaves Internal,
- raw production tables never leave Internal.

---

## Phase P7 — Controlled Inbound Intake

Deliverables:

- Online Inbox,
- Relay queue,
- IEN pull,
- quarantine,
- validation,
- clean package release,
- Internal import workflow,
- ACK/checkpoint.

Exit criteria:

- Online-originated data cannot directly mutate production,
- rejected payloads remain isolated and auditable.

---

## Phase P8 — My Training / Extended Learning Workflows

Only begin after the learning core and Data Bridge are stable.

Evaluate:

- batch data,
- classwork,
- participant submission,
- mentor feedback,
- evidence handling,
- internal-path replacement with online-safe evidence.

Do not expose UNC/internal filesystem paths online.

---

## Phase P9 — Divisi BIM Workspace Projection

Start read-only.

Deliverables may include:

- Dashboard projection,
- selected tasks,
- selected Gantt,
- selected KPI,
- selected performance state.

Exit criteria:

- Internal remains authoritative,
- Online cannot create a conflicting operational master.

---

## Phase P10 — Selected Online Writes

Only after:

- inbound quarantine is proven,
- identity is stable,
- permissions are reviewed,
- audit trail is reliable.

Potential candidates:

- task progress,
- worklog confirmation,
- selected controlled submissions.

Every write capability requires explicit approval before implementation.

---

## 19. Codex Mandatory Decision Procedure

Before implementing any feature, Codex must answer:

1. What data does this feature use?
2. Which data class does it belong to?
3. Where is the authoritative master?
4. Does this feature require Internal availability?
5. Is that dependency permitted?
6. Does it introduce an inbound route to Internal?
7. Does it use canonical immutable user ID?
8. Does it expose Internal credentials, paths, files, or secrets?
9. Is the feature part of the approved phase scope?
10. Can the same goal be achieved with a smaller attack surface?

If the answer is ambiguous, do not silently decide in favor of broader connectivity.

Default to:

```text
INTERNAL ONLY
```

until explicitly approved.

---

## 20. Codex Prohibited Actions

Codex must not:

- expose BCL Internal to the public Internet,
- open unsolicited inbound access into Internal,
- connect Online directly to Internal PostgreSQL,
- replicate raw Internal databases,
- treat GitHub as runtime datastore,
- use email/name as cross-system identity key,
- reuse Internal session tokens as Online session tokens,
- copy Internal secrets into Online builds,
- publish internal UNC paths,
- make Online depend on Internal office-hours uptime,
- send executable payloads through the Data Bridge,
- implement arbitrary remote commands,
- expand Phase 1 scope without explicit approval,
- move formal exams online without redesign,
- create an independent authoritative Online Workspace,
- use localStorage as SSOT for new critical Online state.

---

## 21. Codex Required Behaviors

Codex must:

- preserve offline independence of BCL Internal,
- preserve 24/7 independence of BCL Online,
- preserve 24/7 IEN and Online Relay roles,
- classify data explicitly,
- use canonical immutable user identity,
- use default deny,
- apply least privilege,
- keep sessions separate by channel,
- use approved projections,
- validate inbound data,
- quarantine untrusted inbound data,
- maintain auditability,
- maintain checkpoint/revision state,
- preserve Last Known Good data,
- make sensitive assumptions explicit in code comments or architecture notes,
- keep source-code distribution separate from runtime-data transfer.

---

## 22. Naming Baseline

Use these architecture terms consistently:

- **BCL Internal** — existing original internal BCL application
- **BCL Production** — production runtime of BCL Internal
- **BCL Online** — internet-accessible BCL product
- **IEN** — Internal Exchange Node
- **Online Relay** — 24/7 cloud/DMZ data relay and online datastore boundary
- **Published Projection** — approved subset of Internal-master data
- **Inbound Candidate** — online-originated data awaiting validation/import
- **Last Known Good Data** — most recent accepted Online published state
- **Canonical User ID** — immutable identity key shared logically across channels

Avoid vague terms such as:

- sync everything,
- mirror database,
- same login,
- shared backend,
- direct connection,
- public BCL,

unless the exact architecture meaning is explicitly stated.

---

## 23. Definition of Success

The BCL Online project is successful when:

- users can access approved BCL learning features through the Internet,
- the Online system remains available while Internal is off,
- Internal BCL remains fully usable without Internet,
- the same person is recognized consistently through canonical identity,
- Google and local login resolve to the same logical user,
- sensitive Internal data does not leak into Online,
- Online cannot directly control or query Internal production,
- all cross-boundary data exchange is explicit and auditable,
- future online features can be added without weakening the core trust boundaries.

---

## 24. Current Locked Decisions

The following are considered architecture decisions, not open implementation suggestions:

- BCL Internal remains the original/canonical internal system.
- GitHub is downstream source mirror only.
- Online must not depend on Internal uptime.
- Internet must not initiate connections into BCL Internal.
- BCL Production ↔ IEN uses shared-folder package exchange + manifest.
- No direct IEN database access into BCL Production.
- IEN is separate infrastructure and operates 24/7.
- Online Relay operates 24/7.
- Synchronization is periodic, approximately every 15 minutes, plus startup/final sync.
- Data ownership classification uses:
  - ONLINE NATIVE
  - INTERNAL MASTER / PUBLISHED PROJECTION
  - INTERNAL ONLY
  - INBOUND CANDIDATE as workflow state
- Phase 1 scope is limited to approved public learning and online learning core.
- Formal exam remains Internal for now.
- Divisi BIM Workspace is a later bridged phase and must remain Internal-master.
- Canonical immutable user identity and unified Local/Google authentication are P0 blockers before BCL Online user-data implementation.
- Technology Selection Gate (G0) is mandatory after P0 and before permanent Online infrastructure implementation.

---

## 25. Open Implementation Decisions

These may be selected later without violating the architecture contract:

- cloud provider,
- Online Relay technology stack,
- Online datastore engine,
- exact queue implementation,
- exact checksum/signing mechanism,
- exact authentication library,
- exact deployment platform,
- exact reverse proxy,
- exact logging stack,
- exact asset-storage provider,
- exact package schema versioning strategy,
- exact retry/backoff policy.

Codex may propose options, but must not alter the locked architecture rules above.

---

## 26. First Instruction to Codex

Before writing BCL Online code:

1. Audit the existing BCL user/authentication implementation.
2. Audit PostgreSQL user identity design.
3. Produce a P0 remediation plan.
4. Identify all places that currently infer identity from email, username, or name.
5. Identify Google OAuth/local-auth linking risks.
6. Identify existing duplicate-account risks.
7. Do not begin Online user-state implementation until P0 exit criteria are satisfied.
8. After P0, stop at Gate G0 and propose the technology stack for approval.
9. Do not create permanent production Online infrastructure before G0 is approved.
10. After G0, build the Online shell and Phase 1 learning scope only.
11. Treat every new dataset as unclassified until explicitly assigned to one of the official data classes.
12. Preserve all architecture invariants in this document.

---

**End of baseline architecture roadmap.**
