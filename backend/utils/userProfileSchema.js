const BIM_COMPETENCY_LEVELS = Object.freeze([
    'BIM Modeller',
    'BIM Coordinator',
    'BIM Specialist',
    'BIM Manager'
]);

const POSITION_VERIFICATION_STATUSES = Object.freeze([
    'unverified',
    'pending',
    'verified',
    'rejected',
    'superseded'
]);

const COMPETENCY_STATUSES = Object.freeze([
    'not_assessed',
    'self_declared',
    'assessment_in_progress',
    'verified',
    'reassessment_required'
]);

const SYSTEM_ROLES = Object.freeze(['employee', 'system_admin']);

let ensureProfileColumnsPromise = null;

function normalizeEnum(value, allowed, fallback) {
    const normalized = String(value || '').trim().toLowerCase();
    const match = allowed.find((item) => item.toLowerCase() === normalized);
    return match || fallback;
}

function normalizeBimCompetencyLevel(value, fallback = null) {
    return normalizeEnum(value, BIM_COMPETENCY_LEVELS, fallback);
}

function normalizePositionVerificationStatus(value, fallback = 'unverified') {
    return normalizeEnum(value, POSITION_VERIFICATION_STATUSES, fallback);
}

function normalizeCompetencyStatus(value, level = null) {
    const fallback = normalizeBimCompetencyLevel(level) ? 'self_declared' : 'not_assessed';
    return normalizeEnum(value, COMPETENCY_STATUSES, fallback);
}

function normalizeSystemRole(value, fallback = 'employee') {
    return normalizeEnum(value, SYSTEM_ROLES, fallback);
}

function mapUserProfileState(source = {}) {
    const competencyLevel = normalizeBimCompetencyLevel(source.bimLevel ?? source.bim_level);
    const targetCompetencyLevel = normalizeBimCompetencyLevel(
        source.targetBimLevel ?? source.target_bim_level
    );
    const positionLabel = String(
        source.positionLabel ?? source.position_label ?? source.jobRole ?? source.job_role ?? ''
    ).trim();

    return {
        positionLabel,
        positionVerificationStatus: normalizePositionVerificationStatus(
            source.positionVerificationStatus ?? source.position_verification_status
        ),
        competencyLevel,
        competencyStatus: normalizeCompetencyStatus(
            source.competencyStatus ?? source.competency_status,
            competencyLevel
        ),
        targetCompetencyLevel,
        systemRole: normalizeSystemRole(source.systemRole ?? source.system_role)
    };
}

async function ensureUserProfileColumns(targetPool) {
    if (!targetPool) return;

    if (!ensureProfileColumnsPromise) {
        ensureProfileColumnsPromise = (async () => {
            await targetPool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS position_label TEXT`);
            await targetPool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS position_verification_status TEXT DEFAULT 'unverified'`);
            await targetPool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS position_verified_at TIMESTAMPTZ`);
            await targetPool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS position_verified_by TEXT`);
            await targetPool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS competency_status TEXT DEFAULT 'not_assessed'`);
            await targetPool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS competency_verified_at TIMESTAMPTZ`);
            await targetPool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS competency_verified_by TEXT`);
            await targetPool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS target_bim_level VARCHAR(50)`);
            await targetPool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS system_role TEXT DEFAULT 'employee'`);
            await targetPool.query(`ALTER TABLE users ALTER COLUMN bim_level DROP DEFAULT`);
            await targetPool.query(`
                UPDATE users
                SET position_label = NULLIF(TRIM(job_role), '')
                WHERE NULLIF(TRIM(position_label), '') IS NULL
                  AND NULLIF(TRIM(job_role), '') IS NOT NULL
            `);
            await targetPool.query(`
                UPDATE users
                SET competency_status = CASE
                    WHEN NULLIF(TRIM(bim_level), '') IS NULL THEN 'not_assessed'
                    ELSE 'self_declared'
                END
                WHERE competency_status IS NULL
                   OR competency_status NOT IN ('not_assessed','self_declared','assessment_in_progress','verified','reassessment_required')
                   OR (competency_status = 'not_assessed' AND NULLIF(TRIM(bim_level), '') IS NOT NULL)
            `);
            await targetPool.query(`
                UPDATE users
                SET system_role = 'employee'
                WHERE system_role IS NULL
                   OR system_role NOT IN ('employee','system_admin')
            `);
        })().catch((error) => {
            ensureProfileColumnsPromise = null;
            throw error;
        });
    }

    return ensureProfileColumnsPromise;
}

module.exports = {
    BIM_COMPETENCY_LEVELS,
    COMPETENCY_STATUSES,
    POSITION_VERIFICATION_STATUSES,
    SYSTEM_ROLES,
    ensureUserProfileColumns,
    mapUserProfileState,
    normalizeBimCompetencyLevel,
    normalizeCompetencyStatus,
    normalizePositionVerificationStatus,
    normalizeSystemRole
};
