BEGIN;

SELECT pg_advisory_xact_lock(hashtext('bcl_internship_phase_4b'));

DO $$
BEGIN
    IF to_regclass(current_schema() || '.internship_program_closeouts') IS NOT NULL
       AND EXISTS (SELECT 1 FROM internship_program_closeouts) THEN
        RAISE EXCEPTION 'Phase 4B rollback refused: closeout records require an approved export and maintenance plan';
    END IF;
    IF to_regclass(current_schema() || '.internship_program_completion_audit') IS NOT NULL
       AND EXISTS (SELECT 1 FROM internship_program_completion_audit) THEN
        RAISE EXCEPTION 'Phase 4B rollback refused: audit records require an approved export and maintenance plan';
    END IF;
END $$;

DROP TRIGGER IF EXISTS internship_completion_audit_append_only_trigger ON internship_program_completion_audit;
DROP TRIGGER IF EXISTS internship_program_closeouts_append_only_trigger ON internship_program_closeouts;
DROP FUNCTION IF EXISTS protect_internship_program_closeout_records();
DROP TABLE IF EXISTS internship_program_completion_audit;
DROP TABLE IF EXISTS internship_program_closeouts;

DROP TRIGGER IF EXISTS internship_batch_policy_protect_trigger ON internship_batch_config;
DROP FUNCTION IF EXISTS protect_internship_batch_policy_version();
DROP INDEX IF EXISTS internship_batch_config_policy_version_idx;
ALTER TABLE internship_batch_config DROP COLUMN IF EXISTS policy_version_id;

DROP TRIGGER IF EXISTS internship_program_policy_protect_trigger ON internship_program_policy_versions;
DROP FUNCTION IF EXISTS protect_frozen_internship_program_policy();
DROP TABLE IF EXISTS internship_program_policy_versions;

DELETE FROM bcl_schema_migrations
WHERE migration_key = '20260925_internship_phase_4b';

COMMIT;
