#!/usr/bin/env node

/**
 * Manual Migration Script: Import JSON Data to PostgreSQL
 * Imports data from JSON files directly into PostgreSQL (single-source mode).
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// PostgreSQL connection configuration
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'bcl_database',
    user: process.env.DB_USER || 'bcl_user',
    password: process.env.DB_PASSWORD,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

class ManualMigrator {
    constructor() {
        this.stats = {
            usersImported: 0,
            categoriesImported: 0,
            coursesImported: 0,
            materialsImported: 0,
            errors: []
        };
    }

    async connect() {
        console.log('🔌 Connecting to PostgreSQL...');
        try {
            await pool.query('SELECT 1');
            console.log('✅ Connected to PostgreSQL');
        } catch (error) {
            console.error('❌ PostgreSQL connection failed:', error.message);
            throw error;
        }
    }

    async disconnect() {
        console.log('🔌 Disconnecting from PostgreSQL...');
        await pool.end();
        console.log('✅ Disconnected from PostgreSQL');
    }

    async importUsers() {
        console.log('\n📥 Importing users from JSON...');

        try {
            const usersPath = path.join(__dirname, 'backend', 'users.json');
            if (!fs.existsSync(usersPath)) {
                console.log('⚠️ Users file not found, skipping...');
                return;
            }

            const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
            console.log(`📊 Found ${users.length} users to import`);

            for (const user of users) {
                try {
                    // Map JSON fields to PostgreSQL schema
                    const pgUser = {
                        username: user.username || user.id.replace('json_', ''),
                        email: user.email || `${user.username || user.id}@bcl.local`,
                        password: user.password,
                        bim_level: user.bimLevel || 'BIM Modeller',
                        job_role: user.jobRole || null,
                        organization: user.organization || null,
                        registration_date: user.registrationDate ? new Date(user.registrationDate) : new Date(),
                        login_count: user.loginCount || 0,
                        last_login: user.lastLogin ? new Date(user.lastLogin) : null,
                        is_active: user.isActive !== false,
                        created_at: new Date(),
                        updated_at: new Date(),
                        preferences: user.preferences ? JSON.stringify(user.preferences) : '{"theme": "light", "notifications": true, "language": "id"}',
                        metadata: user.progress ? JSON.stringify({ progress: user.progress }) : '{}'
                    };

                    // Check if user already exists
                    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [pgUser.email]);
                    if (existing.rows.length > 0) {
                        console.log(`⏭️ User ${pgUser.email} already exists, skipping...`);
                        continue;
                    }

                    // Insert user
                    const result = await pool.query(`
                        INSERT INTO users (
                            username, email, password, bim_level, job_role, organization,
                            registration_date, login_count, last_login, is_active,
                            created_at, updated_at, preferences, metadata
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                        RETURNING id
                    `, [
                        pgUser.username, pgUser.email, pgUser.password, pgUser.bim_level,
                        pgUser.job_role, pgUser.organization, pgUser.registration_date,
                        pgUser.login_count, pgUser.last_login, pgUser.is_active,
                        pgUser.created_at, pgUser.updated_at, pgUser.preferences, pgUser.metadata
                    ]);

                    console.log(`✅ Imported user: ${pgUser.username} (${pgUser.email})`);
                    this.stats.usersImported++;

                } catch (userError) {
                    console.error(`❌ Failed to import user ${user.username || user.id}:`, userError.message);
                    this.stats.errors.push(`User import error: ${userError.message}`);
                }
            }

        } catch (error) {
            console.error('❌ Error importing users:', error.message);
            this.stats.errors.push(`Users import error: ${error.message}`);
        }
    }

    async importCategories() {
        console.log('\n📥 Importing course categories...');

        try {
            const coursesPath = path.join(__dirname, 'backend', 'courses.json');
            if (!fs.existsSync(coursesPath)) {
                console.log('⚠️ Courses file not found, skipping categories...');
                return;
            }

            const coursesData = JSON.parse(fs.readFileSync(coursesPath, 'utf-8'));
            const categories = coursesData.categories || [];

            console.log(`📊 Found ${categories.length} categories to import`);

            for (const category of categories) {
                try {
                    // Map category data
                    const pgCategory = {
                        name: category.name,
                        description: category.description || '',
                        icon: category.icon || 'fas fa-graduation-cap',
                        color: category.color || '#007bff',
                        is_active: true,
                        sort_order: 0
                    };

                    // Check if category already exists
                    const existing = await pool.query('SELECT id FROM course_categories WHERE name = $1', [pgCategory.name]);
                    if (existing.rows.length > 0) {
                        console.log(`⏭️ Category ${pgCategory.name} already exists, skipping...`);
                        continue;
                    }

                    // Insert category
                    await pool.query(`
                        INSERT INTO course_categories (name, description, icon, color, is_active, sort_order)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                        pgCategory.name, pgCategory.description, pgCategory.icon,
                        pgCategory.color, pgCategory.is_active, pgCategory.sort_order
                    ]);

                    console.log(`✅ Imported category: ${pgCategory.name}`);
                    this.stats.categoriesImported++;

                } catch (catError) {
                    console.error(`❌ Failed to import category ${category.name}:`, catError.message);
                    this.stats.errors.push(`Category import error: ${catError.message}`);
                }
            }

        } catch (error) {
            console.error('❌ Error importing categories:', error.message);
            this.stats.errors.push(`Categories import error: ${error.message}`);
        }
    }

    async importCourses() {
        console.log('\n📥 Importing courses...');

        try {
            const coursesPath = path.join(__dirname, 'backend', 'courses.json');
            if (!fs.existsSync(coursesPath)) {
                console.log('⚠️ Courses file not found, skipping...');
                return;
            }

            const coursesData = JSON.parse(fs.readFileSync(coursesPath, 'utf-8'));
            const courses = coursesData.courses || [];

            console.log(`📊 Found ${courses.length} courses to import`);

            for (const course of courses) {
                try {
                    // Get category ID
                    const categoryResult = await pool.query('SELECT id FROM course_categories WHERE name = $1', [course.category]);
                    const categoryId = categoryResult.rows.length > 0 ? categoryResult.rows[0].id : null;

                    // Map course data
                    const pgCourse = {
                        title: course.title,
                        description: course.description,
                        category_id: categoryId,
                        difficulty_level: this.mapDifficultyLevel(course.level),
                        estimated_duration: this.parseDuration(course.duration),
                        language: course.language === 'Bahasa Indonesia' ? 'id' : 'en',
                        view_count: 0,
                        student_count: 0,
                        rating: 0.0,
                        rating_count: 0,
                        is_published: course.status === 'Published',
                        is_featured: course.price === 'Premium',
                        created_at: new Date(course.createdDate || Date.now()),
                        updated_at: new Date(course.updatedDate || Date.now()),
                        published_at: course.status === 'Published' ? new Date() : null
                    };

                    // Check if course already exists
                    const existing = await pool.query('SELECT id FROM courses WHERE title = $1', [pgCourse.title]);
                    if (existing.rows.length > 0) {
                        console.log(`⏭️ Course ${pgCourse.title} already exists, skipping...`);
                        continue;
                    }

                    // Insert course
                    await pool.query(`
                        INSERT INTO courses (
                            title, description, category_id, difficulty_level, estimated_duration,
                            language, view_count, student_count, rating, rating_count,
                            is_published, is_featured, created_at, updated_at, published_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                    `, [
                        pgCourse.title, pgCourse.description, pgCourse.category_id, pgCourse.difficulty_level,
                        pgCourse.estimated_duration, pgCourse.language, pgCourse.view_count, pgCourse.student_count,
                        pgCourse.rating, pgCourse.rating_count, pgCourse.is_published, pgCourse.is_featured,
                        pgCourse.created_at, pgCourse.updated_at, pgCourse.published_at
                    ]);

                    console.log(`✅ Imported course: ${pgCourse.title}`);
                    this.stats.coursesImported++;

                } catch (courseError) {
                    console.error(`❌ Failed to import course ${course.title}:`, courseError.message);
                    this.stats.errors.push(`Course import error: ${courseError.message}`);
                }
            }

        } catch (error) {
            console.error('❌ Error importing courses:', error.message);
            this.stats.errors.push(`Courses import error: ${error.message}`);
        }
    }

    async importLearningMaterials() {
        console.log('\n📥 Importing learning materials...');

        try {
            const materialsPath = path.join(__dirname, 'backend', 'learning-materials.json');
            if (!fs.existsSync(materialsPath)) {
                console.log('⚠️ Learning materials file not found, skipping...');
                return;
            }

            const materials = JSON.parse(fs.readFileSync(materialsPath, 'utf-8'));
            console.log(`📊 Found ${materials.length} learning materials to import`);

            for (const material of materials) {
                try {
                    // Insert into media_files table (simplified)
                    const pgMaterial = {
                        filename: material.filename || path.basename(material.path || ''),
                        original_filename: material.filename || path.basename(material.path || ''),
                        filepath: material.path || '',
                        file_url: material.url || '',
                        file_size: material.size || null,
                        mime_type: this.guessMimeType(material.filename || ''),
                        metadata: JSON.stringify({
                            title: material.title,
                            description: material.description,
                            category: material.category,
                            level: material.level
                        }),
                        tags: JSON.stringify(material.tags || []),
                        processing_status: 'completed',
                        created_at: new Date(material.created_at || Date.now()),
                        updated_at: new Date(material.updated_at || Date.now())
                    };

                    await pool.query(`
                        INSERT INTO media_files (
                            filename, original_filename, filepath, file_url, file_size,
                            mime_type, metadata, tags, processing_status, created_at, updated_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    `, [
                        pgMaterial.filename, pgMaterial.original_filename, pgMaterial.filepath,
                        pgMaterial.file_url, pgMaterial.file_size, pgMaterial.mime_type,
                        pgMaterial.metadata, pgMaterial.tags, pgMaterial.processing_status,
                        pgMaterial.created_at, pgMaterial.updated_at
                    ]);

                    console.log(`✅ Imported material: ${pgMaterial.filename}`);
                    this.stats.materialsImported++;

                } catch (matError) {
                    console.error(`❌ Failed to import material ${material.filename}:`, matError.message);
                    this.stats.errors.push(`Material import error: ${matError.message}`);
                }
            }

        } catch (error) {
            console.error('❌ Error importing learning materials:', error.message);
            this.stats.errors.push(`Learning materials import error: ${error.message}`);
        }
    }

    mapDifficultyLevel(level) {
        if (!level) return 'intermediate';
        const lowerLevel = level.toLowerCase();
        if (lowerLevel.includes('beginner')) return 'beginner';
        if (lowerLevel.includes('advanced')) return 'advanced';
        return 'intermediate';
    }

    parseDuration(duration) {
        if (!duration) return null;
        // Parse "2.5 jam" or "4 jam" to minutes
        const match = duration.match(/(\d+(?:\.\d+)?)\s*jam?/i);
        if (match) {
            return Math.round(parseFloat(match[1]) * 60);
        }
        return null;
    }

    guessMimeType(filename) {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.ppt': 'application/vnd.ms-powerpoint',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    async runMigration() {
        console.log('🚀 Starting Manual JSON to PostgreSQL Migration');
        console.log('='.repeat(60));

        try {
            await this.connect();

            // Import data in order
            await this.importUsers();
            await this.importCategories();
            await this.importCourses();
            await this.importLearningMaterials();

            // Generate report
            this.generateReport();

        } catch (error) {
            console.error('❌ Migration failed:', error.message);
            throw error;
        } finally {
            await this.disconnect();
        }
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 MANUAL MIGRATION REPORT');
        console.log('='.repeat(60));
        console.log(`📅 Migration Time: ${new Date().toISOString()}`);
        console.log(`👥 Users Imported: ${this.stats.usersImported}`);
        console.log(`📚 Categories Imported: ${this.stats.categoriesImported}`);
        console.log(`🎓 Courses Imported: ${this.stats.coursesImported}`);
        console.log(`📄 Materials Imported: ${this.stats.materialsImported}`);
        console.log(`❌ Errors: ${this.stats.errors.length}`);

        if (this.stats.errors.length > 0) {
            console.log('\n🚨 ERRORS:');
            this.stats.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }

        const totalImported = this.stats.usersImported + this.stats.categoriesImported +
                            this.stats.coursesImported + this.stats.materialsImported;

        console.log(`\n✅ MIGRATION ${this.stats.errors.length === 0 ? 'SUCCESSFUL' : 'COMPLETED WITH ERRORS'}`);
        console.log(`📊 Total records imported: ${totalImported}`);

        if (totalImported > 0) {
            console.log('\n🎉 PostgreSQL database is now populated with data!');
            console.log('   Next step: Update server.js to use PostgreSQL');
        }
    }
}

// CLI usage
if (require.main === module) {
    console.log('🗄️  BCL Manual JSON to PostgreSQL Migration Tool');

    if (!process.env.DB_PASSWORD) {
        console.error('❌ DB_PASSWORD environment variable required');
        console.error('   Set DB_PASSWORD=secure_password_2025');
        process.exit(1);
    }

    const migrator = new ManualMigrator();

    migrator.runMigration()
        .then(() => {
            console.log('\n✅ Manual migration completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Migration failed:', error.message);
            process.exit(1);
        });
}

module.exports = ManualMigrator;
