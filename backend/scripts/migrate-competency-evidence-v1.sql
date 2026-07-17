BEGIN;

ALTER TABLE learning_attempts
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS verification_method TEXT,
    ADD COLUMN IF NOT EXISTS rubric_version TEXT;

ALTER TABLE user_certificates
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS verification_method TEXT;

CREATE INDEX IF NOT EXISTS idx_learning_attempts_verified_user
    ON learning_attempts (user_id, is_verified, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_certificates_verified_user
    ON user_certificates (user_id, is_verified, issued_at DESC);

-- Existing rows intentionally remain unverified. They have no server-side
-- provenance and are retained for audit/history without affecting competency.

COMMIT;
