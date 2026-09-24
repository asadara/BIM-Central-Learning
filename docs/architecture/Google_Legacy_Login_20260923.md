# Google login for existing BCL users

After selecting a Google account, eligible existing users now sign in to their
original BCL user ID without entering a BCL password. No user is created by login.

The additive `20260923_google_legacy_link` migration freezes active, unlinked,
unambiguous legacy user IDs, normalized email addresses and authentication
versions. Reapplying it never adds later registrations or refreshes edited emails.
It preserves all user fields, password hashes, roles, learning references and the
user sequence. No provider identity is inferred or inserted during migration.

Only a fresh, server-verified Google token can claim a candidate: the email must
match exactly (case/outer whitespace normalized), and Google must be authoritative
for it (`@gmail.com`, or verified email with the signed Workspace `hd` claim).
Token signatures, audience, issuer, expiration and one-use nonce remain enforced.
See [Google's verification guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

Claiming rechecks active state, unchanged authentication version/email, namespace
uniqueness and existing provider ownership while locking the user. It persists
issuer/sub ownership with proof method `verified_google_legacy_email`, records an
audit event and revokes previous sessions. Password and role remain unchanged.
Future login uses the saved issuer/sub even if Google's email later changes.

Third-party email without Google's authority, conflicting identities, users added
after the migration and changed legacy records retain the password/admin linking
flow. Registration and account-settings linking keep their existing behavior.
Without this migration the backend continues to require manual linking.

This extends the existing P0-2 login contract; its other authentication and session
rules remain in place.

## Activation and verification

1. Run `node backend/scripts/test-p0-security.js --p0-2` (disposable PostgreSQL).
2. Run `node backend/scripts/run-google-legacy-link-migration.js` for a rolled-back rehearsal.
3. Run the same migration with `--apply`; only eligibility and the proof-method
   constraint are changed. No existing user is linked until fresh Google login.
4. Restart only the BCL backend and check `/ping` plus the HTTPS login page.
5. Users already on a pending linking screen must reload and select Google again;
   previously issued tickets do not become automatic proof retroactively.

Real Google account selection requires the user. Integration tests verify signed
tokens using isolated fixture keys and do not use production Google credentials.

## Activation checkpoint: 23 September 2026

- All 31 P0-2 integration checks passed, including competing claims and existing
  administrator role preservation.
- Operational migration committed: 16 eligible legacy accounts, 13 Gmail,
  zero automatically linked yet. User data and sequence remained unchanged.
- Backend restart was rejected by automatic approval review (`blocked by policy`),
  without a detailed reason. The restart command did not execute.
- At this checkpoint, the old backend PID 9468 was still running and HTTPS login
  returned 200. Activation remained pending a backend restart; this dated record
  does not establish the current runtime status.
