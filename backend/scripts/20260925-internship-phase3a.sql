BEGIN;

SELECT pg_advisory_xact_lock(hashtext('bcl_internship_phase_3a'));

DO $$
BEGIN
    IF to_regclass(current_schema() || '.assignment_submissions') IS NULL
       OR to_regclass(current_schema() || '.submission_files') IS NULL
       OR to_regclass(current_schema() || '.review_criteria') IS NULL
       OR to_regclass(current_schema() || '.review_scores') IS NULL
       OR to_regclass(current_schema() || '.submission_comments') IS NULL THEN
        RAISE EXCEPTION 'Generic Training review and submission schema must exist before Internship Phase 3A';
    END IF;
    IF to_regclass(current_schema() || '.submission_status_history') IS NULL THEN
        RAISE EXCEPTION 'Internship Phase 2B-1 must be migrated before Phase 3A';
    END IF;
END $$;

ALTER TABLE assignment_submissions
    ADD COLUMN IF NOT EXISTS submission_revision INTEGER NOT NULL DEFAULT 1;

ALTER TABLE submission_files
    ADD COLUMN IF NOT EXISTS submission_revision INTEGER NOT NULL DEFAULT 1;

ALTER TABLE review_criteria
    ADD COLUMN IF NOT EXISTS required BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assignment_submissions_revision_check') THEN
        ALTER TABLE assignment_submissions ADD CONSTRAINT assignment_submissions_revision_check
            CHECK (submission_revision > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submission_files_revision_check') THEN
        ALTER TABLE submission_files ADD CONSTRAINT submission_files_revision_check
            CHECK (submission_revision > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_criteria_score_check') THEN
        ALTER TABLE review_criteria ADD CONSTRAINT review_criteria_score_check
            CHECK (max_score > 0 AND weight >= 0);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS submission_reviews (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
    submission_revision INTEGER NOT NULL,
    state TEXT NOT NULL DEFAULT 'not_started',
    reviewer_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    started_at TIMESTAMPTZ,
    decision TEXT,
    decided_at TIMESTAMPTZ,
    participant_feedback TEXT NOT NULL DEFAULT '',
    internal_note TEXT NOT NULL DEFAULT '',
    review_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT submission_reviews_revision_check CHECK (submission_revision > 0),
    CONSTRAINT submission_reviews_state_check
        CHECK (state IN ('not_started', 'under_review', 'revision_requested', 'accepted')),
    CONSTRAINT submission_reviews_decision_check
        CHECK (decision IS NULL OR decision IN ('revision_requested', 'accepted')),
    CONSTRAINT submission_reviews_version_check CHECK (review_version > 0),
    CONSTRAINT submission_reviews_state_decision_check CHECK (
        (state IN ('not_started', 'under_review') AND decision IS NULL AND decided_at IS NULL)
        OR (state IN ('revision_requested', 'accepted') AND decision = state AND decided_at IS NOT NULL)
    ),
    CONSTRAINT submission_reviews_started_check CHECK (
        state = 'not_started' OR (reviewer_user_id IS NOT NULL AND started_at IS NOT NULL)
    ),
    UNIQUE (submission_id, submission_revision)
);

ALTER TABLE review_scores
    ADD COLUMN IF NOT EXISTS review_id TEXT REFERENCES submission_reviews(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS submission_revision INTEGER NOT NULL DEFAULT 1;

ALTER TABLE submission_comments
    ADD COLUMN IF NOT EXISTS review_id TEXT REFERENCES submission_reviews(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS submission_revision INTEGER NOT NULL DEFAULT 1;

ALTER TABLE review_scores
    DROP CONSTRAINT IF EXISTS review_scores_submission_id_criterion_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_review_scores_review_criterion
    ON review_scores (review_id, criterion_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_review_scores_legacy_submission_criterion
    ON review_scores (submission_id, criterion_id)
    WHERE review_id IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_scores_revision_check') THEN
        ALTER TABLE review_scores ADD CONSTRAINT review_scores_revision_check
            CHECK (submission_revision > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submission_comments_revision_check') THEN
        ALTER TABLE submission_comments ADD CONSTRAINT submission_comments_revision_check
            CHECK (submission_revision > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submission_comments_visibility_check') THEN
        ALTER TABLE submission_comments ADD CONSTRAINT submission_comments_visibility_check
            CHECK (visibility IN ('participant', 'internal'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS submission_review_history (
    id BIGSERIAL PRIMARY KEY,
    review_id TEXT NOT NULL REFERENCES submission_reviews(id) ON DELETE CASCADE,
    submission_id TEXT NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
    submission_revision INTEGER NOT NULL,
    from_state TEXT NOT NULL,
    to_state TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    review_version INTEGER NOT NULL,
    change_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT submission_review_history_revision_check CHECK (submission_revision > 0),
    CONSTRAINT submission_review_history_state_check CHECK (
        from_state IN ('not_started', 'under_review', 'revision_requested', 'accepted')
        AND to_state IN ('not_started', 'under_review', 'revision_requested', 'accepted')
    ),
    CONSTRAINT submission_review_history_action_check CHECK (action IN ('started', 'updated', 'decision')),
    CONSTRAINT submission_review_history_version_check CHECK (review_version > 0)
);

CREATE INDEX IF NOT EXISTS idx_submission_reviews_reviewer_state
    ON submission_reviews (reviewer_user_id, state, updated_at);

CREATE INDEX IF NOT EXISTS idx_submission_review_history_review
    ON submission_review_history (review_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_submission_files_revision
    ON submission_files (submission_id, submission_revision, uploaded_at)
    WHERE removed_at IS NULL;

INSERT INTO bcl_schema_migrations (migration_key)
VALUES ('20260925_internship_phase_3a')
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;
