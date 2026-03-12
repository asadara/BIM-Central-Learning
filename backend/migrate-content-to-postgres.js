/**
 * Migration Script: Migrate JSON data to PostgreSQL
 * This script migrates learning-materials.json and bim-media.json to PostgreSQL database
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { createPgConfig } = require('./config/runtimeConfig');

// PostgreSQL connection configuration
const dbConfig = createPgConfig({
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

const pool = new Pool(dbConfig);

// File paths
const LEARNING_MATERIALS_FILE = path.join(__dirname, 'learning-materials.json');
const BIM_MEDIA_FILE = path.join(__dirname, 'bim-media.json');

async function migrateLearningMaterials() {
    console.log('📚 Migrating Learning Materials to PostgreSQL...');

    try {
        // Read JSON data
        if (!fs.existsSync(LEARNING_MATERIALS_FILE)) {
            console.log('⚠️ Learning materials JSON file not found, skipping...');
            return;
        }

        const materialsData = JSON.parse(fs.readFileSync(LEARNING_MATERIALS_FILE, 'utf8'));
        const materials = materialsData.materials || [];

        console.log(`📊 Found ${materials.length} learning materials to migrate`);

        // Clear existing data
        await pool.query('DELETE FROM learning_materials');

        // Insert new data
        for (const material of materials) {
            const query = `
                INSERT INTO learning_materials (
                    id, title, category, level, description, page_count, language,
                    file_path, size, display_on_courses, is_active, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    category = EXCLUDED.category,
                    level = EXCLUDED.level,
                    description = EXCLUDED.description,
                    page_count = EXCLUDED.page_count,
                    language = EXCLUDED.language,
                    file_path = EXCLUDED.file_path,
                    size = EXCLUDED.size,
                    display_on_courses = EXCLUDED.display_on_courses,
                    updated_at = EXCLUDED.updated_at
            `;

            await pool.query(query, [
                material.id,
                material.title,
                material.category,
                material.level,
                material.description,
                material.page_count || material.pageCount || 0,
                material.language,
                material.file_path || material.filePath || '',
                material.size || 0,
                material.display_on_courses !== undefined ? material.display_on_courses : true,
                true, // is_active
                material.created_at || new Date().toISOString(),
                material.updated_at || new Date().toISOString()
            ]);
        }

        console.log('✅ Learning materials migration completed successfully');

    } catch (error) {
        console.error('❌ Error migrating learning materials:', error);
        throw error;
    }
}

async function migrateBIMMedia() {
    console.log('🏗️ Migrating BIM Media to PostgreSQL...');

    try {
        // Read JSON data
        if (!fs.existsSync(BIM_MEDIA_FILE)) {
            console.log('⚠️ BIM media JSON file not found, skipping...');
            return;
        }

        const mediaData = JSON.parse(fs.readFileSync(BIM_MEDIA_FILE, 'utf8'));
        const media = mediaData.media || [];

        console.log(`📊 Found ${media.length} BIM media files to migrate`);

        // Clear existing data
        await pool.query('DELETE FROM bim_media');
        await pool.query('DELETE FROM bim_media_tags');

        // Insert new data
        for (const item of media) {
            const query = `
                INSERT INTO bim_media (
                    id, name, path, type, size, source, year, location,
                    bim_dimension, project_type, description, tagged, excluded,
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    path = EXCLUDED.path,
                    type = EXCLUDED.type,
                    size = EXCLUDED.size,
                    source = EXCLUDED.source,
                    year = EXCLUDED.year,
                    location = EXCLUDED.location,
                    bim_dimension = EXCLUDED.bim_dimension,
                    project_type = EXCLUDED.project_type,
                    description = EXCLUDED.description,
                    tagged = EXCLUDED.tagged,
                    excluded = EXCLUDED.excluded,
                    updated_at = EXCLUDED.updated_at
            `;

            await pool.query(query, [
                item.id,
                item.name,
                item.path,
                item.type,
                item.size || 0,
                item.source,
                item.year,
                item.location,
                item.bimDimension || item.bim_dimension,
                item.projectType || item.project_type,
                item.description,
                item.tagged || false,
                item.excluded || false,
                item.created_at || new Date().toISOString(),
                item.updated_at || new Date().toISOString()
            ]);
        }

        // Migrate tags
        const tags = mediaData.tags || {};
        for (const [filePath, tagData] of Object.entries(tags)) {
            // Find the media item to get its ID
            const mediaItem = media.find(m => m.path === filePath);
            if (mediaItem) {
                const tagQuery = `
                    INSERT INTO bim_media_tags (media_id, tag_key, tag_value, created_at)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (media_id, tag_key) DO UPDATE SET
                        tag_value = EXCLUDED.tag_value
                `;

                // Convert tag data to key-value pairs
                const tagEntries = Object.entries(tagData).filter(([key]) =>
                    !['fileName', 'fileType', 'tagged', 'taggedAt', 'taggedBy'].includes(key)
                );

                for (const [key, value] of tagEntries) {
                    await pool.query(tagQuery, [
                        mediaItem.id,
                        key,
                        JSON.stringify(value),
                        tagData.taggedAt || new Date().toISOString()
                    ]);
                }
            }
        }

        console.log('✅ BIM media migration completed successfully');

    } catch (error) {
        console.error('❌ Error migrating BIM media:', error);
        throw error;
    }
}

async function runMigration() {
    console.log('🚀 Starting Content Migration to PostgreSQL...');
    console.log('=====================================');

    try {
        // Test database connection
        console.log('🔍 Testing database connection...');
        const client = await pool.connect();
        console.log('✅ Database connection successful');
        client.release();

        // Run migrations
        await migrateLearningMaterials();
        await migrateBIMMedia();

        console.log('🎉 All migrations completed successfully!');
        console.log('=====================================');
        console.log('📝 Note: JSON files are kept as backup');
        console.log('🗑️  You can safely delete the JSON files after verifying the migration');

    } catch (error) {
        console.error('💥 Migration failed:', error);
        console.log('=====================================');
        console.log('🔧 Troubleshooting:');
        console.log('1. Ensure PostgreSQL is running');
        console.log('2. Check database credentials in environment variables');
        console.log('3. Run the SQL script in create-tables.sql first');
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run migration if this script is executed directly
if (require.main === module) {
    runMigration();
}

module.exports = {
    migrateLearningMaterials,
    migrateBIMMedia,
    runMigration
};
