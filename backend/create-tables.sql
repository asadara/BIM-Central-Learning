-- =====================================================
-- BCL PostgreSQL Database Tables (Primary)
-- This schema is PostgreSQL-only. MySQL artifacts were removed.
-- =====================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- USERS
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    bim_level VARCHAR(50) DEFAULT 'BIM Modeller',
    job_role VARCHAR(100),
    organization VARCHAR(255),
    registration_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    login_count INTEGER DEFAULT 0,
    last_login TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    email_verified BOOLEAN DEFAULT false,
    profile_image TEXT,
    preferences JSONB DEFAULT '{"theme":"light","notifications":true,"language":"id"}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    progress JSONB DEFAULT '{}'::jsonb,
    mapping_kompetensi_access BOOLEAN DEFAULT false,
    library_download_access BOOLEAN DEFAULT false,
    watermark_free_download_access BOOLEAN DEFAULT false
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS mapping_kompetensi_access BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS library_download_access BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS watermark_free_download_access BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS access_requests (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    source_page TEXT,
    subject TEXT,
    message TEXT,
    requester_user_id TEXT,
    requester_username TEXT,
    requester_email TEXT,
    contact_name TEXT,
    contact_email TEXT,
    admin_note TEXT,
    resolution_applied BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by TEXT,
    reviewed_at TIMESTAMP
);

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_bim_level ON users(bim_level);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- =====================================================
-- USER PROGRESS
-- =====================================================
CREATE TABLE IF NOT EXISTS user_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    courses_completed INTEGER DEFAULT 0,
    practice_attempts INTEGER DEFAULT 0,
    exams_passed INTEGER DEFAULT 0,
    certificates_earned INTEGER DEFAULT 0,
    current_level VARCHAR(50),
    to_next_level INTEGER DEFAULT 0,
    competency_score NUMERIC(10,2) DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

DROP TRIGGER IF EXISTS user_progress_set_updated_at ON user_progress;
CREATE TRIGGER user_progress_set_updated_at
BEFORE UPDATE ON user_progress
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_current_level ON user_progress(current_level);

-- =====================================================
-- LEARNING ATTEMPTS
-- Unified attempt store for practice, exam, and quiz-record dashboard.
-- =====================================================
CREATE TABLE IF NOT EXISTS learning_attempts (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_identifier TEXT NOT NULL,
    user_name TEXT,
    user_email TEXT,
    quiz_id TEXT NOT NULL,
    quiz_name TEXT,
    quiz_category TEXT,
    source_type TEXT DEFAULT 'quiz',
    score INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    percentage INTEGER DEFAULT 0,
    passed BOOLEAN DEFAULT false,
    answers JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    time_taken INTEGER DEFAULT 0,
    submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_learning_attempts_user_id ON learning_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_attempts_user_identifier ON learning_attempts(user_identifier);
CREATE INDEX IF NOT EXISTS idx_learning_attempts_source_type ON learning_attempts(source_type);
CREATE INDEX IF NOT EXISTS idx_learning_attempts_submitted_at ON learning_attempts(submitted_at DESC);

-- =====================================================
-- USER CERTIFICATES
-- Auto-issued from passed exam attempts and can be issued manually.
-- =====================================================
CREATE TABLE IF NOT EXISTS user_certificates (
    id TEXT PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_identifier TEXT NOT NULL,
    user_name TEXT,
    user_email TEXT,
    quiz_id TEXT,
    module_id TEXT,
    title TEXT NOT NULL,
    issuer TEXT DEFAULT 'BC Learning Academy',
    score INTEGER DEFAULT 0,
    certificate_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    issued_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_identifier, quiz_id)
);

CREATE INDEX IF NOT EXISTS idx_user_certificates_user_id ON user_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_user_certificates_user_identifier ON user_certificates(user_identifier);
CREATE INDEX IF NOT EXISTS idx_user_certificates_issued_at ON user_certificates(issued_at DESC);

-- =====================================================
-- USER SESSIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- =====================================================
-- COURSE CATEGORIES
-- =====================================================
CREATE TABLE IF NOT EXISTS course_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'fas fa-graduation-cap',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS course_categories_set_updated_at ON course_categories;
CREATE TRIGGER course_categories_set_updated_at
BEFORE UPDATE ON course_categories
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

