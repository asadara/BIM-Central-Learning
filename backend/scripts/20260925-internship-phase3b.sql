BEGIN;

SELECT pg_advisory_xact_lock(hashtext('bcl_internship_phase_3b'));

DO $$
BEGIN
    IF to_regclass(current_schema() || '.submission_reviews') IS NULL
       OR to_regclass(current_schema() || '.submission_review_history') IS NULL THEN
        RAISE EXCEPTION 'Internship Phase 3A must be migrated before Phase 3B';
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS submission_revisions (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
    revision_no INTEGER NOT NULL,
    parent_revision_id TEXT REFERENCES submission_revisions(id) ON DELETE RESTRICT,
    state TEXT NOT NULL,
    submitted_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT submission_revisions_number_check CHECK (revision_no > 0),
    CONSTRAINT submission_revisions_state_check CHECK (state IN ('draft', 'submitted', 'withdrawn')),
    CONSTRAINT submission_revisions_state_timestamps_check CHECK (
        (state = 'draft' AND submitted_at IS NULL AND withdrawn_at IS NULL)
        OR (state = 'submitted' AND submitted_at IS NOT NULL AND withdrawn_at IS NULL)
        OR (state = 'withdrawn' AND withdrawn_at IS NOT NULL)
    ),
    UNIQUE (submission_id, revision_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_submission_revisions_current
    ON submission_revisions (submission_id)
    WHERE is_current;

CREATE INDEX IF NOT EXISTS idx_submission_revisions_history
    ON submission_revisions (submission_id, revision_no DESC);

INSERT INTO submission_revisions (
    id, submission_id, revision_no, parent_revision_id, state,
    submitted_at, withdrawn_at, metadata, created_by_user_id,
    is_current, created_at, updated_at
)
SELECT
    s.id || ':r' || s.submission_revision::text,
    s.id,
    s.submission_revision,
    NULL,
    s.status,
    s.submitted_at,
    s.withdrawn_at,
    COALESCE(s.metadata, '{}'::jsonb),
    s.user_id,
    TRUE,
    s.created_at,
    s.updated_at
FROM assignment_submissions s
ON CONFLICT (submission_id, revision_no) DO NOTHING;

INSERT INTO bcl_schema_migrations (migration_key)
VALUES ('20260925_internship_phase_3b')
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;
