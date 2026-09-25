BEGIN;

SELECT pg_advisory_xact_lock(hashtext('bcl_internship_phase_3a'));

DO $$
BEGIN
    IF to_regclass(current_schema() || '.submission_reviews') IS NOT NULL
       AND EXISTS (SELECT 1 FROM submission_reviews) THEN
        RAISE EXCEPTION 'Phase 3A rollback requires review data export/removal in an approved maintenance window';
    END IF;
END $$;

DELETE FROM bcl_schema_migrations
WHERE migration_key = '20260925_internship_phase_3a';

DROP TABLE IF EXISTS submission_review_history;

DROP INDEX IF EXISTS idx_submission_files_revision;
DROP INDEX IF EXISTS idx_submission_reviews_reviewer_state;
DROP INDEX IF EXISTS uq_review_scores_review_criterion;
DROP INDEX IF EXISTS uq_review_scores_legacy_submission_criterion;

ALTER TABLE IF EXISTS submission_comments
    DROP CONSTRAINT IF EXISTS submission_comments_visibility_check,
    DROP CONSTRAINT IF EXISTS submission_comments_revision_check,
    DROP COLUMN IF EXISTS submission_revision,
    DROP COLUMN IF EXISTS review_id;

ALTER TABLE IF EXISTS review_scores
    DROP CONSTRAINT IF EXISTS review_scores_revision_check,
    DROP COLUMN IF EXISTS submission_revision,
    DROP COLUMN IF EXISTS review_id;

ALTER TABLE IF EXISTS review_scores
    ADD CONSTRAINT review_scores_submission_id_criterion_id_key
    UNIQUE (submission_id, criterion_id);

DROP TABLE IF EXISTS submission_reviews;

ALTER TABLE IF EXISTS review_criteria
    DROP CONSTRAINT IF EXISTS review_criteria_score_check,
    DROP COLUMN IF EXISTS required;

ALTER TABLE IF EXISTS submission_files
    DROP CONSTRAINT IF EXISTS submission_files_revision_check,
    DROP COLUMN IF EXISTS submission_revision;

ALTER TABLE IF EXISTS assignment_submissions
    DROP CONSTRAINT IF EXISTS assignment_submissions_revision_check,
    DROP COLUMN IF EXISTS submission_revision;

COMMIT;
