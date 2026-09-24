-- Freeze existing, unambiguous accounts once. Later registrations/profile edits
-- cannot opt an account into automatic legacy linking.
CREATE TABLE IF NOT EXISTS bcl_google_legacy_candidates (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    auth_version INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    claimed_at TIMESTAMPTZ
);

ALTER TABLE bcl_provider_identities DROP CONSTRAINT IF EXISTS bcl_provider_identities_proof_method_check;
ALTER TABLE bcl_provider_identities ADD CONSTRAINT bcl_provider_identities_proof_method_check
    CHECK(proof_method IN ('registration','local_reauthentication','admin_approved','verified_google_legacy_email'));

INSERT INTO bcl_google_legacy_candidates(user_id,email,auth_version)
SELECT u.id,lower(btrim(u.email)),a.version
FROM users u JOIN bcl_auth_state a ON a.user_id=u.id
WHERE u.is_active IS TRUE AND position('@' in u.email)>1
  AND NOT EXISTS(SELECT 1 FROM bcl_provider_identities p WHERE p.user_id=u.id)
  AND NOT EXISTS(SELECT 1 FROM users other WHERE other.id<>u.id
      AND (lower(btrim(other.email))=lower(btrim(u.email)) OR lower(btrim(other.username))=lower(btrim(u.email))))
  AND NOT EXISTS(SELECT 1 FROM bcl_schema_migrations WHERE migration_key='20260923_google_legacy_link')
ON CONFLICT DO NOTHING;

INSERT INTO bcl_schema_migrations(migration_key) VALUES('20260923_google_legacy_link') ON CONFLICT DO NOTHING;
