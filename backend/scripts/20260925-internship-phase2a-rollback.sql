BEGIN;

SELECT pg_advisory_xact_lock(hashtext('bcl_internship_phase_2a'));

DELETE FROM bcl_schema_migrations
WHERE migration_key = '20260925_internship_phase_2a';

DROP TABLE IF EXISTS classwork_content_links;

DROP INDEX IF EXISTS idx_classwork_items_participant_availability;

ALTER TABLE IF EXISTS classwork_items
    DROP CONSTRAINT IF EXISTS classwork_items_participant_visibility_check,
    DROP COLUMN IF EXISTS participant_visibility,
    DROP COLUMN IF EXISTS required_deliverable,
    DROP COLUMN IF EXISTS available_at;

COMMIT;
