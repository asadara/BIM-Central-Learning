-- Additive identity/session state. Never rewrite users or its sequence.
CREATE TABLE IF NOT EXISTS bcl_auth_state (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
    local_password_enabled BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO bcl_auth_state(user_id) SELECT id FROM users ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS bcl_auth_sessions (
    sid UUID PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    auth_version INTEGER NOT NULL,
    method TEXT NOT NULL CHECK(method IN ('pwd','google')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS bcl_auth_sessions_user ON bcl_auth_sessions(user_id);
CREATE TABLE IF NOT EXISTS bcl_admin_sessions (
    sid TEXT PRIMARY KEY,
    sess JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS bcl_admin_sessions_expiry ON bcl_admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS bcl_provider_identities (
    provider TEXT NOT NULL CHECK(provider = 'google'),
    issuer TEXT NOT NULL CHECK(issuer = 'https://accounts.google.com'),
    subject TEXT NOT NULL CHECK(length(subject) BETWEEN 1 AND 255),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    provider_email TEXT, -- informational snapshot, never an ownership key
    linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    proof_method TEXT NOT NULL CHECK(proof_method IN ('registration','local_reauthentication','admin_approved')),
    approved_by INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    PRIMARY KEY(provider,issuer,subject),
    UNIQUE(user_id,provider,issuer)
);
CREATE TABLE IF NOT EXISTS bcl_google_challenges (
    id UUID PRIMARY KEY,
    nonce_hash TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK(purpose IN ('login','register','link','password')),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS bcl_google_link_requests (
    id UUID PRIMARY KEY,
    secret_hash TEXT NOT NULL UNIQUE,
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL,
    provider_email TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    approved_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    approved_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
    approver_version INTEGER,
    target_version INTEGER,
    verification_method TEXT,
    approval_reason TEXT
);
CREATE TABLE IF NOT EXISTS bcl_auth_events (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event TEXT NOT NULL,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION bcl_auth_user_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO bcl_auth_state(user_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bcl_auth_user_insert ON users;
CREATE TRIGGER bcl_auth_user_insert AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION bcl_auth_user_insert();

CREATE OR REPLACE FUNCTION bcl_auth_security_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.password IS DISTINCT FROM NEW.password OR OLD.is_active IS DISTINCT FROM NEW.is_active
       OR OLD.system_role IS DISTINCT FROM NEW.system_role THEN
        UPDATE bcl_auth_state SET version=version+1,
          local_password_enabled=CASE WHEN OLD.password IS DISTINCT FROM NEW.password THEN true ELSE local_password_enabled END
          WHERE user_id=NEW.id;
        UPDATE bcl_auth_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=NEW.id;
        IF to_regclass('public.admin_password_reset_tokens') IS NOT NULL THEN
            UPDATE admin_password_reset_tokens SET used_at=COALESCE(used_at,now()) WHERE user_id=NEW.id::text;
        END IF;
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bcl_auth_security_change ON users;
CREATE TRIGGER bcl_auth_security_change AFTER UPDATE OF password,is_active,system_role ON users
FOR EACH ROW EXECUTE FUNCTION bcl_auth_security_change();

INSERT INTO bcl_schema_migrations(migration_key) VALUES('20260918_p0_2_auth') ON CONFLICT DO NOTHING;
