-- Add mapping_kompetensi_access flag to users table (PostgreSQL)
ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS mapping_kompetensi_access BOOLEAN DEFAULT FALSE;

-- Normalize NULLs (if any) to false
UPDATE users
SET mapping_kompetensi_access = FALSE
WHERE mapping_kompetensi_access IS NULL;
