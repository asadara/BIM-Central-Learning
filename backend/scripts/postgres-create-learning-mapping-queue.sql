BEGIN;

SELECT pg_advisory_xact_lock(hashtext('bcl_learning_mapping_queue_phase_2'));

CREATE TABLE IF NOT EXISTS learning_mapping_review_queue (
    content_id TEXT PRIMARY KEY REFERENCES learning_content_registry(content_id) ON DELETE RESTRICT,
    decision TEXT NOT NULL
        CHECK (decision IN ('required', 'elective', 'library_only', 'alternate', 'needs_review', 'retired')),
    target_path_id TEXT,
    target_module_key TEXT,
    requirement_type TEXT
        CHECK (requirement_type IS NULL OR requirement_type IN ('required', 'elective')),
    proposed_sequence INTEGER CHECK (proposed_sequence IS NULL OR proposed_sequence >= 0),
    review_status TEXT NOT NULL DEFAULT 'candidate'
        CHECK (review_status IN ('candidate', 'needs_review', 'approved', 'rejected', 'retired')),
    review_notes TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    candidate_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (decision = 'required' AND requirement_type = 'required') OR
        (decision = 'elective' AND requirement_type = 'elective') OR
        (decision NOT IN ('required', 'elective') AND requirement_type IS NULL)
    ),
    CHECK (
        decision NOT IN ('required', 'elective', 'alternate') OR
        (NULLIF(BTRIM(target_path_id), '') IS NOT NULL AND NULLIF(BTRIM(target_module_key), '') IS NOT NULL)
    ),
    CHECK (review_status <> 'approved' OR decision <> 'needs_review')
);

CREATE TABLE IF NOT EXISTS learning_mapping_review_events (
    id BIGSERIAL PRIMARY KEY,
    content_id TEXT NOT NULL REFERENCES learning_content_registry(content_id) ON DELETE RESTRICT,
    action TEXT NOT NULL CHECK (action IN ('seeded', 'updated', 'approved', 'rejected', 'retired', 'reopened')),
    actor_id TEXT NOT NULL,
    actor_label TEXT,
    before_state JSONB,
    after_state JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS learning_mapping_queue_status_idx
    ON learning_mapping_review_queue (review_status, decision, updated_at DESC);
CREATE INDEX IF NOT EXISTS learning_mapping_queue_path_idx
    ON learning_mapping_review_queue (target_path_id, target_module_key, proposed_sequence);
CREATE INDEX IF NOT EXISTS learning_mapping_events_content_idx
    ON learning_mapping_review_events (content_id, created_at DESC);
CREATE INDEX IF NOT EXISTS learning_mapping_events_actor_idx
    ON learning_mapping_review_events (actor_id, created_at DESC);

INSERT INTO bcl_schema_migrations (migration_key)
VALUES ('20260715_learning_mapping_queue_phase_2')
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;
