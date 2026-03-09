#!/usr/bin/env node

/**
 * BCL PostgreSQL Monitoring & Health Check Script
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
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

class PostgresMonitor {
    constructor() {
        this.healthStatus = {
            overall: 'unknown',
            database: 'unknown',
            connections: 'unknown',
            performance: 'unknown',
            tables: 'unknown',
            lastCheck: null
        };
    }

    async checkHealth() {
        console.log('🔍 Starting PostgreSQL Health Check...');
        this.healthStatus.lastCheck = new Date();

        try {
            // 1. Database connectivity
            await this.checkDatabaseConnectivity();

            // 2. Connection pool status
            await this.checkConnectionPool();

            // 3. Performance metrics
            await this.checkPerformance();

            // 4. Table and data integrity
            await this.checkTables();

            // 5. Overall assessment
            this.assessOverallHealth();

            this.generateReport();

        } catch (error) {
            console.error('❌ Health check failed:', error.message);
            this.healthStatus.overall = 'critical';
        }
    }

    async checkDatabaseConnectivity() {
        try {
            const result = await pool.query('SELECT version(), current_timestamp');
            this.healthStatus.database = 'healthy';
            console.log('✅ Database connectivity: OK');
            console.log(`   PostgreSQL Version: ${result.rows[0].version.split(' ')[1]}`);
        } catch (error) {
            this.healthStatus.database = 'critical';
            console.log('❌ Database connectivity: FAILED');
            throw error;
        }
    }

    async checkConnectionPool() {
        try {
            const result = await pool.query(`
                SELECT
                    count(*) as total_connections,
                    count(*) filter (where state = 'active') as active_connections,
                    count(*) filter (where state = 'idle') as idle_connections,
                    max(age(now(), query_start)) as longest_query_age
                FROM pg_stat_activity
                WHERE datname = $1
            `, [process.env.DB_NAME || 'bcl_database']);

            const stats = result.rows[0];
            console.log('📊 Connection Pool Status:');
            console.log(`   Total connections: ${stats.total_connections}`);
            console.log(`   Active connections: ${stats.active_connections}`);
            console.log(`   Idle connections: ${stats.idle_connections}`);
            console.log(`   Longest query: ${stats.longest_query_age || 'None'}`);

            // Assess connection health
            if (stats.total_connections > 50) {
                this.healthStatus.connections = 'warning';
                console.log('⚠️  High connection count detected');
            } else if (stats.active_connections > 20) {
                this.healthStatus.connections = 'warning';
                console.log('⚠️  Many active connections');
            } else {
                this.healthStatus.connections = 'healthy';
                console.log('✅ Connection pool: HEALTHY');
            }

        } catch (error) {
            this.healthStatus.connections = 'critical';
            console.log('❌ Connection pool check failed');
        }
    }

    async checkPerformance() {
        try {
            // Get database performance metrics
            const perfResult = await pool.query(`
                SELECT
                    datname as database,
                    numbackends as connections,
                    pg_size_pretty(pg_database_size(datname)) as size,
                    age(datfrozenxid) as xid_age
                FROM pg_stat_database
                WHERE datname = $1
            `, [process.env.DB_NAME || 'bcl_database']);

            const perf = perfResult.rows[0];
            console.log('🚀 Performance Metrics:');
            console.log(`   Database size: ${perf.size}`);
            console.log(`   Active connections: ${perf.connections}`);
            console.log(`   Transaction age: ${perf.xid_age}`);

            // Check for performance issues
            const sizeGB = parseFloat(perf.size.replace(' GB', '').replace(' MB', '')) /
                          (perf.size.includes('GB') ? 1 : 1024);

            if (sizeGB > 10) {
                this.healthStatus.performance = 'warning';
                console.log('⚠️  Large database size - consider optimization');
            } else if (perf.xid_age > 200000000) {
                this.healthStatus.performance = 'warning';
                console.log('⚠️  Old transactions detected - consider VACUUM');
            } else {
                this.healthStatus.performance = 'healthy';
                console.log('✅ Performance: HEALTHY');
            }

        } catch (error) {
            this.healthStatus.performance = 'critical';
            console.log('❌ Performance check failed');
        }
    }

    async checkTables() {
        try {
            // Check table existence and record counts
            const tablesResult = await pool.query(`
                SELECT
                    schemaname,
                    tablename,
                    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
                    n_tup_ins as inserts,
                    n_tup_upd as updates,
                    n_tup_del as deletes,
                    n_live_tup as live_rows,
                    n_dead_tup as dead_rows
                FROM pg_stat_user_tables
                ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
                LIMIT 10
            `);

            console.log('📋 Table Statistics (Top 10 by size):');
            tablesResult.rows.forEach((table, index) => {
                console.log(`   ${index + 1}. ${table.tablename}: ${table.size} (${table.live_rows} rows)`);
            });

            // Check for issues
            const totalDeadRows = tablesResult.rows.reduce((sum, table) => sum + parseInt(table.dead_rows), 0);
            const totalLiveRows = tablesResult.rows.reduce((sum, table) => sum + parseInt(table.live_rows), 0);

            if (totalDeadRows > totalLiveRows * 0.1) {
                this.healthStatus.tables = 'warning';
                console.log('⚠️  High dead row ratio - consider VACUUM');
            } else {
                this.healthStatus.tables = 'healthy';
                console.log('✅ Tables: HEALTHY');
            }

        } catch (error) {
            this.healthStatus.tables = 'critical';
            console.log('❌ Table check failed');
        }
    }

    assessOverallHealth() {
        const statuses = [
            this.healthStatus.database,
            this.healthStatus.connections,
            this.healthStatus.performance,
            this.healthStatus.tables
        ];

        if (statuses.includes('critical')) {
            this.healthStatus.overall = 'critical';
        } else if (statuses.includes('warning')) {
            this.healthStatus.overall = 'warning';
        } else {
            this.healthStatus.overall = 'healthy';
        }
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 POSTGRESQL HEALTH REPORT');
        console.log('='.repeat(60));
        console.log(`⏱️  Check Time: ${this.healthStatus.lastCheck.toISOString()}`);
        console.log(`🏥 Overall Health: ${this.getHealthIcon()} ${this.healthStatus.overall.toUpperCase()}`);

        console.log('\n📋 Component Status:');
        Object.entries(this.healthStatus).forEach(([component, status]) => {
            if (component !== 'overall' && component !== 'lastCheck') {
                const icon = this.getStatusIcon(status);
                console.log(`   ${icon} ${component}: ${status.toUpperCase()}`);
            }
        });

        // Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        if (this.healthStatus.overall === 'critical') {
            console.log('❌ CRITICAL ISSUES DETECTED - IMMEDIATE ACTION REQUIRED');
            console.log('   • Check database connectivity');
            console.log('   • Review connection limits');
            console.log('   • Contact database administrator');
        } else if (this.healthStatus.overall === 'warning') {
            console.log('⚠️  PERFORMANCE ISSUES DETECTED');
            console.log('   • Consider database optimization');
            console.log('   • Run VACUUM on tables with high dead rows');
            console.log('   • Monitor connection usage');
        } else {
            console.log('✅ ALL SYSTEMS HEALTHY');
            console.log('   • Database is performing optimally');
            console.log('   • No immediate action required');
        }

        // Exit with appropriate code
        if (this.healthStatus.overall === 'critical') {
            process.exit(2);
        } else if (this.healthStatus.overall === 'warning') {
            process.exit(1);
        } else {
            process.exit(0);
        }
    }

    getHealthIcon() {
        switch (this.healthStatus.overall) {
            case 'healthy': return '✅';
            case 'warning': return '⚠️ ';
            case 'critical': return '❌';
            default: return '❓';
        }
    }

    getStatusIcon(status) {
        switch (status) {
            case 'healthy': return '✅';
            case 'warning': return '⚠️ ';
            case 'critical': return '❌';
            default: return '❓';
        }
    }

    async createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(__dirname, 'backups', `bcl_backup_${timestamp}.sql`);

        console.log('💾 Creating PostgreSQL backup...');
        console.log(`📁 Backup file: ${backupFile}`);

        try {
            const { execSync } = require('child_process');

            // Use pg_dump to create backup
            const dumpCommand = `pg_dump -h ${process.env.DB_HOST || 'localhost'} -p ${process.env.DB_PORT || 5432} -U ${process.env.DB_USER || 'bcl_user'} -d ${process.env.DB_NAME || 'bcl_database'} -f "${backupFile}" --no-password`;

            // Set PGPASSWORD environment variable
            const env = { ...process.env, PGPASSWORD: process.env.DB_PASSWORD };

            execSync(dumpCommand, { env, stdio: 'inherit' });

            console.log('✅ Backup created successfully!');
            console.log(`📊 File size: ${fs.statSync(backupFile).size} bytes`);

            return backupFile;

        } catch (error) {
            console.error('❌ Backup failed:', error.message);
            throw error;
        }
    }

    async cleanupOldBackups(maxBackups = 10) {
        const backupDir = path.join(__dirname, 'backups');

        try {
            const files = fs.readdirSync(backupDir)
                .filter(file => file.startsWith('bcl_backup_') && file.endsWith('.sql'))
                .map(file => ({
                    name: file,
                    path: path.join(backupDir, file),
                    stats: fs.statSync(path.join(backupDir, file))
                }))
                .sort((a, b) => b.stats.mtime - a.stats.mtime);

            if (files.length > maxBackups) {
                const toDelete = files.slice(maxBackups);
                console.log(`🗑️  Cleaning up ${toDelete.length} old backups...`);

                toDelete.forEach(file => {
                    fs.unlinkSync(file.path);
                    console.log(`   Deleted: ${file.name}`);
                });
            }

        } catch (error) {
            console.error('❌ Cleanup failed:', error.message);
        }
    }
}

// Command line interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0] || 'health';

    console.log('🗄️  BCL PostgreSQL Monitoring Tool');
    console.log('==================================');

    // Validate environment
    if (!process.env.DB_PASSWORD) {
        console.error('❌ DB_PASSWORD environment variable required');
        process.exit(1);
    }

    const monitor = new PostgresMonitor();

    switch (command) {
        case 'health':
            monitor.checkHealth().catch(console.error);
            break;

        case 'backup':
            monitor.createBackup()
                .then((file) => {
                    console.log(`✅ Backup completed: ${file}`);
                    return monitor.cleanupOldBackups();
                })
                .catch(console.error);
            break;

        case 'maintenance':
            console.log('🔧 Running maintenance tasks...');
            Promise.all([
                monitor.createBackup(),
                monitor.cleanupOldBackups()
            ]).then(() => {
                console.log('✅ Maintenance completed');
            }).catch(console.error);
            break;

        default:
            console.log('Usage: node postgres-monitoring.js [command]');
            console.log('Commands:');
            console.log('  health     - Run health check (default)');
            console.log('  backup     - Create database backup');
            console.log('  maintenance - Run backup and cleanup');
            break;
    }
}

module.exports = PostgresMonitor;
