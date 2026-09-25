BEGIN;

SELECT pg_advisory_xact_lock(hashtext('bcl_internship_phase_2b1'));

DO $$
BEGIN
    IF to_regclass(current_schema() || '.assignment_submissions') IS NULL
       OR to_regclass(current_schema() || '.submission_files') IS NULL
       OR to_regclass(current_schema() || '.classwork_items') IS NULL THEN
        RAISE EXCEPTION 'Training submission schema must exist before Internship Phase 2B-1';
    END IF;
    IF to_regclass(current_schema() || '.internship_batch_config') IS NULL
       OR to_regclass(current_schema() || '.classwork_content_links') IS NULL THEN
        RAISE EXCEPTION 'Internship Phase 1A and Phase 2A must be migrated before Phase 2B-1';
    END IF;
END $$;

ALTER TABLE assignment_submissions
    ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;

ALTER TABLE submission_files
    ADD COLUMN IF NOT EXISTS original_file_name TEXT,
    ADD COLUMN IF NOT EXISTS safe_display_name TEXT,
    ADD COLUMN IF NOT EXISTS mime_type TEXT,
    ADD COLUMN IF NOT EXISTS sha256 TEXT,
    ADD COLUMN IF NOT EXISTS storage_key TEXT,
    ADD COLUMN IF NOT EXISTS uploaded_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS classification TEXT,
    ADD COLUMN IF NOT EXISTS scan_status TEXT,
    ADD COLUMN IF NOT EXISTS storage_status TEXT,
    ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS removed_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'submission_files_classification_check'
    ) THEN
        ALTER TABLE submission_files
            ADD CONSTRAINT submission_files_classification_check
            CHECK (classification IS NULL OR classification IN ('training', 'internal', 'project_restricted'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'submission_files_scan_status_check'
    ) THEN
        ALTER TABLE submission_files
            ADD CONSTRAINT submission_files_scan_status_check
            CHECK (scan_status IS NULL OR scan_status IN ('pending', 'clean', 'rejected', 'failed'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'submission_files_storage_status_check'
    ) THEN
        ALTER TABLE submission_files
            ADD CONSTRAINT submission_files_storage_status_check
            CHECK (storage_status IS NULL OR storage_status IN ('pending', 'stored', 'quarantined', 'deleted'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'submission_files_sha256_check'
    ) THEN
        ALTER TABLE submission_files
            ADD CONSTRAINT submission_files_sha256_check
            CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'submission_files_internship_metadata_check'
    ) THEN
        ALTER TABLE submission_files
            ADD CONSTRAINT submission_files_internship_metadata_check
            CHECK (
                storage_key IS NULL OR (
                    original_file_name IS NOT NULL
                    AND safe_display_name IS NOT NULL
                    AND mime_type IS NOT NULL
                    AND file_size > 0
                    AND sha256 IS NOT NULL
                    AND uploaded_by_user_id IS NOT NULL
                    AND classification IS NOT NULL
                    AND scan_status IS NOT NULL
                    AND storage_status IS NOT NULL
                )
            );
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_submission_files_storage_key
    ON submission_files (storage_key)
    WHERE storage_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_submission_files_owner_status
    ON submission_files (uploaded_by_user_id, storage_status, uploaded_at)
    WHERE storage_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS submission_status_history (
    id BIGSERIAL PRIMARY KEY,
    submission_id TEXT NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT submission_status_history_from_check
        CHECK (from_status IS NULL OR from_status IN ('draft', 'submitted', 'withdrawn')),
    CONSTRAINT submission_status_history_to_check
        CHECK (to_status IN ('draft', 'submitted', 'withdrawn'))
);

CREATE INDEX IF NOT EXISTS idx_submission_status_history_submission
    ON submission_status_history (submission_id, changed_at, id);

INSERT INTO bcl_schema_migrations (migration_key)
VALUES ('20260925_internship_phase_2b1')
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;
