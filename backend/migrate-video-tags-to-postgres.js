const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// PostgreSQL connection configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'bcl_database',
    user: process.env.DB_USER || 'bcl_user',
    password: process.env.DB_PASSWORD || 'secure_password_2025',
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
};

const pool = new Pool(dbConfig);

// Source file
const VIDEO_TAGS_FILE = path.join(__dirname, 'video-tags.json');

async function migrateVideoTagsToPostgres() {
    console.log('🚀 Starting video tags migration to PostgreSQL...');

    try {
        // Check if source file exists
        if (!fs.existsSync(VIDEO_TAGS_FILE)) {
            console.error('❌ Source file not found:', VIDEO_TAGS_FILE);
            return;
        }

        // Read video tags data
        console.log('📖 Reading video tags data...');
        const data = JSON.parse(fs.readFileSync(VIDEO_TAGS_FILE, 'utf-8'));

        if (!data.videoTags || Object.keys(data.videoTags).length === 0) {
            console.log('ℹ️ No video tags found to migrate');
            return;
        }

        console.log(`📊 Found ${Object.keys(data.videoTags).length} video tags to migrate`);
        console.log(`🏷️ Found ${data.customCategories?.length || 0} custom categories to migrate`);

        const client = await pool.connect();

        try {
            await client.query('BEGIN');
            console.log('🔄 Starting database transaction...');

            let migratedVideos = 0;
            let migratedCategories = 0;

            // Migrate video tags
            console.log('🎬 Migrating video tags...');
            for (const [videoId, tagData] of Object.entries(data.videoTags)) {
                try {
                    console.log(`  📹 Migrating video: ${videoId.substring(0, 50)}...`);

                    const insertQuery = `
                        INSERT INTO video_tags (video_id, category, bim_level, duration, language, description, tags, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        ON CONFLICT (video_id)
                        DO UPDATE SET
                            category = EXCLUDED.category,
                            bim_level = EXCLUDED.bim_level,
                            duration = EXCLUDED.duration,
                            language = EXCLUDED.language,
                            description = EXCLUDED.description,
                            tags = EXCLUDED.tags,
                            updated_at = EXCLUDED.updated_at
                        RETURNING id
                    `;

                    const result = await client.query(insertQuery, [
                        tagData.videoId || videoId,
                        tagData.category || 'general',
                        tagData.bimLevel || 'beginner',
                        tagData.duration || 0,
                        tagData.language || 'id',
                        tagData.description || '',
                        tagData.tags || [],
                        tagData.updated_at || new Date().toISOString()
                    ]);

                    migratedVideos++;
                    console.log(`  ✅ Migrated video: ${videoId.substring(0, 30)}... (ID: ${result.rows[0].id})`);

                } catch (videoError) {
                    console.error(`  ❌ Failed to migrate video ${videoId}:`, videoError.message);
                    // Continue with next video
                }
            }

            // Migrate custom categories
            console.log('🏷️ Migrating custom categories...');
            if (data.customCategories && data.customCategories.length > 0) {
                for (const category of data.customCategories) {
                    try {
                        console.log(`  🏷️ Migrating category: ${category.name} (${category.value})`);

                        const insertQuery = `
                            INSERT INTO video_categories (name, value, created_at)
                            VALUES ($1, $2, $3)
                            ON CONFLICT (value)
                            DO NOTHING
                            RETURNING id
                        `;

                        const result = await client.query(insertQuery, [
                            category.name,
                            category.value,
                            category.created_at || new Date().toISOString()
                        ]);

                        if (result.rows.length > 0) {
                            migratedCategories++;
                            console.log(`  ✅ Migrated category: ${category.name} (ID: ${result.rows[0].id})`);
                        } else {
                            console.log(`  ⏭️ Category already exists: ${category.name}`);
                        }

                    } catch (categoryError) {
                        console.error(`  ❌ Failed to migrate category ${category.name}:`, categoryError.message);
                        // Continue with next category
                    }
                }
            }

            await client.query('COMMIT');
            console.log('✅ Database transaction committed');

            // Summary
            console.log('\n🎉 Migration completed successfully!');
            console.log('📊 Migration Summary:');
            console.log(`   📹 Videos migrated: ${migratedVideos}`);
            console.log(`   🏷️ Categories migrated: ${migratedCategories}`);
            console.log(`   📅 Migration completed at: ${new Date().toISOString()}`);

            // Update metadata in source file
            data.metadata.lastMigratedToPostgres = new Date().toISOString();
            data.metadata.postgresMigrationSummary = {
                videosMigrated: migratedVideos,
                categoriesMigrated: migratedCategories,
                migrationTimestamp: new Date().toISOString()
            };

            fs.writeFileSync(VIDEO_TAGS_FILE, JSON.stringify(data, null, 2));
            console.log('💾 Migration metadata updated in source file');

        } catch (dbError) {
            await client.query('ROLLBACK');
            console.error('❌ Database transaction failed, rolled back:', dbError.message);
            throw dbError;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migration if called directly
if (require.main === module) {
    console.log('🎯 Video Tags Migration Script');
    console.log('==============================');
    console.log(`Source file: ${VIDEO_TAGS_FILE}`);
    console.log(`Target database: ${dbConfig.database}`);
    console.log('');

    migrateVideoTagsToPostgres()
        .then(() => {
            console.log('✅ Migration script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateVideoTagsToPostgres };
