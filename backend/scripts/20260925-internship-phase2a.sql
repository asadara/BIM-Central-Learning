BEGIN;

SELECT pg_advisory_xact_lock(hashtext('bcl_internship_phase_2a'));

DO $$
BEGIN
    IF to_regclass(current_schema() || '.classwork_items') IS NULL
       OR to_regclass(current_schema() || '.batch_topics') IS NULL THEN
        RAISE EXCEPTION 'Training classwork schema must exist before Internship Phase 2A';
    END IF;
    IF to_regclass(current_schema() || '.internship_batch_config') IS NULL
       OR to_regclass(current_schema() || '.learning_content_registry') IS NULL THEN
        RAISE EXCEPTION 'Internship Phase 1A and Unified Learning must be migrated before Phase 2A';
    END IF;
END $$;

ALTER TABLE classwork_items
    ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS required_deliverable TEXT,
    ADD COLUMN IF NOT EXISTS participant_visibility TEXT NOT NULL DEFAULT 'visible';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'classwork_items_participant_visibility_check'
    ) THEN
        ALTER TABLE classwork_items
            ADD CONSTRAINT classwork_items_participant_visibility_check
            CHECK (participant_visibility IN ('visible', 'hidden'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_classwork_items_participant_availability
    ON classwork_items (batch_id, participant_visibility, status, available_at, due_at);

CREATE TABLE IF NOT EXISTS classwork_content_links (
    id BIGSERIAL PRIMARY KEY,
    classwork_id TEXT NOT NULL REFERENCES classwork_items(id) ON DELETE CASCADE,
    content_id TEXT REFERENCES learning_content_registry(content_id) ON DELETE RESTRICT,
    quiz_id TEXT,
    relationship_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT classwork_content_links_relationship_check
        CHECK (relationship_type IN ('prerequisite', 'reference')),
    CONSTRAINT classwork_content_links_target_check
        CHECK ((content_id IS NOT NULL AND quiz_id IS NULL) OR (content_id IS NULL AND quiz_id IS NOT NULL)),
    CONSTRAINT classwork_content_links_quiz_id_check
        CHECK (quiz_id IS NULL OR quiz_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$'),
    UNIQUE (classwork_id, content_id, relationship_type),
    UNIQUE (classwork_id, quiz_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_classwork_content_links_classwork
    ON classwork_content_links (classwork_id, relationship_type);

CREATE INDEX IF NOT EXISTS idx_classwork_content_links_content
    ON classwork_content_links (content_id)
    WHERE content_id IS NOT NULL;

INSERT INTO bcl_schema_migrations (migration_key)
VALUES ('20260925_internship_phase_2a')
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;
