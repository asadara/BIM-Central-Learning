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

async function createVideoTables() {
    console.log('🛠️ Creating video tagging tables in PostgreSQL...');

    try {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');
            console.log('🔄 Starting database transaction...');

            // Create video_tags table
            console.log('📹 Creating video_tags table...');
            await client.query(`
                CREATE TABLE IF NOT EXISTS video_tags (
                    id SERIAL PRIMARY KEY,
                    video_id VARCHAR(255) NOT NULL UNIQUE,
                    category VARCHAR(100) NOT NULL DEFAULT 'general',
                    bim_level VARCHAR(50) NOT NULL DEFAULT 'beginner',
                    duration INTEGER DEFAULT 0,
                    language VARCHAR(10) DEFAULT 'id',
                    description TEXT,
                    tags TEXT[] DEFAULT '{}',
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create video_categories table
            console.log('🏷️ Creating video_categories table...');
            await client.query(`
                CREATE TABLE IF NOT EXISTS video_categories (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    value VARCHAR(100) NOT NULL UNIQUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create indexes
            console.log('🔍 Creating indexes...');
            await client.query('CREATE INDEX IF NOT EXISTS idx_video_tags_video_id ON video_tags(video_id)');
            await client.query('CREATE INDEX IF NOT EXISTS idx_video_tags_category ON video_tags(category)');
            await client.query('CREATE INDEX IF NOT EXISTS idx_video_tags_bim_level ON video_tags(bim_level)');
            await client.query('CREATE INDEX IF NOT EXISTS idx_video_categories_value ON video_categories(value)');

            await client.query('COMMIT');
            console.log('✅ Database transaction committed');

            console.log('🎉 Video tagging tables created successfully!');
            console.log('📊 Tables created:');
            console.log('   • video_tags');
            console.log('   • video_categories');
            console.log('🔍 Indexes created: 4 indexes');

        } catch (dbError) {
            await client.query('ROLLBACK');
            console.error('❌ Database transaction failed, rolled back:', dbError.message);
            throw dbError;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Failed to create video tables:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    console.log('🎯 Video Tables Creation Script');
    console.log('===============================');
    console.log(`Target database: ${dbConfig.database}`);
    console.log(`Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log('');

    createVideoTables()
        .then(() => {
            console.log('✅ Video tables creation completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Video tables creation failed:', error);
            process.exit(1);
        });
}

module.exports = { createVideoTables };
