const fs = require('fs');
const { canonicalUserId } = require('./canonicalIdentity');
const path = require('path');
const { Pool } = require('pg');
const { createPgConfig } = require('../config/runtimeConfig');
const { ensureUserProfileColumns } = require('./userProfileSchema');

const USERS_FILE = path.join(__dirname, '..', 'users.json');

const ACCESS_COLUMN_DEFINITIONS = [
    ['mapping_kompetensi_access', 'BOOLEAN DEFAULT false'],
    ['dokumen_access', 'BOOLEAN DEFAULT false'],
    ['audit_2026_access', 'BOOLEAN DEFAULT false'],
    ['project_document_access', 'BOOLEAN DEFAULT false'],
    ['library_download_access', 'BOOLEAN DEFAULT false'],
    ['watermark_free_download_access', 'BOOLEAN DEFAULT false'],
    ['bim_workspace_access', 'BOOLEAN DEFAULT false'],
    ['bim_workspace_role', "TEXT DEFAULT 'staff_bim'"],
    ['bim_workspace_staff_role', "TEXT DEFAULT 'bim_specialist'"]
];
const BIM_WORKSPACE_ROLES = new Set(['staff_bim', 'division_head']);
const BIM_WORKSPACE_STAFF_ROLES = new Set(['bim_modeller', 'bim_specialist', 'bim_coordinator']);

const pool = new Pool(createPgConfig({
    max: 4,
    min: 0,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
}));

pool.on('error', (err) => {
    console.warn('WARN: PostgreSQL pool error in userAccess helper:', err.message);
});

let ensureColumnsPromise = null;

function normalizeBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }
    return false;
}

function normalizeAccessProfile(source = {}) {
    const requestedWorkspaceRole = String(
        source.bimWorkspaceRole ?? source.bim_workspace_role ?? 'staff_bim'
    ).trim().toLowerCase();
    const requestedWorkspaceStaffRole = String(
        source.bimWorkspaceStaffRole ?? source.bim_workspace_staff_role ?? 'bim_specialist'
    ).trim().toLowerCase();

    return {
        mappingKompetensiAccess: normalizeBoolean(
            source.mappingKompetensiAccess ?? source.mapping_kompetensi_access
        ),
        dokumenAccess: normalizeBoolean(
            source.dokumenAccess ?? source.dokumen_access
        ),
        audit2026Access: normalizeBoolean(
            source.audit2026Access ?? source.audit_2026_access
        ),
        projectDocumentAccess: normalizeBoolean(
            source.projectDocumentAccess ?? source.project_document_access
        ),
        libraryDownloadAccess: normalizeBoolean(
            source.libraryDownloadAccess ?? source.library_download_access
        ),
        watermarkFreeDownloadAccess: normalizeBoolean(
            source.watermarkFreeDownloadAccess ?? source.watermark_free_download_access
        ),
        bimWorkspaceAccess: normalizeBoolean(
            source.bimWorkspaceAccess ?? source.bim_workspace_access
        ),
        bimWorkspaceRole: BIM_WORKSPACE_ROLES.has(requestedWorkspaceRole) ? requestedWorkspaceRole : 'staff_bim',
        bimWorkspaceStaffRole: BIM_WORKSPACE_STAFF_ROLES.has(requestedWorkspaceStaffRole)
            ? requestedWorkspaceStaffRole
            : 'bim_specialist'
    };
}

function readUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];

    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (error) {
        console.warn('WARN: Failed to read users.json in userAccess helper:', error.message);
        return [];
    }
}

async function ensureAccessColumns(targetPool = pool) {
    if (!ensureColumnsPromise) {
        ensureColumnsPromise = (async () => {
            await ensureUserProfileColumns(targetPool);
            const staffRoleColumn = await targetPool.query(`
                SELECT 1 FROM information_schema.columns
                WHERE table_schema=current_schema()
                  AND table_name='users'
                  AND column_name='bim_workspace_staff_role'
                LIMIT 1
            `);
            const shouldInferExistingStaffRoles = staffRoleColumn.rows.length === 0;
            for (const [columnName, definition] of ACCESS_COLUMN_DEFINITIONS) {
                await targetPool.query(
                    `ALTER TABLE users ADD COLUMN IF NOT EXISTS ${columnName} ${definition}`
                );
            }
            await targetPool.query(`ALTER TABLE users ALTER COLUMN bim_workspace_role SET DEFAULT 'staff_bim'`);
            await targetPool.query(`
                UPDATE users
                SET bim_workspace_role='staff_bim'
                WHERE COALESCE(bim_workspace_role,'') NOT IN ('staff_bim','division_head')
            `);
            if (shouldInferExistingStaffRoles) {
                await targetPool.query(`
                    UPDATE users
                    SET bim_workspace_staff_role=CASE
                        WHEN lower(COALESCE(job_role,'')) LIKE '%coordinator%'
                          OR lower(COALESCE(bim_level,''))='bim coordinator' THEN 'bim_coordinator'
                        WHEN lower(COALESCE(job_role,'')) LIKE '%modeller%'
                          OR lower(COALESCE(job_role,'')) LIKE '%modeler%' THEN 'bim_modeller'
                        WHEN lower(COALESCE(job_role,'')) LIKE '%specialist%' THEN 'bim_specialist'
                        WHEN lower(COALESCE(bim_level,''))='bim modeller' THEN 'bim_modeller'
                        ELSE 'bim_specialist'
                    END
                `);
            }
        })().catch((error) => {
            ensureColumnsPromise = null;
            throw error;
        });
    }

    return ensureColumnsPromise;
}

async function fetchAccessProfileFromDb(userId, email) {
    const id = canonicalUserId(userId);
    if (!id) return null;
    await ensureAccessColumns();

    const result = await pool.query(
        `SELECT mapping_kompetensi_access, dokumen_access, audit_2026_access,
                project_document_access,
                library_download_access, watermark_free_download_access,
                bim_workspace_access, bim_workspace_role, bim_workspace_staff_role
         FROM users
         WHERE id = $1 AND is_active = true
         LIMIT 1`,
        [id]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return normalizeAccessProfile(result.rows[0]);
}

function fetchAccessProfileFromJson() {
    // Keep the compatibility API, but never grant permissions from unmapped JSON.
    return null;
}

async function resolveAccessProfile(authUser) {
    if (!authUser) {
        return normalizeAccessProfile();
    }

    if (authUser.isAdmin) {
        return {
            mappingKompetensiAccess: true,
            dokumenAccess: true,
            audit2026Access: true,
            projectDocumentAccess: true,
            libraryDownloadAccess: true,
            watermarkFreeDownloadAccess: true,
            bimWorkspaceAccess: true,
            bimWorkspaceRole: 'system_admin',
            bimWorkspaceStaffRole: 'bim_specialist'
        };
    }

    try {
        const dbProfile = await fetchAccessProfileFromDb(authUser.id, authUser.email);
        if (dbProfile) {
            return dbProfile;
        }
    } catch (error) {
        console.warn('WARN: PostgreSQL not available for user access lookup, falling back to JSON:', error.message);
    }

    return fetchAccessProfileFromJson(authUser.id, authUser.email) || normalizeAccessProfile();
}

module.exports = {
    ACCESS_COLUMN_DEFINITIONS,
    ensureAccessColumns,
    fetchAccessProfileFromDb,
    fetchAccessProfileFromJson,
    normalizeAccessProfile,
    resolveAccessProfile
};
