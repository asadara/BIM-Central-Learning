-- Emergency rollback only, inside an explicit transaction and with writers paused.
-- This removes P0-1 database protections. Prefer forward recovery with secured source.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM public.users WHERE bim_level IS NULL OR bim_level NOT IN ('BIM Modeller','BIM Coordinator','BIM Manager')) THEN
        RAISE EXCEPTION 'Rollback blocked: users require the new level constraint; no automatic level reassignment is permitted';
    END IF;
END $$;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_bim_level_check;
ALTER TABLE public.users ADD CONSTRAINT users_bim_level_check
    CHECK (bim_level IN ('BIM Modeller','BIM Coordinator','BIM Manager'));
ALTER TABLE public.users ALTER COLUMN bim_level SET NOT NULL;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_password_bcrypt_check;
DROP INDEX IF EXISTS public.users_email_normalized_key;
DROP INDEX IF EXISTS public.users_username_normalized_key;
DROP TRIGGER IF EXISTS bcl_users_immutable_id ON public.users;
DROP FUNCTION IF EXISTS public.bcl_preserve_canonical_user_id();
DELETE FROM public.bcl_schema_migrations WHERE migration_key = '20260917_p0_1_security_identity';
