# P0-2 — Authentication & Session Unification

18 September 2026. Architecture contract: [BCL Online roadmap](BCL_Online_Architecture_Roadmap_Codex.md). P0-1 is **CLOSED** by user review. P0-3, G0 and BCL Online are not started.

**Status: implementation, schema migration, isolated tests and runtime activation PASS; interactive existing-account validation PENDING.** Final backend PID13436 started at 15:44:16 WIB and includes the final source. A fixture passing Google verification is not a claim that the operator has completed a real Google login after cutover. [Sanitized runtime evidence](P0_2_Runtime_Validation_Evidence.json).

## Changes Made

**Source/schema facts:** authentication now uses PostgreSQL-backed provider identities, credential state and revocable sessions. All authenticated backend helpers consume a principal already verified by central middleware. Direct JWT verification was removed from the old auth routes and duplicate module middleware. Profile attributes remain separate from system authorization.

- Login, registration, link, approval completion, password establishment/change, logout and logout-all have separate operations. Unknown Google login returns an ownership-link request without creating a user.
- `google-auth-library` 10.5.0 replaces HTTP `tokeninfo`. Its production verifier checks signature/certificates, issuer, audience and expiry; application checks also enforce issuer normalization, nonempty subject, audience/authorized party, verified email, recent issuance, and one-time purpose-bound nonce.
- Profile updates cannot extend a session. Compatibility password updates compare the previous password hash in the SQL update; security-field changes revoke prior sessions at database level.
- Search download tickets now bind canonical ID, session ID/type and auth version, cap expiry to the originating session, and revalidate current session/account/permissions. Old v1 tickets are rejected; a valid Bearer cannot borrow a ticket's more privileged identity. This closes a discovered session-revocation bypass without migrating module records.
- Admin sessions are regenerated, persisted in PostgreSQL, restricted to HTTPS, and checked against current account state/role/version. An explicit Bearer credential always has precedence and cannot borrow an admin cookie after failure.
- Proxy trust is limited to loopback, matching the existing nginx upstream. LAN/link-local clients can no longer supply a trusted forwarded identity/scheme to bypass per-client throttling.
- Admin reset links use the configured Internal origin and ignore caller-controlled Host/forwarded scheme. Regression tests cover recovery-link host injection without sending email.
- Frontend login/signup, linking, account-security settings, admin ownership review and shared logout use the new endpoints. Link secrets remain in page memory; no Google token, linking ticket or password is stored in localStorage or reports.
- `express-rate-limit` upgraded from 8.2.1 to 8.7.0. The installed prior release was affected by an IPv4-mapped IPv6 bucket issue; address separation and authentication throttling are regression-tested. [Maintainer advisory](https://github.com/express-rate-limit/express-rate-limit/security/advisories/GHSA-46wh-pxpv-q5gq).

**Technical conclusion:** canonical identity is independent of email/name/provider choice. PostgreSQL availability is required for authenticated authority; JSON fallback cannot revive sessions or authenticate unmapped identities. Local login does not invoke Google.

## Files Changed

New backend files:

- `backend/services/authRuntime.js`, `googleIdentityService.js`, `adminSessionStore.js`.
- `backend/routes/authLifecycleRoutes.js`, `backend/utils/authLimiters.js`.
- `backend/scripts/p0-2-auth.sql`, `p0-2-auth-rollback.sql`, `run-p0-auth-migration.js`, `snapshot-p0-auth.js`.
- `backend/tests/p0-2-auth.test.js`.

Existing backend files changed for P0-2:

- `backend/server.js`; `backend/routes/userAuthRoutes.js`, `adminSessionRoutes.js`, `organizations.js`, `serverManagementRoutes.js`; `backend/services/userAuthService.js`; `backend/utils/auth.js`.
- `backend/utils/searchContentPolicy.js`: canonical, revocable session-bound download tickets.
- `backend/elearning/routes/activityRoutes.js`, `progressRoutes.js` delegate authentication to the central principal; module data/mappings are not migrated.
- `backend/scripts/test-p0-security.js`, `backend/tests/p0-1-security.test.js` adapt regression testing to the new session contract.
- `package.json`, `package-lock.json`: explicit Google verifier and updated rate limiter/dependency resolution.

Frontend changes under `BC-Learning-Main`:

- New: `js/auth-lifecycle.js`, `js/google-auth.js`, `js/account-security.js`, `js/auth-link-review.js`; `pages/account-security.html`, `pages/sub/auth-link-review.html`.
- Updated: `pages/login.html`, `pages/signup.html`, `pages/sub/adminbcl.html`, `pages/sub/adminbcl.js`, `js/admin/admin-panel.js`; both shared `components/navbar.html` variants.
- Shared logout wiring: `js/user.js`, `js/userindex.js`, `js/auth.js`, `js/lognav.js`, `js/navbar-loader.js`, `js/loadComponents.js`, `pages/js/navbar-loader.js`, `elearning-assets/js/user.js`, `elearning-assets/js/loadComponents.js`, `elearning-assets/js/component-loader.js`.

Documentation: this report, [migration/recovery runbook](P0_2_Migration_Runbook.md), [module-health tracking](BCL_Technical_Debt_Module_Health.md), and P0-1 closure/evidence documents. Existing uncommitted P0-1 work was retained; it is not all newly changed by P0-2.

## Schema / Migration Changes

Migration key: `20260918_p0_2_auth`. Applied transactionally on 18 September, 15:29 WIB, after read-only preflight, isolated apply/rollback/reapply tests and local identity backup.

| Object | Purpose |
|---|---|
| `bcl_auth_state` | FK to existing user ID; auth version and local-password-enabled flag |
| `bcl_auth_sessions` | Revocable JWT sessions, method, version and expiry; UUID identifies a session, not a user |
| `bcl_admin_sessions` | Express admin session store with expiry |
| `bcl_provider_identities` | Unique `(provider, issuer, subject)` mapped to existing canonical user FK; one Google provider per user |
| `bcl_google_challenges` | Hashed one-time nonces, purpose, optional authenticated ID, five-minute expiry |
| `bcl_google_link_requests` | Hashed bearer proof ticket, ten-minute expiry, explicit/manual approval evidence and versions |
| `bcl_auth_events` | Security audit events without credentials or raw provider subject |
| User INSERT/security UPDATE triggers | Initialize state; invalidate sessions and unused admin reset links after password, disabled-state or system-role changes |

No `users.id`, existing password, profile attribute, module reference or user sequence was changed by migration. All 16 users received auth-state rows with existing local credentials preserved. Provider mappings started empty because the old schema did not retain Google `sub`; no mapping was inferred from email.

**Verified immediately after apply:** all 16 rows and every user column unchanged; sequence remains `34`, `is_called=true`; no new or missing IDs. Local recovery backup and sanitized evidence are in ignored `.tmp/p0-2-activation/`. Forward/rollback guards and post-use recovery are specified in the runbook. Post-use rollback refuses to discard provider/revocation evidence.

## Local + Google Linking Model

`public.users.id` remains the canonical immutable integer ID. Google provider identity is the verified `sub` under canonical issuer `https://accounts.google.com` and provider `google`; `provider_email` is an informational snapshot. This follows Google's guidance to use `sub` as the stable account identifier. [Google verification guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

| Operation | Contract |
|---|---|
| Local login | Unique email/username locates the credential; bcrypt verifies the untrimmed password; JWT subject uses only user ID |
| Google login | Existing issuer/sub mapping only; unlinked proof yields HTTP 409 plus a pending request, no user insert |
| Google registration | Explicit `register` (`signup` compatibility alias); rejects provider collisions; email/username collisions require linking; creates employee only after fresh proof |
| Link with local credential | Fresh Google proof plus correct BCL identifier/password; if already authenticated, target must equal that canonical ID |
| Manual legacy linking | Current explicit admin role + fresh admin password + verified ownership method/reason + explicit target ID; Google holder completes the secret ticket; approval is invalidated by approver/target security changes |
| Set local password | Fresh proof from a Google subject already linked to the authenticated canonical ID; or current local password for a change |
| Unlink | Explicit HTTP 409 `UNLINK_NOT_ENABLED`; no silent deletion or reassignment |

Google-only registration stores an unusable random bcrypt value to preserve the existing NOT NULL schema, and disables local authentication until the owner establishes a password. Existing 16 password hashes are not changed and remain enabled, because their credential provenance cannot safely be inferred. A different email address does not move or break an existing provider mapping. Inactive users cannot authenticate, link or receive a session.

## JWT Contract

| Claim | Value |
|---|---|
| Algorithm | HS256 with the existing Internal secret; verifier pins the algorithm |
| `iss` / `aud` | `bcl-internal` / `bcl-internal-api` |
| `sub` | `String(public.users.id)` |
| `userId` | Compatibility string identical to `sub`; conflicting/nonnumeric identity claims rejected |
| `sid` / `sv` | Persisted session UUID / current auth version |
| `amr` | Exactly one of `pwd`, `google`, matching the persisted session |
| `auth_time`, `iat`, `exp` | Authentication time, issuance time and fixed one-hour expiry |
| `role`, `email` | System role plus informational email; every request re-reads role/email/active state from PostgreSQL |

No refresh token or refresh endpoint was introduced. Reauthentication creates a new session; a profile-only response reissues the same session and original expiry. Legacy seven-day JWTs fail the new claim/session contract and require login again. Future Online credentials are not implemented and are not accepted through a different audience/issuer.

## Session Lifecycle

| Event | Behavior |
|---|---|
| Login | New persisted JWT session; admin login instead regenerates the separate admin cookie session |
| Logout | Revoke the current JWT session; shared frontend then destroys the admin cookie session and clears local state only after server confirmation |
| Logout all | Increment user auth version, revoke JWT sessions; all admin sessions fail version revalidation |
| Password change/establishment | Database trigger increments version, revokes sessions and unused admin reset links; fresh proof gets one replacement JWT; admin password change requires login again |
| Password reset | Existing admin recovery token is consumed atomically with password update; expired/reused/unmapped tokens fail; all old JWT/admin sessions become invalid |
| Disabled/re-enabled user | Disable invalidates old sessions; re-enable does not resurrect them |
| System-role change | Trigger invalidates existing sessions; privileges are checked against the current stored system role |
| Profile/email change | Canonical ID and provider relationship unchanged; no extension of session lifetime |
| Google unavailable | Google authentication may fail; local bcrypt login continues without Google network calls |
| PostgreSQL unavailable | Protected authentication/authorization fails closed; no equivalent JSON authority |

Admin cookie: `bcl.admin.sid`, Secure, HttpOnly, SameSite=Lax, path `/`, 30-minute idle expiry and eight-hour absolute limit. Cookies are regenerated at login/bridge; bridge requires authentication no older than five minutes. Unsafe cookie-authenticated API requests require the configured Internal Origin. Explicit Bearer always wins; invalid/employee Bearer cannot be elevated by an ambient admin cookie. Session regeneration and server-side invalidation follow OWASP lifecycle guidance. [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

Auth rate limit: five failed attempts/IP/15 minutes, successful responses excluded. Google challenge creation has a separate 30/IP/15-minute bound. Store is per-process for the existing single-backend deployment.

## Tests Run

- `node backend/scripts/test-p0-security.js`: **26/26 PASS** on disposable PostgreSQL, including P0-1 role/profile/immutable-ID/hash/fallback/module-ownership regression checks.
- `node backend/scripts/test-p0-security.js --p0-2`: **24/24 PASS**, using real PostgreSQL, real Express routes/session store and production Google verification library with test RSA certificate material. No real Google credential or operational user was used by the integration fixtures.
- JavaScript syntax checks on 57 changed/new files and 8 inline scripts, plus `git diff --check`: PASS.
- Playwright browser fixtures: login/local raw password, Google nonce payload, unknown-login linking panel and password confirmation, canonical ID storage/redirect, server-confirmed logout, account password update, explicit registration and admin approval form/password clearing. API and Google SDK responses intercepted in the isolated browser; this is frontend wiring evidence, not real Google runtime evidence. Unrelated progress-sync attempts were blocked by the fixture; no operational API mutation was allowed.
- Operational migration read-only preflight, transactional apply, before/after all-column/sequence comparison: PASS.
- Operational activation: `/ping` and HTTPS Google config returned200 with `authContract=p0-2`. Final stdout confirms startup; final stderr has no schema/migration/config errors. Existing watchdog recovery overlapped the normal launcher UNC wait and started final PID13436 through the same launcher. Legacy5051 proxy `/ping` connection-refused entries occurred during restart windows; health subsequently passed. No nginx/PostgreSQL restart or configuration change was made.

## Test Results

Integration verifies existing bcrypt login offline, Local+Google same canonical ID after ownership proof, issuer/sub persistence across service recreation, changed Google/local emails, collision/no-auto-create behavior, signature/issuer/audience/expiry/sub/nonce/replay rejection, concurrent mapping ownership, raw password spaces, normalized JWT, expiry/role/disabled/reset/logout invalidation, cookie security/regeneration/precedence/CSRF, manual approval expiry/revocation, safe migration and rollback guards. Fixture ID15/20 remain separate and ID23 is absent.

Download-ticket tests exercise the real server access middleware: alias-only identity rejected, path binding, fresh permission denial, JWT logout/disable revocation, admin cookie logout revocation, and employee Bearer precedence over an admin-origin ticket all PASS.

Operational existing local/admin login, Google linking and subsequent real Google login remain **pending operator validation** at this document revision. The first verified Google proof created one pending link request, which expired at15:45:23 WIB without approval or provider association. This correctly did not create a user or count as successful login. The operator needs a fresh Google proof to continue. Do not interpret source/fixture PASS as completing that interactive check.

Latest read-only snapshot at15:46:17 WIB: 16 users, no added/removed IDs, no changed user columns (including credentials, profile and login statistics), sequence34 unchanged, zero provider mappings and zero authenticated user sessions. P0-2 is not marked fully validated or CLOSED while these operator checks remain outstanding.

## Existing User Compatibility

- All 16 canonical IDs, password hashes and profile rows preserved at migration; no sequence increment. Existing users need new sessions, not new IDs.
- Local credentials still accept existing short bcrypt passwords; policy is enforced on newly set passwords (8 characters minimum, 72 UTF-8 bytes maximum, boundary spaces retained).
- First post-cutover Google login needs an explicit relationship established once, because prior Google `sub` cannot be recovered from source or email. Subsequent logins use the persistent mapping.
- ID15/20 are not merged; orphan23, attendee-name matches and ambiguous legacy aliases are not imported or assigned.
- User JWT remains in the existing frontend localStorage for compatibility; session TTL and server revocation are enforced. No Online credential/session sharing was introduced.

## Residual Risks

1. Legacy Google first-link requires the owner's participation. Operator-assisted approval is an explicit privileged recovery operation, not automatic email matching; its reliability depends on the administrator verifying ownership correctly. Ambiguous identity cases remain unresolved until reviewed.
2. General user self-service email password reset did not exist and is not invented here. The existing admin reset channel remains configured recovery mailbox + SMTP; actual mail delivery was not exercised. Linked users can establish/change a local password with fresh Google proof.
3. Frontend JWT storage remains exposed to same-origin XSS as before. A full cookie/BFF client-session migration and site-wide XSS work require separate review. No password/Google/link secret is persisted by the new frontend.
4. Auth-session/challenge/event retention needs operational housekeeping policy; expired data cannot authorize requests, but persisted rows need eventual retention cleanup. Multi-process deployment would also require a shared rate-limit store.
5. `npm audit --omit=dev` still reports 11 dependency findings (8 high, 3 moderate) outside the fixed rate-limiter path, including Express/parser, upload, HTTP client and mail dependencies. This is not a claim that the application is vulnerability-free. Broad/major upgrades were not bundled; track and assess reachability before their respective module work.
6. Known P0-1 non-blocking `learning_materials` absence and transient PDF timeout remain in [module-health tracking](BCL_Technical_Debt_Module_Health.md), without repairs in P0-2.

## Items Deferred to P0-3

- Module-wide canonical-ID reference migration, legacy email/name/username keys and unmatched references.
- Manual review of duplicate candidates15/20, orphan23, meeting attendees with name-only matches and aliases; no automatic resolution.
- Learning module health review, including `learning_materials`, before/when P0-3 touches Learning.
- Profile, progress, practice/quiz/certificate, My Training, Level Request, Workspace/KPI/task/worklog/meeting/issues data reconciliation after an approved plan.

Provider unlink/recovery policy, operational retention and remaining dependency updates are separately tracked follow-ups; they are not permission to begin P0-3. **Stop after P0-2 validation for review.**
