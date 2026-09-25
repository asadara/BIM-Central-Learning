BEGIN;

SELECT pg_advisory_xact_lock(hashtext('bcl_internship_phase_1a'));

DO $$
BEGIN
    IF to_regclass(current_schema() || '.training_batches') IS NULL THEN
        RAISE EXCEPTION 'training_batches must exist before the Internship Phase 1A migration';
    END IF;
    IF to_regclass(current_schema() || '.learning_path_versions') IS NULL
       OR to_regclass(current_schema() || '.module_content_mappings') IS NULL
       OR to_regclass(current_schema() || '.learning_content_registry') IS NULL THEN
        RAISE EXCEPTION 'Unified Learning schema must be migrated before Internship Phase 1A';
    END IF;
END $$;

ALTER TABLE training_batches
    ADD COLUMN IF NOT EXISTS program_type TEXT NOT NULL DEFAULT 'training';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'training_batches_program_type_check'
    ) THEN
        ALTER TABLE training_batches
            ADD CONSTRAINT training_batches_program_type_check
            CHECK (program_type IN ('training', 'internship'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_training_batches_program_type
    ON training_batches (program_type, status);

CREATE TABLE IF NOT EXISTS internship_batch_config (
    batch_id TEXT PRIMARY KEY REFERENCES training_batches(id) ON DELETE CASCADE,
    learning_path_version_id UUID NOT NULL REFERENCES learning_path_versions(id) ON DELETE RESTRICT,
    policy_json JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(policy_json) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS internship_batch_config_path_version_idx
    ON internship_batch_config (learning_path_version_id);

CREATE OR REPLACE FUNCTION validate_internship_batch_config()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    selected_program_type TEXT;
    selected_version_status TEXT;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.learning_path_version_id IS DISTINCT FROM OLD.learning_path_version_id THEN
        RAISE EXCEPTION 'An Internship batch learning path version is immutable';
    END IF;

    SELECT program_type INTO selected_program_type
    FROM training_batches
    WHERE id = NEW.batch_id;

    IF selected_program_type IS DISTINCT FROM 'internship' THEN
        RAISE EXCEPTION 'Internship config requires training_batches.program_type=internship';
    END IF;

    SELECT status INTO selected_version_status
    FROM learning_path_versions
    WHERE id = NEW.learning_path_version_id;

    IF selected_version_status IS DISTINCT FROM 'published' THEN
        RAISE EXCEPTION 'Internship config requires a published learning path version';
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS internship_batch_config_validate_trigger ON internship_batch_config;
CREATE TRIGGER internship_batch_config_validate_trigger
    BEFORE INSERT OR UPDATE ON internship_batch_config
    FOR EACH ROW EXECUTE FUNCTION validate_internship_batch_config();

CREATE OR REPLACE FUNCTION protect_internship_batch_program_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.program_type = 'internship'
       AND NEW.program_type <> 'internship'
       AND EXISTS (SELECT 1 FROM internship_batch_config WHERE batch_id = OLD.id) THEN
        RAISE EXCEPTION 'Remove the Internship batch config before changing program_type';
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS training_batches_protect_internship_type_trigger ON training_batches;
CREATE TRIGGER training_batches_protect_internship_type_trigger
    BEFORE UPDATE OF program_type ON training_batches
    FOR EACH ROW EXECUTE FUNCTION protect_internship_batch_program_type();

-- Pilot freeze: existing BIM Mindset page, referenced rather than copied.
INSERT INTO learning_content_registry (
    content_id, source_type, source_id, source_locator, title_override,
    status, review_disposition, metadata
) VALUES (
    'page:bim-mindset', 'page', 'bim-mindset', '/pages/bim-mindset.html', 'Konsep BIM Mindset',
    'active', 'mapped', '{"source":"existing-bcl-page","pilot":"internship-phase-1a"}'::jsonb
)
ON CONFLICT (content_id) DO NOTHING;

DO $$
DECLARE
    registry_type TEXT;
    registry_source_id TEXT;
BEGIN
    SELECT source_type, source_id INTO registry_type, registry_source_id
    FROM learning_content_registry
    WHERE content_id = 'page:bim-mindset';

    IF registry_type IS DISTINCT FROM 'page' OR registry_source_id IS DISTINCT FROM 'bim-mindset' THEN
        RAISE EXCEPTION 'Canonical content page:bim-mindset conflicts with the approved pilot identity';
    END IF;
END $$;

INSERT INTO learning_paths (id, title, level, description, status, metadata)
VALUES (
    'bim-mindset-foundation',
    'BIM Mindset Foundation',
    'BIM Modeller',
    'Jalur dasar untuk memahami BIM sebagai sistem manajemen informasi.',
    'active',
    '{"source":"backend/elearning/learning-paths.json","pilot":"internship-phase-1a"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO learning_path_versions (
    id, learning_path_id, version_number, status, change_note, definition,
    created_by, published_by, published_at
) VALUES (
    '6a6d1f8a-67cf-4dcb-b4e9-c4a2be0f1a01'::uuid,
    'bim-mindset-foundation',
    1,
    'published',
    'Frozen Internship Phase 1A pilot; references existing BCL content only.',
    '{
        "contractVersion":"internship-learning-path-v1",
        "sourcePathId":"bim-mindset-foundation",
        "sourceRevision":"b298380",
        "assessments":[]
    }'::jsonb,
    'migration:20260924_internship_phase_1a',
    'migration:20260924_internship_phase_1a',
    NOW()
)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
    conflicting_version UUID;
BEGIN
    SELECT id INTO conflicting_version
    FROM learning_path_versions
    WHERE learning_path_id = 'bim-mindset-foundation'
      AND version_number = 1;

    IF conflicting_version IS DISTINCT FROM '6a6d1f8a-67cf-4dcb-b4e9-c4a2be0f1a01'::uuid THEN
        RAISE EXCEPTION 'BIM Mindset version 1 already exists with a different identity: %', conflicting_version;
    END IF;
END $$;

INSERT INTO learning_path_modules (
    id, path_version_id, stable_module_key, title, outcome,
    sequence_number, status, definition
) VALUES (
    '6a6d1f8a-67cf-4dcb-b4e9-c4a2be0f1a02'::uuid,
    '6a6d1f8a-67cf-4dcb-b4e9-c4a2be0f1a01'::uuid,
    'bim-mindset-information-management',
    'BIM sebagai Manajemen Informasi',
    'Peserta memahami status, versi, sumber resmi, dan tujuan penggunaan informasi.',
    1,
    'active',
    '{"sourceModuleKey":"bim-mindset-information-management"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO module_content_mappings (
    id, module_id, content_id, sequence_number, requirement_type,
    completion_rule, mapping_status, review_notes, reviewed_by, reviewed_at
) VALUES (
    '6a6d1f8a-67cf-4dcb-b4e9-c4a2be0f1a03'::uuid,
    '6a6d1f8a-67cf-4dcb-b4e9-c4a2be0f1a02'::uuid,
    'page:bim-mindset',
    1,
    'required',
    '{"activity":{"moduleType":"page","moduleIds":["bim-mindset__bim-mindset"]}}'::jsonb,
    'approved',
    'Maps the existing page completion activity key to its canonical content identity.',
    'migration:20260924_internship_phase_1a',
    NOW()
)
ON CONFLICT (id) DO NOTHING;

UPDATE learning_paths
SET current_published_version_id = COALESCE(
        current_published_version_id,
        '6a6d1f8a-67cf-4dcb-b4e9-c4a2be0f1a01'::uuid
    ),
    updated_at = NOW()
WHERE id = 'bim-mindset-foundation';

INSERT INTO bcl_schema_migrations (migration_key)
VALUES ('20260924_internship_phase_1a')
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;
