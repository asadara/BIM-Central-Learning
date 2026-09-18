-- Run inside a transaction after reviewing the read-only preflight.
-- No user is merged, renumbered, reassigned, or given a new password/role.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.users ALTER COLUMN bim_level DROP NOT NULL;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_bim_level_check;
ALTER TABLE public.users ADD CONSTRAINT users_bim_level_check
    CHECK (bim_level IS NULL OR bim_level IN ('BIM Modeller', 'BIM Coordinator', 'BIM Specialist', 'BIM Manager'));

CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_key ON public.users (lower(btrim(email)));
CREATE UNIQUE INDEX IF NOT EXISTS users_username_normalized_key ON public.users (lower(btrim(username)));

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.users'::regclass AND conname='users_password_bcrypt_check') THEN
        ALTER TABLE public.users ADD CONSTRAINT users_password_bcrypt_check
            CHECK (password ~ '^\$2[ab]\$(0[4-9]|[12][0-9]|3[01])\$[./A-Za-z0-9]{53}$') NOT VALID;
    END IF;
END $$;
ALTER TABLE public.users VALIDATE CONSTRAINT users_password_bcrypt_check;

CREATE OR REPLACE FUNCTION public.bcl_preserve_canonical_user_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Canonical users.id is immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bcl_users_immutable_id ON public.users;
CREATE TRIGGER bcl_users_immutable_id BEFORE UPDATE OF id ON public.users
FOR EACH ROW EXECUTE FUNCTION public.bcl_preserve_canonical_user_id();

CREATE TABLE IF NOT EXISTS public.bcl_schema_migrations (
    migration_key TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO public.bcl_schema_migrations(migration_key) VALUES ('20260917_p0_1_security_identity')
ON CONFLICT (migration_key) DO NOTHING;
