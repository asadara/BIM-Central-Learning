#!/usr/bin/env node

/**
 * PostgreSQL Configuration for BCL Migration
 * Handles database connection and schema updates
 */

// PostgreSQL connection configuration
const { Pool } = require('pg');

const pgConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'bcl_database',
    user: process.env.DB_USER || 'bcl_user',
    password: process.env.DB_PASSWORD,
    max: 50, // Increased for concurrent users
    min: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    acquireTimeoutMillis: 60000,
    allowExitOnIdle: true
};

// Create connection pool
const pool = new Pool(pgConfig);

// Handle connection events
pool.on('connect', (client) => {
    console.log('🔗 PostgreSQL client connected');
});

pool.on('error', (err, client) => {
    console.error('❌ Unexpected PostgreSQL error:', err);
});

pool.on('remove', (client) => {
    console.log('🔌 PostgreSQL client removed from pool');
});

// Test connection
async function testConnection() {
    try {
        const result = await pool.query('SELECT version(), current_timestamp');
        console.log('✅ PostgreSQL connection successful');
        console.log(`   Version: ${result.rows[0].version.split(' ')[1]}`);
        return true;
    } catch (error) {
        console.error('❌ PostgreSQL connection failed:', error.message);
        return false;
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 Shutting down PostgreSQL connections...');
    await pool.end();
    console.log('✅ PostgreSQL connections closed');
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, shutting down PostgreSQL connections...');
    await pool.end();
    console.log('✅ PostgreSQL connections closed');
    process.exit(0);
});

// Export pool for use in server.js
module.exports = {
    pool,
    testConnection,
    config: pgConfig
};

// CLI usage for testing
if (require.main === module) {
    console.log('🧪 Testing PostgreSQL connection...');

    if (!process.env.DB_PASSWORD) {
        console.error('❌ DB_PASSWORD environment variable required');
        process.exit(1);
    }

    testConnection().then(success => {
        if (success) {
            console.log('✅ PostgreSQL configuration is valid');
            process.exit(0);
        } else {
            console.error('❌ PostgreSQL configuration failed');
            process.exit(1);
        }
    });
}
