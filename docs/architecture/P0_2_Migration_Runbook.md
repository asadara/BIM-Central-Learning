# P0-2 — Migration and activation runbook

18 September 2026. Contract: [BCL roadmap](BCL_Online_Architecture_Roadmap_Codex.md). Scope: Internal authentication only; no P0-3/G0/Online work.

## Forward plan

1. Run `node backend/scripts/test-p0-security.js` and `node backend/scripts/test-p0-security.js --p0-2` against disposable PostgreSQL. These runners never connect to the operational database. The P0-1 suite uses the new session contract; its two former tokeninfo/email-link cases are replaced by the P0-2 Google verification/linking suite.
2. Run `node backend/scripts/run-p0-auth-migration.js` (read-only preflight). Requires reviewed P0-1 migration, no ambiguous cross-namespace email/username matches. Never resolve conflicts by changing IDs or merging rows.
3. Capture `node backend/scripts/snapshot-p0-auth.js --baseline`. It refuses overwrite and requires 16 existing users. Evidence stores column digests, IDs and sequence, not credentials. Retain a local PostgreSQL backup of existing identity tables before activation. Backup files contain sensitive data and must stay outside source control.
4. Run `node backend/scripts/run-p0-auth-migration.js --apply`. Transaction locks users briefly (3-second lock timeout, 30-second statement timeout), adds authentication tables/triggers, inserts one auth-state row per existing ID, and checks every existing user field plus sequence before commit. No Google-sub backfill, user renumbering, credential reset, 15/20 merge, ID23 assignment or module migration occurs.
5. Restart only the verified BCL backend PID listening on 5052, using `start-backend-public.bat` with a hidden launcher. PostgreSQL/nginx remain running. The launcher may wait for the existing UNC share. Inspect the new stdout/stderr and `/ping`; `/api/auth/google/config` must report `authContract: p0-2`. Startup refuses to listen if the P0-2 ledger entry is absent.
6. Existing browser JWT/admin sessions need a fresh login. Local login remains independent of Google/Internet, provided PostgreSQL and the Internal origin are reachable. Admin requires HTTPS because its cookie is always Secure.
7. For each legacy Google user, perform first-link ownership confirmation. Login never creates a missing account. On `/pages/login.html`, a verified but unlinked Google identity returns a 10-minute request. Confirm the BCL password, or have an authorized admin verify ownership at `/pages/sub/auth-link-review.html` using fresh admin password, explicitly selected canonical ID, verification method and recorded reason. The Google holder must complete the secret request from the original browser. Email alone is not proof. Keep 15/20 ambiguous unless actual ownership evidence resolves which existing account is intended; never merge them.
8. Verify a second Google login uses the persisted issuer/sub mapping. Run `node backend/scripts/snapshot-p0-auth.js` and inspect column changes, row counts, protected IDs, sequence and sanitized provider/session evidence. Normal login counters/timestamps are expected; attribute/hash/ID changes are not.

## Rollback / recovery plan

- Failed apply: the transaction rolls back, including schema changes. Existing users/sequence are verified before commit. Investigate preflight/lock errors without changing ambiguous records.
- Before any P0-2 use: run `backend/scripts/p0-2-auth-rollback.sql` inside an explicit transaction. Its guard refuses rollback if any provider, session, challenge, pending request, auth event, changed auth version or disabled local credential exists. Restore the paired P0-1 source/dependency snapshot and restart using the normal launcher. Keep the original identity backup and evidence.
- After P0-2 use: **forward recovery is required**. Retain provider associations, credential state and revocation history. Do not drop tables, replay a P0-1 email-based Google login, restore old passwords, rewind sequences or resurrect invalidated tokens. Pause authentication traffic if necessary, back up current state and deploy a corrected P0-2 implementation. A database restoration requires a separately reviewed recovery window and reconciliation of post-backup changes; it is not an automatic rollback.
- Migration reapply is idempotent and preserves state/versions/mappings. It does not reactivate old sessions.

## Operator constraints

- Passwords/tokens must be entered only into the BCL origin; never into chat, reports or CLI history.
- Unknown passwords do not justify bypassing ownership proof. Google password recovery is handled by the account holder with Google; BCL can use an authorized manual ownership review for the BCL relationship.
- Unlink remains explicitly disabled pending recovery/last-credential policy review.
- Existing `learning_materials` warning and previously transient PDF timeout are accepted P0-1 non-blocking findings. Track them in [module health](BCL_Technical_Debt_Module_Health.md); do not repair them during this activation.
