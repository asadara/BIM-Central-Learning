BEGIN;

SELECT pg_advisory_xact_lock(hashtext('bcl_unified_learning_phase_1'));
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS bcl_schema_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning_content_registry (
    content_id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL CHECK (source_type IN ('video', 'pdf', 'page')),
    source_id TEXT NOT NULL,
    source_locator TEXT,
    source_fingerprint TEXT,
    title_override TEXT,
    description_override TEXT,
    category_override TEXT,
    level_override TEXT,
    discipline_override TEXT,
    language_override TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'retired')),
    review_disposition TEXT NOT NULL DEFAULT 'needs_review'
        CHECK (review_disposition IN ('mapped', 'library_only', 'needs_review', 'retired')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_type, source_id)
);

CREATE TABLE IF NOT EXISTS learning_paths (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    level TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
    current_published_version_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning_path_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    learning_path_id TEXT NOT NULL REFERENCES learning_paths(id) ON DELETE RESTRICT,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    change_note TEXT,
    definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by TEXT,
    published_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    UNIQUE (learning_path_id, version_number)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'learning_paths_current_published_version_fk'
    ) THEN
        ALTER TABLE learning_paths
            ADD CONSTRAINT learning_paths_current_published_version_fk
            FOREIGN KEY (current_published_version_id)
            REFERENCES learning_path_versions(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS learning_path_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    path_version_id UUID NOT NULL REFERENCES learning_path_versions(id) ON DELETE CASCADE,
    stable_module_key TEXT NOT NULL,
    title TEXT NOT NULL,
    outcome TEXT,
    sequence_number INTEGER NOT NULL CHECK (sequence_number >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (path_version_id, stable_module_key),
    UNIQUE (path_version_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS content_equivalence_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    path_version_id UUID REFERENCES learning_path_versions(id) ON DELETE RESTRICT,
    group_key TEXT NOT NULL,
    title TEXT NOT NULL,
    completion_policy TEXT NOT NULL DEFAULT 'any_one'
        CHECK (completion_policy IN ('any_one', 'primary_only', 'all', 'ordered')),
    status TEXT NOT NULL DEFAULT 'candidate'
        CHECK (status IN ('candidate', 'approved', 'rejected', 'retired')),
    review_notes TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (group_key)
);

CREATE TABLE IF NOT EXISTS content_equivalence_members (
    group_id UUID NOT NULL REFERENCES content_equivalence_groups(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL REFERENCES learning_content_registry(content_id) ON DELETE RESTRICT,
    member_role TEXT NOT NULL DEFAULT 'alternate'
        CHECK (member_role IN ('primary', 'alternate', 'duplicate_candidate')),
    sequence_number INTEGER NOT NULL DEFAULT 0 CHECK (sequence_number >= 0),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, content_id)
);

CREATE TABLE IF NOT EXISTS module_content_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID NOT NULL REFERENCES learning_path_modules(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL REFERENCES learning_content_registry(content_id) ON DELETE RESTRICT,
    sequence_number INTEGER NOT NULL CHECK (sequence_number >= 0),
    requirement_type TEXT NOT NULL CHECK (requirement_type IN ('required', 'elective')),
    completion_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
    equivalence_group_id UUID REFERENCES content_equivalence_groups(id) ON DELETE SET NULL,
    mapping_status TEXT NOT NULL DEFAULT 'candidate'
        CHECK (mapping_status IN ('candidate', 'approved', 'rejected', 'needs_review', 'retired')),
    review_notes TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (module_id, content_id),
    UNIQUE (module_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS user_content_progress (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL REFERENCES learning_content_registry(content_id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'in_progress', 'completed')),
    progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0
        CHECK (progress_percent >= 0 AND progress_percent <= 100),
    last_position_seconds NUMERIC(12,3),
    duration_seconds NUMERIC(12,3),
    first_opened_at TIMESTAMPTZ,
    last_opened_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,
    completion_source TEXT NOT NULL DEFAULT 'unified'
        CHECK (completion_source IN ('unified', 'legacy', 'imported')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, content_id)
);

CREATE INDEX IF NOT EXISTS learning_content_registry_type_status_idx
    ON learning_content_registry (source_type, status);
CREATE INDEX IF NOT EXISTS learning_content_registry_disposition_idx
    ON learning_content_registry (review_disposition);
CREATE INDEX IF NOT EXISTS learning_path_versions_path_status_idx
    ON learning_path_versions (learning_path_id, status);
CREATE INDEX IF NOT EXISTS learning_path_modules_version_order_idx
    ON learning_path_modules (path_version_id, sequence_number);
CREATE INDEX IF NOT EXISTS equivalence_groups_version_status_idx
    ON content_equivalence_groups (path_version_id, status);
CREATE INDEX IF NOT EXISTS equivalence_members_content_idx
    ON content_equivalence_members (content_id);
CREATE INDEX IF NOT EXISTS module_content_mappings_content_idx
    ON module_content_mappings (content_id);
CREATE INDEX IF NOT EXISTS module_content_mappings_module_status_idx
    ON module_content_mappings (module_id, mapping_status, sequence_number);
CREATE INDEX IF NOT EXISTS module_content_mappings_equivalence_idx
    ON module_content_mappings (equivalence_group_id);
CREATE INDEX IF NOT EXISTS user_content_progress_content_idx
    ON user_content_progress (content_id);
CREATE INDEX IF NOT EXISTS user_content_progress_status_idx
    ON user_content_progress (user_id, status, last_activity_at);

INSERT INTO bcl_schema_migrations (migration_key)
VALUES ('20260715_unified_learning_phase_1')
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;
