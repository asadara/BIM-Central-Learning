-- Transactional rollback only before P0-2 is used. Never discard live provider/session evidence.
DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM bcl_provider_identities) OR EXISTS(SELECT 1 FROM bcl_auth_sessions)
       OR EXISTS(SELECT 1 FROM bcl_admin_sessions) OR EXISTS(SELECT 1 FROM bcl_google_link_requests)
       OR EXISTS(SELECT 1 FROM bcl_google_challenges) OR EXISTS(SELECT 1 FROM bcl_auth_events)
       OR EXISTS(SELECT 1 FROM bcl_auth_state WHERE version<>1 OR NOT local_password_enabled) THEN
        RAISE EXCEPTION 'P0-2 already used: retain identity/revocation evidence and perform forward recovery';
    END IF;
END $$;
DROP TRIGGER bcl_auth_security_change ON users;
DROP TRIGGER bcl_auth_user_insert ON users;
DROP FUNCTION bcl_auth_security_change();
DROP FUNCTION bcl_auth_user_insert();
DROP TABLE bcl_auth_events,bcl_google_link_requests,bcl_google_challenges,bcl_provider_identities,bcl_admin_sessions,bcl_auth_sessions,bcl_auth_state;
DELETE FROM bcl_schema_migrations WHERE migration_key='20260918_p0_2_auth';
