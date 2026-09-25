BEGIN;

SELECT pg_advisory_xact_lock(hashtext('bcl_internship_phase_3b'));

DO $$
BEGIN
    IF to_regclass(current_schema() || '.submission_revisions') IS NOT NULL
       AND EXISTS (SELECT 1 FROM submission_revisions WHERE revision_no > 1) THEN
        RAISE EXCEPTION 'Phase 3B rollback requires revision data export/removal in an approved maintenance window';
    END IF;
END $$;

DELETE FROM bcl_schema_migrations
WHERE migration_key = '20260925_internship_phase_3b';

DROP TABLE IF EXISTS submission_revisions;

COMMIT;
