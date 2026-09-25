BEGIN;

SELECT pg_advisory_xact_lock(hashtext('bcl_internship_phase_4b'));

DO $$
BEGIN
    IF to_regclass(current_schema() || '.internship_batch_config') IS NULL
       OR to_regclass(current_schema() || '.submission_revisions') IS NULL
       OR to_regclass(current_schema() || '.submission_reviews') IS NULL THEN
        RAISE EXCEPTION 'Internship Phases 1A through 3B must exist before Phase 4B';
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS internship_program_policy_versions (
    id TEXT PRIMARY KEY,
    policy_key TEXT NOT NULL,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    status TEXT NOT NULL CHECK (status IN ('draft', 'frozen', 'retired')),
    payload_json JSONB NOT NULL CHECK (jsonb_typeof(payload_json) = 'object'),
    checksum TEXT NOT NULL CHECK (checksum ~ '^[0-9a-f]{32}$'),
    created_by TEXT NOT NULL,
    frozen_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    frozen_at TIMESTAMPTZ,
    CONSTRAINT internship_policy_frozen_fields_check CHECK (
        (status = 'frozen' AND frozen_by IS NOT NULL AND frozen_at IS NOT NULL)
        OR status <> 'frozen'
    ),
    UNIQUE (policy_key, version_number)
);

CREATE OR REPLACE FUNCTION protect_frozen_internship_program_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status = 'frozen' THEN
        RAISE EXCEPTION 'A frozen Internship program policy version is immutable';
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

DROP TRIGGER IF EXISTS internship_program_policy_protect_trigger ON internship_program_policy_versions;
CREATE TRIGGER internship_program_policy_protect_trigger
    BEFORE UPDATE OR DELETE ON internship_program_policy_versions
    FOR EACH ROW EXECUTE FUNCTION protect_frozen_internship_program_policy();

ALTER TABLE internship_batch_config
    ADD COLUMN IF NOT EXISTS policy_version_id TEXT
        REFERENCES internship_program_policy_versions(id) ON DELETE RESTRICT;

-- Absorb the legacy operational policy into one immutable authority. Assignment
-- requirements are copied only when they were explicitly classified already.
-- Unknown/legacy classwork is deliberately omitted and surfaced as a warning;
-- visibility, publication and practice_task type are never requirement authority.
INSERT INTO internship_program_policy_versions (
    id, policy_key, version_number, status, payload_json, checksum,
    created_by, frozen_by, frozen_at
)
SELECT
    'internship-policy:' || md5(ibc.batch_id),
    'internship-batch:' || ibc.batch_id,
    1,
    'frozen',
    payload.value,
    md5(payload.value::text),
    'migration:20260925_internship_phase_4b',
    'migration:20260925_internship_phase_4b',
    CURRENT_TIMESTAMP
FROM internship_batch_config ibc
CROSS JOIN LATERAL (
    SELECT COALESCE(ibc.policy_json, '{}'::jsonb) || jsonb_build_object(
        'contractVersion', 'internship-completion-v1',
        'learningPathVersionId', ibc.learning_path_version_id::text,
        'assignments', CASE
            WHEN jsonb_typeof(ibc.policy_json->'assignments') = 'array' THEN
                COALESCE((
                    SELECT jsonb_agg(entry.value ORDER BY entry.ordinality)
                    FROM jsonb_array_elements(ibc.policy_json->'assignments') WITH ORDINALITY AS entry(value, ordinality)
                    WHERE entry.value->>'requirementType' IN ('required', 'optional')
                      AND NULLIF(entry.value->>'assignmentId', '') IS NOT NULL
                      AND NULLIF(entry.value->>'label', '') IS NOT NULL
                      AND NULLIF(entry.value->>'definitionDigest', '') IS NOT NULL
                ), '[]'::jsonb)
            ELSE '[]'::jsonb
        END,
        'configurationWarnings', COALESCE(ibc.policy_json->'configurationWarnings', '[]'::jsonb)
            || jsonb_build_array(jsonb_build_object(
                'code', 'explicit_assignment_manifest_required',
                'message', 'Unclassified classwork was not inferred as required during Phase 4B bootstrap.'
            ))
    ) AS value
) payload
ON CONFLICT (id) DO NOTHING;

UPDATE internship_batch_config ibc
SET policy_version_id = 'internship-policy:' || md5(ibc.batch_id),
    updated_at = CURRENT_TIMESTAMP
WHERE policy_version_id IS NULL;

ALTER TABLE internship_batch_config
    ALTER COLUMN policy_version_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS internship_batch_config_policy_version_idx
    ON internship_batch_config (policy_version_id);

CREATE OR REPLACE FUNCTION protect_internship_batch_policy_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.policy_version_id IS DISTINCT FROM OLD.policy_version_id
       OR NEW.policy_json IS DISTINCT FROM OLD.policy_json THEN
        RAISE EXCEPTION 'An Internship batch frozen policy is immutable';
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS internship_batch_policy_protect_trigger ON internship_batch_config;
CREATE TRIGGER internship_batch_policy_protect_trigger
    BEFORE UPDATE OF policy_version_id, policy_json ON internship_batch_config
    FOR EACH ROW EXECUTE FUNCTION protect_internship_batch_policy_version();

CREATE TABLE IF NOT EXISTS internship_program_closeouts (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES training_batches(id) ON DELETE RESTRICT,
    participant_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    policy_version_id TEXT NOT NULL REFERENCES internship_program_policy_versions(id) ON DELETE RESTRICT,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    closeout_note TEXT NOT NULL DEFAULT '' CHECK (char_length(closeout_note) <= 2000),
    requirements_digest TEXT NOT NULL CHECK (requirements_digest ~ '^[0-9a-f]{64}$'),
    requirements_snapshot JSONB NOT NULL CHECK (jsonb_typeof(requirements_snapshot) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (batch_id, participant_user_id)
);

CREATE INDEX IF NOT EXISTS internship_program_closeouts_batch_idx
    ON internship_program_closeouts (batch_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS internship_program_completion_audit (
    id BIGSERIAL PRIMARY KEY,
    closeout_id TEXT NOT NULL REFERENCES internship_program_closeouts(id) ON DELETE RESTRICT,
    action TEXT NOT NULL CHECK (action IN ('closeout_initiated', 'closeout_completed')),
    batch_id TEXT NOT NULL REFERENCES training_batches(id) ON DELETE RESTRICT,
    participant_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    policy_version_id TEXT NOT NULL REFERENCES internship_program_policy_versions(id) ON DELETE RESTRICT,
    actor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS internship_completion_audit_target_idx
    ON internship_program_completion_audit (batch_id, participant_user_id, created_at);

CREATE OR REPLACE FUNCTION protect_internship_program_closeout_records()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Internship program closeout and audit records are append-only';
END $$;

DROP TRIGGER IF EXISTS internship_program_closeouts_append_only_trigger ON internship_program_closeouts;
CREATE TRIGGER internship_program_closeouts_append_only_trigger
    BEFORE UPDATE OR DELETE ON internship_program_closeouts
    FOR EACH ROW EXECUTE FUNCTION protect_internship_program_closeout_records();

DROP TRIGGER IF EXISTS internship_completion_audit_append_only_trigger ON internship_program_completion_audit;
CREATE TRIGGER internship_completion_audit_append_only_trigger
    BEFORE UPDATE OR DELETE ON internship_program_completion_audit
    FOR EACH ROW EXECUTE FUNCTION protect_internship_program_closeout_records();

INSERT INTO bcl_schema_migrations (migration_key)
VALUES ('20260925_internship_phase_4b')
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;