INSERT INTO course_categories (name, description, icon)
VALUES
    ('AutoCAD', 'Computer-aided drafting and design software', 'fas fa-drafting-compass'),
    ('Revit BIM', 'Building Information Modeling software', 'fas fa-building'),
    ('Civil 3D', 'Civil engineering design and documentation', 'fas fa-road'),
    ('SketchUp', '3D modeling software', 'fas fa-cube'),
    ('Lumion', '3D rendering and visualization', 'fas fa-lightbulb')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- LEARNING MATERIALS
-- =====================================================
CREATE TABLE IF NOT EXISTS learning_materials (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    level VARCHAR(50) DEFAULT 'beginner',
    description TEXT,
    page_count INTEGER DEFAULT 0,
    language VARCHAR(10) DEFAULT 'id',
    file_path VARCHAR(500),
    size BIGINT DEFAULT 0,
    display_on_courses BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS learning_materials_set_updated_at ON learning_materials;
CREATE TRIGGER learning_materials_set_updated_at
BEFORE UPDATE ON learning_materials
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PDF MATERIAL READ EVENTS
-- Counts every open/read action, including repeated opens by same user.
-- =====================================================
CREATE TABLE IF NOT EXISTS pdf_material_reads (
    id BIGSERIAL PRIMARY KEY,
    material_id TEXT NOT NULL,
    user_id TEXT,
    user_email TEXT,
    source TEXT DEFAULT 'courses',
    opened_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pdf_material_reads_material_id ON pdf_material_reads(material_id);
CREATE INDEX IF NOT EXISTS idx_pdf_material_reads_user_id ON pdf_material_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_material_reads_opened_at ON pdf_material_reads(opened_at);

-- =====================================================
-- BIM MEDIA
-- =====================================================
CREATE TABLE IF NOT EXISTS bim_media (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(500) NOT NULL,
    type VARCHAR(50) DEFAULT 'video',
    size BIGINT DEFAULT 0,
    source VARCHAR(100) DEFAULT 'PC-BIM02',
    year VARCHAR(4),
    location VARCHAR(100),
    bim_dimension VARCHAR(10),
    project_type VARCHAR(100),
    description TEXT,
    tagged BOOLEAN DEFAULT false,
    excluded BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS bim_media_set_updated_at ON bim_media;
CREATE TRIGGER bim_media_set_updated_at
BEFORE UPDATE ON bim_media
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS bim_media_tags (
    id SERIAL PRIMARY KEY,
    media_id INTEGER REFERENCES bim_media(id) ON DELETE CASCADE,
    tag_key VARCHAR(100) NOT NULL,
    tag_value TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(media_id, tag_key)
);

-- =====================================================
-- VIDEO TAGGING
-- =====================================================
CREATE TABLE IF NOT EXISTS video_tags (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    bim_level VARCHAR(50) NOT NULL DEFAULT 'beginner',
    duration INTEGER DEFAULT 0,
    language VARCHAR(10) DEFAULT 'id',
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS video_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    value VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PLUGINS
-- =====================================================
CREATE TABLE IF NOT EXISTS plugins (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    download TEXT,
    logo TEXT,
    file_name VARCHAR(255),
    file_path VARCHAR(500),
    file_size BIGINT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS plugins_set_updated_at ON plugins;
CREATE TRIGGER plugins_set_updated_at
BEFORE UPDATE ON plugins
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_learning_materials_category ON learning_materials(category);
CREATE INDEX IF NOT EXISTS idx_learning_materials_level ON learning_materials(level);
CREATE INDEX IF NOT EXISTS idx_learning_materials_display ON learning_materials(display_on_courses);
CREATE INDEX IF NOT EXISTS idx_bim_media_type ON bim_media(type);
CREATE INDEX IF NOT EXISTS idx_bim_media_year ON bim_media(year);
CREATE INDEX IF NOT EXISTS idx_bim_media_location ON bim_media(location);
CREATE INDEX IF NOT EXISTS idx_bim_media_tagged ON bim_media(tagged);
CREATE INDEX IF NOT EXISTS idx_bim_media_excluded ON bim_media(excluded);
CREATE INDEX IF NOT EXISTS idx_video_tags_video_id ON video_tags(video_id);
CREATE INDEX IF NOT EXISTS idx_video_tags_category ON video_tags(category);
CREATE INDEX IF NOT EXISTS idx_video_tags_bim_level ON video_tags(bim_level);
CREATE INDEX IF NOT EXISTS idx_video_categories_value ON video_categories(value);
CREATE INDEX IF NOT EXISTS idx_plugins_active ON plugins(is_active);
CREATE INDEX IF NOT EXISTS idx_plugins_name ON plugins(name);

COMMIT;
