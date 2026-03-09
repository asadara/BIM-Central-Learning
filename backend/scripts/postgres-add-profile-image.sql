-- Add profile_image column to users table for profile photo persistence
ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS profile_image TEXT;
