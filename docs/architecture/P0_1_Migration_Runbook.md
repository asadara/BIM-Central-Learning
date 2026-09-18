# P0-1 migration and recovery

Architecture contract: [BCL Online Architecture Roadmap](BCL_Online_Architecture_Roadmap_Codex.md).
Scope: BCL Internal, `public.users`; no Online/G0, provider linking, merging, ID replacement or user reassignment.

## Forward plan

1. Keep the secured P0-1 source and this runbook together. Run from `C:\BCL` with the existing local database configuration; do not copy credentials into commands or reports.
2. Run `node backend/scripts/run-p0-security-migration.js`. Default mode opens a read-only transaction. It checks supported bcrypt hashes, normalized duplicate emails/usernames, BIM level values and current constraints. A failed preflight requires investigation; it does not convert credentials or merge accounts.
3. Run the regression suite against disposable PostgreSQL: `node backend/scripts/test-p0-security.js`. Windows may require execution outside the restricted sandbox for `pg_ctl` to create its process token. `PG_BIN` can select an installed PostgreSQL binary directory. The runner binds only to loopback, overrides database environment variables, rejects pools pointing elsewhere and stops/deletes only its temporary cluster.
4. Apply `node backend/scripts/run-p0-security-migration.js --apply`. The transaction obtains an exclusive lock on the 16-row users table with a 3-second lock timeout and 30-second statement timeout. Concurrent writes may briefly wait. If the lock cannot be obtained, everything rolls back; retry in a quiet interval.
5. The runner verifies an in-memory digest of every existing user column and the existing sequence before committing. Any mismatch rolls back. It never prints hashes or user attributes. No migration statement updates a user row or sequence.
6. Activate the secured backend source through the normal controlled restart procedure. Existing admin sessions lacking the new explicit `systemRole` marker must sign in again. Validate the ordinary local/Google sign-in flows after activation using operator-authorized accounts. The user explicitly authorized runtime activation and operator-assisted credential entry on 18 September; credentials are used in memory by the temporary loopback helper and are not written to files or chat. The backend was restarted through `start-backend-public.bat`; see [Runtime Activation & Exit Validation](P0_1_Runtime_Activation_Exit_Validation.md) for actual results and outstanding exit criteria.

## Changes and rationale

- Keep the integer serial `public.users.id`, its primary key, sequence and references. Add a trigger rejecting any update that changes the ID.
- Add a bcrypt-format password constraint, first `NOT VALID`, then validate existing rows. Route code computes bcrypt hashes at cost 10. A format constraint is a storage safety check, not proof that the password belongs to a person.
- Add unique expression indexes on `lower(btrim(email))` and `lower(btrim(username))`. These protect each login namespace independently; provider linking and cross-namespace collision policy remain P0-2.
- Align only the blocking `bim_level` mismatch with source: allow NULL and the already-supported `BIM Specialist`, alongside the existing three levels. This does not change any person's level or redesign competency assessment.
- Record migration `20260917_p0_1_security_identity` in `bcl_schema_migrations`.
- On a fresh installation, run the existing `backend/create-tables.sql`, then this P0-1 migration before serving authentication traffic. The base schema file alone does not install these new protections.

## Rollback and recovery plan

Before commit, any error causes a complete transaction rollback. Forward apply, repeat apply, transaction rollback and the explicit reverse SQL are exercised on the disposable database.

Prefer forward recovery: retain the immutable-ID and credential constraints, correct the secured application source, and retry. Reverting the old authentication source restores known vulnerabilities and is not the normal recovery path.

Emergency reverse SQL is [p0-1-security-rollback.sql](../../backend/scripts/p0-1-security-rollback.sql). Execute its contents inside an explicit `BEGIN`/`COMMIT` transaction with writers paused, using the same database configuration. Roll back on any error. It removes the new password check, immutable-ID trigger/function and normalized indexes, restores the original three-level NOT NULL constraint, and removes only this migration marker. The ledger table remains.

Reverse SQL deliberately aborts if any user now has NULL or `BIM Specialist`. Do not invent a replacement level, delete users or reset passwords to make rollback pass. Keep the forward-compatible schema and fix the application instead, or obtain a separately reviewed data recovery plan. New legitimate registrations after activation must be preserved.

No backup restoration is required for this schema-only migration. If a future incident requires data restoration, use the established PostgreSQL backup/PITR procedure and reconcile post-backup writes first; never overwrite operational users with a JSON fallback or the disposable test database.

## Explicitly unresolved data

IDs 15 and 20, orphan reference 23, meeting attendees matched only by name, and all unproven aliases/synthetic users remain unchanged and unresolved. None is mapped, merged, imported or reassigned by forward or reverse migration.
