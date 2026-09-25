BEGIN;

SELECT pg_advisory_xact_lock(hashtext('bcl_internship_phase_1a'));

DO $$
BEGIN
    IF to_regclass(current_schema() || '.internship_batch_config') IS NOT NULL
       AND EXISTS (SELECT 1 FROM internship_batch_config) THEN
        RAISE EXCEPTION 'Rollback refused: remove Internship batch configs explicitly before rollback';
    END IF;
END $$;

DROP TRIGGER IF EXISTS training_batches_protect_internship_type_trigger ON training_batches;
DROP FUNCTION IF EXISTS protect_internship_batch_program_type();
DROP TRIGGER IF EXISTS internship_batch_config_validate_trigger ON internship_batch_config;
DROP FUNCTION IF EXISTS validate_internship_batch_config();
DROP TABLE IF EXISTS internship_batch_config;

UPDATE learning_paths
SET current_published_version_id = NULL,
    updated_at = NOW()
WHERE id = 'bim-mindset-foundation'
  AND current_published_version_id = '6a6d1f8a-67cf-4dcb-b4e9-c4a2be0f1a01'::uuid;

DELETE FROM module_content_mappings
WHERE id = '6a6d1f8a-67cf-4dcb-b4e9-c4a2be0f1a03'::uuid;
DELETE FROM learning_path_modules
WHERE id = '6a6d1f8a-67cf-4dcb-b4e9-c4a2be0f1a02'::uuid;
DELETE FROM learning_path_versions
WHERE id = '6a6d1f8a-67cf-4dcb-b4e9-c4a2be0f1a01'::uuid;

ALTER TABLE training_batches DROP CONSTRAINT IF EXISTS training_batches_program_type_check;
DROP INDEX IF EXISTS idx_training_batches_program_type;
ALTER TABLE training_batches DROP COLUMN IF EXISTS program_type;

DELETE FROM bcl_schema_migrations
WHERE migration_key = '20260924_internship_phase_1a';

-- The learning_paths and learning_content_registry rows are intentionally retained:
-- they may have existed before this migration and contain no copied learning content.

COMMIT;
