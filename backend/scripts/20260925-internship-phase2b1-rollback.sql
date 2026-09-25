BEGIN;

SELECT pg_advisory_xact_lock(hashtext('bcl_internship_phase_2b1'));

DELETE FROM bcl_schema_migrations
WHERE migration_key = '20260925_internship_phase_2b1';

DROP TABLE IF EXISTS submission_status_history;

DROP INDEX IF EXISTS idx_submission_files_owner_status;
DROP INDEX IF EXISTS uq_submission_files_storage_key;

ALTER TABLE IF EXISTS submission_files
    DROP CONSTRAINT IF EXISTS submission_files_internship_metadata_check,
    DROP CONSTRAINT IF EXISTS submission_files_sha256_check,
    DROP CONSTRAINT IF EXISTS submission_files_storage_status_check,
    DROP CONSTRAINT IF EXISTS submission_files_scan_status_check,
    DROP CONSTRAINT IF EXISTS submission_files_classification_check,
    DROP COLUMN IF EXISTS removed_by_user_id,
    DROP COLUMN IF EXISTS removed_at,
    DROP COLUMN IF EXISTS storage_status,
    DROP COLUMN IF EXISTS scan_status,
    DROP COLUMN IF EXISTS classification,
    DROP COLUMN IF EXISTS uploaded_by_user_id,
    DROP COLUMN IF EXISTS storage_key,
    DROP COLUMN IF EXISTS sha256,
    DROP COLUMN IF EXISTS mime_type,
    DROP COLUMN IF EXISTS safe_display_name,
    DROP COLUMN IF EXISTS original_file_name;

ALTER TABLE IF EXISTS assignment_submissions
    DROP COLUMN IF EXISTS withdrawn_at;

COMMIT;
