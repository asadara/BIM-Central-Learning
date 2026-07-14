const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { createPgConfig } = require('../config/runtimeConfig');
const { getBearerRequestUser, getRequestUser } = require('../utils/auth');
const { normalizeAccessProfile, resolveAccessProfile } = require('../utils/userAccess');
const { scorecards: KPI_SCORECARDS, programs: KPI_PROGRAMS, MAX_ACHIEVEMENT } = require('../services/bimKpiCatalog');

const router = express.Router();
const pool = new Pool(createPgConfig({ max: 8, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 }));

function route(method, path, handler) {
    router[method](path, (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next);
    });
}

pool.on('error', (error) => {
    console.warn('WARN: PostgreSQL pool error in bimWorkspaceRoutes:', error.message);
});

const WORKSPACE_ROLES = new Set(['staff_bim', 'division_head', 'department_head', 'viewer', 'system_admin']);
const TASK_INTAKE = new Set(['draft', 'pending_approval', 'approved', 'revision_required', 'rejected']);
const TASK_STATUSES = new Set(['planned', 'in_progress', 'blocked', 'submitted_for_review', 'approved_done', 'rejected_revision', 'cancelled']);
const TASK_TYPES = new Set(['project_task', 'tender_support', 'routine_monitoring', 'coordination', 'review', 'reporting', 'support', 'internal_admin', 'other']);
const PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);
const ISSUE_STATUSES = new Set(['draft', 'submitted', 'accepted', 'action_required', 'resolved_pending_approval', 'closed', 'rejected', 'cancelled']);
const ISSUE_TYPES = new Set(['internal_issue', 'coordination_issue', 'model_issue', 'data_issue', 'drawing_issue', 'workflow_issue', 'resource_issue', 'risk_note', 'other']);
const SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
const MEETING_STATUSES = new Set(['draft', 'issued', 'closed', 'cancelled']);
const ACTION_STATUSES = new Set(['open', 'in_progress', 'closed', 'cancelled']);
const LEGACY_RISALAH_ROOT = path.resolve('G:/BIM CENTRAL LEARNING/data/RISALAH');

let ensureTablesPromise;

function newId(prefix) {
    return `${prefix}-${crypto.randomUUID()}`;
}

function trimText(value, max = 4000) {
    return String(value == null ? '' : value).trim().slice(0, max);
}

function normalizeProjectName(value) {
    return trimText(value, 240).replace(/\s+/g, ' ');
}

function normalizeEnum(value, allowed, fallback) {
    const normalized = trimText(value, 80).toLowerCase();
    return allowed.has(normalized) ? normalized : fallback;
}

function normalizePeriod(value) {
    const period = trimText(value, 7);
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(period) ? period : new Date().toISOString().slice(0, 7);
}

function normalizeYear(value) {
    const year = Number(value);
    return Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : new Date().getFullYear();
}

function normalizeDate(value) {
    const candidate = trimText(value, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null;
}

function normalizePathSlash(value) {
    return String(value || '').replace(/\\/g, '/');
}

function parseLegacyRisalahDate(fileName, stats) {
    const bracket = fileName.match(/\[(\d{4}-\d{2}-\d{2})\]/);
    if (bracket) return { date: bracket[1], source: 'filename' };

    const compact = fileName.match(/(?:^|[_\s])(\d{2})(\d{2})(\d{2})(?:[_\s.]|$)/);
    if (compact) {
        const day = compact[1];
        const month = compact[2];
        const year = `20${compact[3]}`;
        return { date: `${year}-${month}-${day}`, source: 'filename' };
    }

    return { date: dateOnly(stats.mtime), source: 'modified' };
}

function parseLegacyRisalahSequence(fileName) {
    const monitoring = fileName.match(/MEETING[_\s]+MONITORING[_\s]+(\d+)/i) || fileName.match(/MONITORING[_\s]*(\d+)/i);
    if (monitoring) return { type: 'Monitoring', sequence: Number(monitoring[1]) };
    const coordination = fileName.match(/MEETING[_\s]+KOORDINASI[_\s]+(\d+)/i) || fileName.match(/KOORDINASI[_\s]*(\d+)/i);
    if (coordination) return { type: 'Koordinasi', sequence: Number(coordination[1]) };
    return { type: 'Risalah', sequence: null };
}

function walkLegacyRisalahFiles(dir, baseDir = LEGACY_RISALAH_ROOT) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return walkLegacyRisalahFiles(fullPath, baseDir);
        if (!entry.isFile() || entry.name.startsWith('~$') || entry.name.toLowerCase() === 'thumbs.db') return [];
        if (path.extname(entry.name).toLowerCase() !== '.pdf') return [];

        const relativePath = normalizePathSlash(path.relative(baseDir, fullPath));
        const parts = relativePath.split('/');
        const sourceCategory = parts[0] || '';
        const contextFolder = parts.length > 2 ? parts[1] : sourceCategory;
        const stats = fs.statSync(fullPath);
        const parsedDate = parseLegacyRisalahDate(entry.name, stats);
        const parsedSequence = parseLegacyRisalahSequence(entry.name);
        const internal = sourceCategory.toUpperCase() === 'INTERNAL';
        const projectName = internal ? 'Divisi BIM HO' : contextFolder;
        const title = path.basename(entry.name, path.extname(entry.name)).replace(/\s+/g, ' ').trim();

        return [{
            id: crypto.createHash('sha1').update(relativePath).digest('hex'),
            sourceType: 'legacy',
            sourceCategory,
            scopeType: internal ? 'kantor' : 'proyek',
            projectName,
            meetingNo: parsedSequence.sequence ? `${parsedSequence.type} ${parsedSequence.sequence}` : '',
            documentType: parsedSequence.type,
            documentSequence: parsedSequence.sequence,
            subject: title,
            meetingDate: parsedDate.date,
            dateSource: parsedDate.source,
            status: 'legacy_archive',
            openActions: 0,
            createdByName: 'Legacy Archive',
            fileName: entry.name,
            relativePath,
            fileSize: stats.size,
            fileSizeMb: Number((stats.size / 1048576).toFixed(2)),
            pdfUrl: `/api/bim-workspace/legacy-risalah/file?path=${encodeURIComponent(relativePath)}`
        }];
    });
}

function dateOnly(value = new Date()) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(0,10);
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function normalizeNumber(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function actorId(req) {
    return String(req.workspaceUser?.id || req.authUser?.id || '');
}

function actorName(req) {
    return trimText(req.workspaceUser?.username || req.workspaceUser?.email || 'BCL User', 160);
}

function isDivisionHead(req) {
    return req.workspaceRole === 'division_head';
}

function canWrite(req) {
    return req.workspaceRole === 'staff_bim' || req.workspaceRole === 'division_head' || req.workspaceRole === 'system_admin';
}

function canManageTechnical(req) {
    return req.workspaceRole === 'division_head' || req.workspaceRole === 'system_admin';
}

function isKpiManager(req) {
    return req.workspaceRole === 'division_head' || req.workspaceRole === 'system_admin';
}

async function resolveTaskAssignment(req, requestedPicId) {
    const requestedId = trimText(requestedPicId, 100);
    const self = {
        picId: actorId(req),
        picName: actorName(req),
        delegated: false
    };

    if (!isKpiManager(req)) {
        if (requestedId && requestedId !== self.picId) {
            return { error: 'Staff BIM tidak dapat mendelegasikan task kepada user lain', status: 403 };
        }
        return self;
    }

    if (!requestedId || requestedId === self.picId) return self;
    const user = await pool.query(
        `SELECT id::text, username
         FROM users
         WHERE id::text=$1 AND is_active=true AND bim_workspace_access=true AND bim_workspace_role='staff_bim'
         LIMIT 1`,
        [requestedId]
    );
    if (!user.rows.length) {
        return { error: 'Delegasi hanya dapat diberikan kepada user aktif dengan role Staff BIM', status: 400 };
    }
    return {
        picId: user.rows[0].id,
        picName: user.rows[0].username,
        delegated: true
    };
}

async function seedKpiCatalog() {
    for (const scorecard of KPI_SCORECARDS) {
        await pool.query(
            `INSERT INTO bim_kpi_scorecards
             (id,period_year,level,org_unit,title,status,max_achievement,source_reference)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (id) DO UPDATE SET
                period_year=EXCLUDED.period_year,
                level=EXCLUDED.level,
                org_unit=EXCLUDED.org_unit,
                title=EXCLUDED.title,
                status=EXCLUDED.status,
                max_achievement=EXCLUDED.max_achievement,
                source_reference=EXCLUDED.source_reference,
                updated_at=CURRENT_TIMESTAMP`,
            [scorecard.id, scorecard.periodYear, scorecard.level, scorecard.orgUnit, scorecard.title,
             scorecard.status, scorecard.maxAchievement, scorecard.sourceReference]
        );
        await pool.query(`UPDATE bim_kpi_indicators SET is_active=false,updated_at=CURRENT_TIMESTAMP WHERE scorecard_id=$1`, [scorecard.id]);
        for (const item of scorecard.indicators) {
            await pool.query(
                `INSERT INTO bim_kpi_indicators
                 (id,scorecard_id,parent_indicator_id,code,sort_order,perspective_code,perspective_name,
                  indicator_name,program_name,relation_type,measurement_formula,achievement_formula,
                  aggregation_method,zero_denominator_policy,target_operator,target_value,target_unit,
                  weight,calculation_config,source_reference,is_active)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20,true)
                 ON CONFLICT (id) DO UPDATE SET
                    scorecard_id=EXCLUDED.scorecard_id,
                    parent_indicator_id=EXCLUDED.parent_indicator_id,
                    code=EXCLUDED.code,
                    sort_order=EXCLUDED.sort_order,
                    perspective_code=EXCLUDED.perspective_code,
                    perspective_name=EXCLUDED.perspective_name,
                    indicator_name=EXCLUDED.indicator_name,
                    program_name=EXCLUDED.program_name,
                    relation_type=EXCLUDED.relation_type,
                    measurement_formula=EXCLUDED.measurement_formula,
                    achievement_formula=EXCLUDED.achievement_formula,
                    aggregation_method=EXCLUDED.aggregation_method,
                    zero_denominator_policy=EXCLUDED.zero_denominator_policy,
                    target_operator=EXCLUDED.target_operator,
                    target_value=EXCLUDED.target_value,
                    target_unit=EXCLUDED.target_unit,
                    weight=EXCLUDED.weight,
                    calculation_config=EXCLUDED.calculation_config,
                    source_reference=EXCLUDED.source_reference,
                    is_active=true,
                    updated_at=CURRENT_TIMESTAMP`,
                [item.id, scorecard.id, item.parentIndicatorId || null, item.code, item.sortOrder,
                 item.perspectiveCode, item.perspectiveName, item.name, item.programName || null,
                 item.relationType || 'official', item.measurementFormula, item.achievementFormula,
                 item.aggregationMethod, item.zeroDenominatorPolicy, item.targetOperator, item.targetValue,
                 item.targetUnit, item.weight, JSON.stringify(item.calculationConfig), item.sourceReference]
            );
        }
    }

    for (const program of KPI_PROGRAMS) {
        await pool.query(
            `INSERT INTO bim_kpi_programs
             (id,period_year,division_indicator_id,code,sort_order,program_name,allocation_mode,claim_policy,
              availability_status,target_value,target_unit,is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
             ON CONFLICT (id) DO UPDATE SET
                period_year=EXCLUDED.period_year,
                division_indicator_id=EXCLUDED.division_indicator_id,
                code=EXCLUDED.code,
                sort_order=EXCLUDED.sort_order,
                program_name=EXCLUDED.program_name,
                allocation_mode=EXCLUDED.allocation_mode,
                claim_policy=EXCLUDED.claim_policy,
                is_active=true,
                updated_at=CURRENT_TIMESTAMP`,
            [program.id, program.periodYear, program.divisionIndicatorId, program.code, program.sortOrder,
             program.name, program.allocationMode, program.claimPolicy, program.availabilityStatus,
             program.targetValue, program.targetUnit]
        );
    }
}

async function ensureTables() {
    if (!ensureTablesPromise) {
        ensureTablesPromise = (async () => {
            await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bim_workspace_access BOOLEAN DEFAULT false`);
            await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bim_workspace_role TEXT DEFAULT 'viewer'`);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS bim_ops_tasks (
                    id TEXT PRIMARY KEY,
                    period_month TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    project_name TEXT,
                    task_type TEXT NOT NULL DEFAULT 'project_task',
                    official_owner_name TEXT NOT NULL DEFAULT 'Kepala Divisi BIM',
                    pic_user_id TEXT,
                    pic_name_snapshot TEXT,
                    delegated_by_user_id TEXT,
                    delegated_by_name_snapshot TEXT,
                    delegated_at TIMESTAMPTZ,
                    start_date DATE,
                    due_date DATE,
                    priority TEXT NOT NULL DEFAULT 'normal',
                    intake_status TEXT NOT NULL DEFAULT 'draft',
                    status TEXT NOT NULL DEFAULT 'planned',
                    progress_percent NUMERIC(5,2) DEFAULT 0,
                    intake_submitted_at TIMESTAMPTZ,
                    intake_reviewed_by_user_id TEXT,
                    intake_reviewed_by_name_snapshot TEXT,
                    intake_reviewed_at TIMESTAMPTZ,
                    intake_review_note TEXT,
                    completion_submitted_at TIMESTAMPTZ,
                    approved_by_user_id TEXT,
                    approved_by_name_snapshot TEXT,
                    approved_at TIMESTAMPTZ,
                    review_note TEXT,
                    is_routine BOOLEAN DEFAULT false,
                    carried_from_task_id TEXT REFERENCES bim_ops_tasks(id) ON DELETE SET NULL,
                    source_type TEXT DEFAULT 'manual',
                    source_id TEXT,
                    evidence_link TEXT,
                    created_by_user_id TEXT NOT NULL,
                    created_by_name_snapshot TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMPTZ
                )
            `);
            await pool.query(`ALTER TABLE bim_ops_tasks ADD COLUMN IF NOT EXISTS delegated_by_user_id TEXT`);
            await pool.query(`ALTER TABLE bim_ops_tasks ADD COLUMN IF NOT EXISTS delegated_by_name_snapshot TEXT`);
            await pool.query(`ALTER TABLE bim_ops_tasks ADD COLUMN IF NOT EXISTS delegated_at TIMESTAMPTZ`);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS bim_ops_worklogs (
                    id TEXT PRIMARY KEY,
                    work_date DATE NOT NULL,
                    period_month TEXT NOT NULL,
                    task_id TEXT REFERENCES bim_ops_tasks(id) ON DELETE SET NULL,
                    task_item_text TEXT NOT NULL,
                    project_name TEXT,
                    pic_user_id TEXT NOT NULL,
                    pic_name_snapshot TEXT NOT NULL,
                    worklog_type TEXT DEFAULT 'progress_update',
                    task_status TEXT,
                    hours_spent NUMERIC(6,2) NOT NULL DEFAULT 0,
                    work_summary TEXT NOT NULL,
                    output_result TEXT,
                    blocker TEXT,
                    next_action TEXT,
                    evidence_link TEXT,
                    remarks TEXT,
                    created_by_user_id TEXT NOT NULL,
                    created_by_name_snapshot TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS bim_ops_meetings (
                    id TEXT PRIMARY KEY,
                    meeting_no TEXT NOT NULL UNIQUE,
                    period_month TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    scope_type TEXT DEFAULT 'kantor',
                    project_name TEXT,
                    meeting_date DATE NOT NULL,
                    start_time TIME,
                    end_time TIME,
                    place TEXT,
                    reported_by_name TEXT,
                    reported_by_position TEXT,
                    acknowledged_by_name TEXT,
                    acknowledged_by_position TEXT,
                    department_division TEXT DEFAULT 'Engineering / BIM',
                    reference_memo_no TEXT,
                    reference_agenda_no TEXT,
                    reference_archive_no TEXT,
                    status TEXT NOT NULL DEFAULT 'draft',
                    revision_no INTEGER DEFAULT 0,
                    created_by_user_id TEXT NOT NULL,
                    created_by_name_snapshot TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    issued_at TIMESTAMPTZ,
                    closed_at TIMESTAMPTZ
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS bim_ops_meeting_attendees (
                    id TEXT PRIMARY KEY,
                    meeting_id TEXT NOT NULL REFERENCES bim_ops_meetings(id) ON DELETE CASCADE,
                    user_id TEXT,
                    name TEXT NOT NULL,
                    initial TEXT,
                    attendance_status TEXT NOT NULL DEFAULT 'present',
                    position TEXT,
                    company_or_division TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS bim_ops_meeting_actions (
                    id TEXT PRIMARY KEY,
                    meeting_id TEXT NOT NULL REFERENCES bim_ops_meetings(id) ON DELETE CASCADE,
                    carried_from_action_id TEXT REFERENCES bim_ops_meeting_actions(id) ON DELETE SET NULL,
                    section_type TEXT NOT NULL DEFAULT 'current',
                    description TEXT NOT NULL,
                    action_owner_name TEXT,
                    action_owner_user_id TEXT,
                    planned_due_date DATE,
                    reviewer_name TEXT,
                    reviewer_user_id TEXT,
                    review_note TEXT,
                    review_date DATE,
                    status TEXT NOT NULL DEFAULT 'open',
                    created_task_id TEXT REFERENCES bim_ops_tasks(id) ON DELETE SET NULL,
                    evidence_link TEXT,
                    created_by_user_id TEXT NOT NULL,
                    created_by_name_snapshot TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    closed_at TIMESTAMPTZ
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS bim_ops_issues (
                    id TEXT PRIMARY KEY,
                    issue_date DATE NOT NULL,
                    period_month TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    issue_type TEXT NOT NULL DEFAULT 'internal_issue',
                    project_context TEXT,
                    severity TEXT NOT NULL DEFAULT 'medium',
                    status TEXT NOT NULL DEFAULT 'draft',
                    reported_by_user_id TEXT NOT NULL,
                    reported_by_name_snapshot TEXT NOT NULL,
                    owner_user_id TEXT,
                    owner_name_snapshot TEXT,
                    due_date DATE,
                    impact_note TEXT,
                    action_note TEXT,
                    mitigation_note TEXT,
                    resolution_note TEXT,
                    evidence_link TEXT,
                    source_type TEXT DEFAULT 'manual',
                    source_id TEXT,
                    created_task_id TEXT REFERENCES bim_ops_tasks(id) ON DELETE SET NULL,
                    submitted_at TIMESTAMPTZ,
                    accepted_by_user_id TEXT,
                    accepted_by_name_snapshot TEXT,
                    accepted_at TIMESTAMPTZ,
                    acceptance_note TEXT,
                    rejection_reason TEXT,
                    closure_requested_by_user_id TEXT,
                    closure_requested_at TIMESTAMPTZ,
                    closure_note TEXT,
                    closed_by_user_id TEXT,
                    closed_by_name_snapshot TEXT,
                    closed_at TIMESTAMPTZ,
                    closure_approval_note TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS bim_ops_activity_log (
                    id BIGSERIAL PRIMARY KEY,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    summary TEXT,
                    metadata_json JSONB DEFAULT '{}'::jsonb,
                    actor_user_id TEXT,
                    actor_name_snapshot TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS bim_kpi_scorecards (
                    id TEXT PRIMARY KEY,
                    period_year INTEGER NOT NULL,
                    level TEXT NOT NULL,
                    org_unit TEXT NOT NULL,
                    title TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'reference',
                    max_achievement NUMERIC(5,4) NOT NULL DEFAULT 1.2,
                    source_reference TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(period_year, level, org_unit)
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS bim_kpi_indicators (
                    id TEXT PRIMARY KEY,
                    scorecard_id TEXT NOT NULL REFERENCES bim_kpi_scorecards(id) ON DELETE CASCADE,
                    parent_indicator_id TEXT REFERENCES bim_kpi_indicators(id) ON DELETE SET NULL,
                    code TEXT NOT NULL,
                    sort_order INTEGER NOT NULL,
                    perspective_code TEXT NOT NULL,
                    perspective_name TEXT NOT NULL,
                    indicator_name TEXT NOT NULL,
                    program_name TEXT,
                    relation_type TEXT NOT NULL DEFAULT 'official',
                    measurement_formula TEXT NOT NULL,
                    achievement_formula TEXT NOT NULL,
                    aggregation_method TEXT NOT NULL,
                    zero_denominator_policy TEXT NOT NULL DEFAULT 'not_measured',
                    target_operator TEXT NOT NULL DEFAULT '>=',
                    target_value NUMERIC(14,6) NOT NULL,
                    target_unit TEXT NOT NULL,
                    weight NUMERIC(10,6) NOT NULL,
                    calculation_config JSONB NOT NULL DEFAULT '{}'::jsonb,
                    source_reference TEXT,
                    is_active BOOLEAN NOT NULL DEFAULT true,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(scorecard_id, code)
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS bim_kpi_programs (
                    id TEXT PRIMARY KEY,
                    period_year INTEGER NOT NULL,
                    division_indicator_id TEXT NOT NULL REFERENCES bim_kpi_indicators(id) ON DELETE CASCADE,
                    code TEXT NOT NULL,
                    sort_order INTEGER NOT NULL,
                    program_name TEXT NOT NULL,
                    allocation_mode TEXT NOT NULL,
                    claim_policy TEXT NOT NULL DEFAULT 'staff_proposable',
                    availability_status TEXT NOT NULL DEFAULT 'closed',
                    target_value NUMERIC(14,4),
                    target_unit TEXT NOT NULL DEFAULT 'item',
                    is_active BOOLEAN NOT NULL DEFAULT true,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(period_year, code),
                    UNIQUE(period_year, division_indicator_id)
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS bim_kpi_individual_scorecards (
                    id TEXT PRIMARY KEY,
                    period_year INTEGER NOT NULL,
                    staff_user_id TEXT NOT NULL,
                    staff_name_snapshot TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'draft',
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(period_year, staff_user_id)
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS bim_kpi_assignments (
                    id TEXT PRIMARY KEY,
                    scorecard_id TEXT NOT NULL REFERENCES bim_kpi_individual_scorecards(id) ON DELETE CASCADE,
                    program_id TEXT NOT NULL REFERENCES bim_kpi_programs(id) ON DELETE RESTRICT,
                    division_indicator_id TEXT NOT NULL REFERENCES bim_kpi_indicators(id) ON DELETE RESTRICT,
                    staff_user_id TEXT NOT NULL,
                    staff_name_snapshot TEXT NOT NULL,
                    commitment_title TEXT NOT NULL,
                    measurement_type TEXT NOT NULL DEFAULT 'quantity',
                    target_value NUMERIC(14,4) NOT NULL,
                    target_unit TEXT NOT NULL,
                    proposed_weight NUMERIC(8,6) NOT NULL DEFAULT 0,
                    approved_weight NUMERIC(8,6),
                    due_date DATE,
                    expected_evidence TEXT,
                    status TEXT NOT NULL DEFAULT 'pending_approval',
                    submitted_actual NUMERIC(14,4),
                    actual_evidence_link TEXT,
                    actual_note TEXT,
                    verified_actual NUMERIC(14,4),
                    achievement NUMERIC(8,6),
                    weighted_score NUMERIC(8,6),
                    review_note TEXT,
                    created_by_user_id TEXT NOT NULL,
                    created_by_name_snapshot TEXT NOT NULL,
                    delegated_by_user_id TEXT,
                    delegated_by_name_snapshot TEXT,
                    approved_by_user_id TEXT,
                    approved_by_name_snapshot TEXT,
                    approved_at TIMESTAMPTZ,
                    verified_by_user_id TEXT,
                    verified_by_name_snapshot TEXT,
                    verified_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(scorecard_id, program_id)
                )
            `);

            await pool.query(`ALTER TABLE bim_ops_tasks ADD COLUMN IF NOT EXISTS kpi_assignment_id TEXT REFERENCES bim_kpi_assignments(id) ON DELETE SET NULL`);

            await pool.query(`ALTER TABLE bim_ops_worklogs ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual'`);
            await pool.query(`ALTER TABLE bim_ops_worklogs ADD COLUMN IF NOT EXISTS source_id TEXT`);
            await pool.query(`ALTER TABLE bim_ops_worklogs ADD COLUMN IF NOT EXISTS kpi_assignment_id TEXT REFERENCES bim_kpi_assignments(id) ON DELETE SET NULL`);
            await pool.query(`ALTER TABLE bim_ops_worklogs ADD COLUMN IF NOT EXISTS issue_id TEXT REFERENCES bim_ops_issues(id) ON DELETE SET NULL`);
            await pool.query(`ALTER TABLE bim_ops_worklogs ADD COLUMN IF NOT EXISTS meeting_action_id TEXT REFERENCES bim_ops_meeting_actions(id) ON DELETE SET NULL`);
            await pool.query(`ALTER TABLE bim_ops_worklogs ADD COLUMN IF NOT EXISTS entry_origin TEXT NOT NULL DEFAULT 'manual'`);
            await pool.query(`ALTER TABLE bim_ops_worklogs ADD COLUMN IF NOT EXISTS confirmation_status TEXT NOT NULL DEFAULT 'confirmed'`);
            await pool.query(`ALTER TABLE bim_ops_worklogs ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ`);
            await pool.query(`ALTER TABLE bim_ops_worklogs ADD COLUMN IF NOT EXISTS progress_before NUMERIC(5,2)`);
            await pool.query(`ALTER TABLE bim_ops_worklogs ADD COLUMN IF NOT EXISTS progress_after NUMERIC(5,2)`);
            await pool.query(`ALTER TABLE bim_ops_worklogs ADD COLUMN IF NOT EXISTS system_summary TEXT`);
            await pool.query(`ALTER TABLE bim_ops_worklogs ADD COLUMN IF NOT EXISTS event_count INTEGER NOT NULL DEFAULT 0`);
            await pool.query(`ALTER TABLE bim_ops_worklogs ADD COLUMN IF NOT EXISTS auto_key TEXT`);
            await pool.query(`UPDATE bim_ops_worklogs SET confirmed_at=COALESCE(confirmed_at,created_at) WHERE confirmation_status='confirmed'`);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS bim_ops_worklog_time (
                    worklog_id TEXT NOT NULL REFERENCES bim_ops_worklogs(id) ON DELETE CASCADE,
                    user_id TEXT NOT NULL,
                    hours_spent NUMERIC(6,2) NOT NULL DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY(worklog_id, user_id)
                )
            `);
            await pool.query(`
                INSERT INTO bim_ops_worklog_time (worklog_id,user_id,hours_spent)
                SELECT id,pic_user_id,hours_spent
                FROM bim_ops_worklogs
                WHERE hours_spent > 0
                ON CONFLICT (worklog_id,user_id) DO NOTHING
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS bim_ops_activity_events (
                    id TEXT PRIMARY KEY,
                    event_type TEXT NOT NULL,
                    activity_class TEXT NOT NULL,
                    source_type TEXT NOT NULL,
                    source_id TEXT NOT NULL,
                    actor_user_id TEXT,
                    actor_name_snapshot TEXT,
                    pic_user_id TEXT,
                    pic_name_snapshot TEXT,
                    project_context TEXT,
                    event_date DATE NOT NULL,
                    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    summary TEXT NOT NULL,
                    output_snapshot TEXT,
                    progress_snapshot NUMERIC(5,2),
                    status_snapshot TEXT,
                    evidence_link TEXT,
                    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                    deduplication_key TEXT NOT NULL UNIQUE,
                    counts_as_work BOOLEAN NOT NULL DEFAULT false,
                    consolidated_worklog_id TEXT REFERENCES bim_ops_worklogs(id) ON DELETE SET NULL,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                )
            `);

            const indexes = [
                `CREATE INDEX IF NOT EXISTS idx_bim_tasks_period_status ON bim_ops_tasks(period_month, status)`,
                `CREATE INDEX IF NOT EXISTS idx_bim_tasks_pic ON bim_ops_tasks(pic_user_id)`,
                `CREATE INDEX IF NOT EXISTS idx_bim_worklogs_period_pic ON bim_ops_worklogs(period_month, pic_user_id)`,
                `CREATE INDEX IF NOT EXISTS idx_bim_meetings_period ON bim_ops_meetings(period_month, meeting_date)`,
                `CREATE INDEX IF NOT EXISTS idx_bim_actions_status ON bim_ops_meeting_actions(status, planned_due_date)`,
                `CREATE INDEX IF NOT EXISTS idx_bim_issues_period_status ON bim_ops_issues(period_month, status)`,
                `CREATE INDEX IF NOT EXISTS idx_bim_activity_created ON bim_ops_activity_log(created_at DESC)`,
                `CREATE INDEX IF NOT EXISTS idx_bim_kpi_scorecards_year ON bim_kpi_scorecards(period_year, level)`,
                `CREATE INDEX IF NOT EXISTS idx_bim_kpi_indicators_card ON bim_kpi_indicators(scorecard_id, sort_order)`,
                `CREATE INDEX IF NOT EXISTS idx_bim_kpi_programs_year ON bim_kpi_programs(period_year, sort_order)`,
                `CREATE INDEX IF NOT EXISTS idx_bim_kpi_assignments_staff ON bim_kpi_assignments(staff_user_id, status)`,
                `CREATE INDEX IF NOT EXISTS idx_bim_tasks_kpi_assignment ON bim_ops_tasks(kpi_assignment_id)`,
                `CREATE UNIQUE INDEX IF NOT EXISTS idx_bim_worklogs_auto_key ON bim_ops_worklogs(auto_key) WHERE auto_key IS NOT NULL`,
                `CREATE INDEX IF NOT EXISTS idx_bim_worklogs_source ON bim_ops_worklogs(source_type, source_id, work_date)`,
                `CREATE INDEX IF NOT EXISTS idx_bim_activity_events_period_pic ON bim_ops_activity_events(event_date, pic_user_id)`,
                `CREATE INDEX IF NOT EXISTS idx_bim_activity_events_source ON bim_ops_activity_events(source_type, source_id, occurred_at DESC)`
            ];
            for (const sql of indexes) await pool.query(sql);
            await seedKpiCatalog();
        })().catch((error) => {
            ensureTablesPromise = null;
            throw error;
        });
    }
    return ensureTablesPromise;
}

function classifyOperationalEvent(entityType, action, snapshot = {}) {
    if (entityType === 'task') {
        if (['updated', 'completion_submitted'].includes(action)) return 'execution';
        if (['approved', 'revision_requested'].includes(action) || action.startsWith('intake_')) return 'verification';
        return 'planning';
    }
    if (entityType === 'kpi_assignment') {
        if (action === 'actual_submitted') return 'execution';
        if (action === 'actual_verified' || action.startsWith('review_')) return 'verification';
        return 'planning';
    }
    if (entityType === 'issue') {
        if (['updated', 'closure_requested', 'reopened'].includes(action)) return 'execution';
        if (['accept', 'reject', 'closed'].includes(action)) return 'verification';
        return 'planning';
    }
    if (entityType === 'meeting_action') {
        if (action === 'updated' && !['closed', 'cancelled'].includes(snapshot.status || '')) return 'execution';
        return action === 'updated' ? 'verification' : 'planning';
    }
    if (entityType === 'worklog') return 'execution';
    if (entityType === 'meeting' && ['issued', 'closed'].includes(action)) return 'verification';
    return 'planning';
}

async function loadOperationalSource(entityType, entityId) {
    if (entityType === 'task') {
        const result = await pool.query(
            `SELECT id,title AS item_text,project_name AS project_context,pic_user_id,pic_name_snapshot,
                    status,progress_percent,evidence_link,NULL::text AS output_result
             FROM bim_ops_tasks WHERE id=$1`, [entityId]
        );
        return result.rows[0] || null;
    }
    if (entityType === 'kpi_assignment') {
        const result = await pool.query(
            `SELECT a.id,a.commitment_title AS item_text,p.program_name AS project_context,
                    a.staff_user_id AS pic_user_id,a.staff_name_snapshot AS pic_name_snapshot,
                    a.status,a.achievement * 100 AS progress_percent,a.actual_evidence_link AS evidence_link,
                    a.actual_note AS output_result
             FROM bim_kpi_assignments a
             JOIN bim_kpi_programs p ON p.id=a.program_id
             WHERE a.id=$1`, [entityId]
        );
        return result.rows[0] || null;
    }
    if (entityType === 'issue') {
        const result = await pool.query(
            `SELECT id,title AS item_text,project_context,
                    COALESCE(owner_user_id,reported_by_user_id) AS pic_user_id,
                    COALESCE(owner_name_snapshot,reported_by_name_snapshot) AS pic_name_snapshot,
                    status,NULL::numeric AS progress_percent,evidence_link,resolution_note AS output_result
             FROM bim_ops_issues WHERE id=$1`, [entityId]
        );
        return result.rows[0] || null;
    }
    if (entityType === 'meeting_action') {
        const result = await pool.query(
            `SELECT a.id,a.description AS item_text,
                    COALESCE(NULLIF(m.project_name,''),m.subject) AS project_context,
                    a.action_owner_user_id AS pic_user_id,a.action_owner_name AS pic_name_snapshot,
                    a.status,NULL::numeric AS progress_percent,a.evidence_link,a.review_note AS output_result
             FROM bim_ops_meeting_actions a
             JOIN bim_ops_meetings m ON m.id=a.meeting_id
             WHERE a.id=$1`, [entityId]
        );
        return result.rows[0] || null;
    }
    if (entityType === 'worklog') {
        const result = await pool.query(
            `SELECT id,task_item_text AS item_text,project_name AS project_context,pic_user_id,pic_name_snapshot,
                    task_status AS status,progress_after AS progress_percent,evidence_link,output_result
             FROM bim_ops_worklogs WHERE id=$1`, [entityId]
        );
        return result.rows[0] || null;
    }
    if (entityType === 'meeting') {
        const result = await pool.query(
            `SELECT id,subject AS item_text,project_name AS project_context,NULL::text AS pic_user_id,
                    NULL::text AS pic_name_snapshot,status,NULL::numeric AS progress_percent,
                    NULL::text AS evidence_link,NULL::text AS output_result
             FROM bim_ops_meetings WHERE id=$1`, [entityId]
        );
        return result.rows[0] || null;
    }
    return null;
}

async function consolidateOperationalEvent(event, snapshot, metadata, req) {
    if (!event.countsAsWork || !snapshot?.pic_user_id || event.sourceType === 'worklog') return null;
    const autoKey = `${event.eventDate}:${snapshot.pic_user_id}:${event.sourceType}:${event.sourceId}`;
    const taskId = event.sourceType === 'task' ? event.sourceId : null;
    const kpiAssignmentId = event.sourceType === 'kpi_assignment' ? event.sourceId : null;
    const issueId = event.sourceType === 'issue' ? event.sourceId : null;
    const meetingActionId = event.sourceType === 'meeting_action' ? event.sourceId : null;
    const previousProgress = Number.isFinite(Number(metadata.previousProgress)) ? Number(metadata.previousProgress) : null;
    const currentProgress = Number.isFinite(Number(snapshot.progress_percent)) ? Number(snapshot.progress_percent) : null;
    const id = newId('worklog');
    const result = await pool.query(
        `INSERT INTO bim_ops_worklogs
         (id,work_date,period_month,task_id,task_item_text,project_name,pic_user_id,pic_name_snapshot,
          worklog_type,task_status,hours_spent,work_summary,output_result,evidence_link,
          created_by_user_id,created_by_name_snapshot,source_type,source_id,kpi_assignment_id,issue_id,
          meeting_action_id,entry_origin,confirmation_status,progress_before,progress_after,system_summary,event_count,auto_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                 'auto','auto_draft',$21,$22,$11,1,$23)
         ON CONFLICT (auto_key) WHERE auto_key IS NOT NULL DO UPDATE SET
             task_status=EXCLUDED.task_status,
             output_result=CASE WHEN bim_ops_worklogs.confirmation_status='auto_draft'
                                THEN COALESCE(NULLIF(EXCLUDED.output_result,''),bim_ops_worklogs.output_result)
                                ELSE bim_ops_worklogs.output_result END,
             evidence_link=COALESCE(NULLIF(EXCLUDED.evidence_link,''),bim_ops_worklogs.evidence_link),
             progress_before=COALESCE(bim_ops_worklogs.progress_before,EXCLUDED.progress_before),
             progress_after=COALESCE(EXCLUDED.progress_after,bim_ops_worklogs.progress_after),
             system_summary=EXCLUDED.system_summary,
             work_summary=CASE WHEN bim_ops_worklogs.confirmation_status='auto_draft'
                               THEN EXCLUDED.work_summary ELSE bim_ops_worklogs.work_summary END,
             event_count=bim_ops_worklogs.event_count+1,
             updated_at=CURRENT_TIMESTAMP
         RETURNING id`,
        [id,event.eventDate,event.eventDate.slice(0,7),taskId,snapshot.item_text,event.projectContext,
         snapshot.pic_user_id,snapshot.pic_name_snapshot,event.eventType,snapshot.status,event.summary,
         snapshot.output_result,snapshot.evidence_link,actorId(req),actorName(req),event.sourceType,event.sourceId,
         kpiAssignmentId,issueId,meetingActionId,previousProgress,currentProgress,autoKey]
    );
    return result.rows[0]?.id || null;
}

async function recordOperationalEvent(req, auditRow, entityType, entityId, action, summary, metadata) {
    const snapshot = await loadOperationalSource(entityType, entityId);
    if (!snapshot) return;
    const activityClass = classifyOperationalEvent(entityType, action, snapshot);
    const sourcePicId = String(snapshot.pic_user_id || '');
    const countsAsWork = activityClass === 'execution' && !!sourcePicId && sourcePicId === actorId(req);
    const eventDate = dateOnly(auditRow.created_at || new Date());
    const event = {
        id: newId('event'),
        eventType: `${entityType}.${action}`,
        activityClass,
        sourceType: entityType,
        sourceId: entityId,
        eventDate,
        projectContext: snapshot.project_context || '',
        summary: trimText(summary, 1000) || snapshot.item_text,
        countsAsWork
    };
    const consolidatedWorklogId = entityType === 'worklog'
        ? entityId
        : await consolidateOperationalEvent(event, snapshot, metadata || {}, req);
    await pool.query(
        `INSERT INTO bim_ops_activity_events
         (id,event_type,activity_class,source_type,source_id,actor_user_id,actor_name_snapshot,
          pic_user_id,pic_name_snapshot,project_context,event_date,occurred_at,summary,output_snapshot,
          progress_snapshot,status_snapshot,evidence_link,metadata_json,deduplication_key,counts_as_work,
          consolidated_worklog_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,$21)
         ON CONFLICT (deduplication_key) DO NOTHING`,
        [event.id,event.eventType,event.activityClass,event.sourceType,event.sourceId,actorId(req),actorName(req),
         snapshot.pic_user_id,snapshot.pic_name_snapshot,event.projectContext,event.eventDate,auditRow.created_at,
         event.summary,snapshot.output_result,snapshot.progress_percent,snapshot.status,snapshot.evidence_link,
         JSON.stringify(metadata || {}),`activity:${auditRow.id}`,event.countsAsWork,consolidatedWorklogId]
    );
}

async function logActivity(req, entityType, entityId, action, summary, metadata = {}) {
    const result = await pool.query(
        `INSERT INTO bim_ops_activity_log
         (entity_type, entity_id, action, summary, metadata_json, actor_user_id, actor_name_snapshot)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
         RETURNING id,created_at`,
        [entityType, entityId, action, trimText(summary, 1000), JSON.stringify(metadata || {}), actorId(req), actorName(req)]
    );
    try {
        await recordOperationalEvent(req, result.rows[0], entityType, entityId, action, summary, metadata);
    } catch (error) {
        console.warn(`WARN: Operational event generation failed for ${entityType}/${entityId}:`, error.message);
    }
}

async function requireWorkspace(req, res, next) {
    try {
        await ensureTables();
        const hasBearerToken = String(req.headers.authorization || '').startsWith('Bearer ');
        const authUser = hasBearerToken ? getBearerRequestUser(req) : getRequestUser(req);
        if (!authUser) return res.status(401).json({ error: 'Authentication required' });
        const identityResult = await pool.query(
            `SELECT id::text,username,email,job_role,mapping_kompetensi_access,dokumen_access,audit_2026_access,
                    library_download_access,watermark_free_download_access,bim_workspace_access,bim_workspace_role
             FROM users
             WHERE ($1::text IS NOT NULL AND id::text=$1::text)
                OR ($2::text IS NOT NULL AND lower(email)=lower($2::text))
             ORDER BY CASE WHEN id::text=$1::text THEN 0 ELSE 1 END
             LIMIT 1`,
            [authUser.id ? String(authUser.id) : null, authUser.email || null]
        );
        const storedUser = identityResult.rows[0] || null;
        const storedProfile = storedUser ? normalizeAccessProfile(storedUser) : null;
        const profile = storedProfile?.bimWorkspaceAccess ? storedProfile : await resolveAccessProfile(authUser);
        if (!profile.bimWorkspaceAccess && !authUser.isAdmin) return res.status(403).json({ error: 'Divisi BIM Workspace access required' });
        const hasStoredWorkspaceRole = !!storedUser && !!storedProfile?.bimWorkspaceAccess;
        const role = hasStoredWorkspaceRole
            ? normalizeEnum(storedProfile.bimWorkspaceRole, WORKSPACE_ROLES, 'viewer')
            : authUser.isAdmin ? 'system_admin' : normalizeEnum(profile.bimWorkspaceRole, WORKSPACE_ROLES, 'viewer');
        const workspaceUser = storedUser ? {
            ...authUser,
            id: storedUser.id,
            username: storedUser.username || authUser.username,
            email: storedUser.email || authUser.email,
            role: storedUser.job_role || authUser.role
        } : authUser;
        req.authUser = authUser;
        req.workspaceUser = workspaceUser;
        req.workspaceRole = role;
        req.workspaceProfile = profile;
        next();
    } catch (error) {
        console.error('ERROR: Workspace access check failed:', error);
        res.status(503).json({ error: 'Workspace database is unavailable' });
    }
}

router.use(requireWorkspace);

route('get', '/access/me', (req, res) => {
    res.json({
        hasAccess: true,
        role: req.workspaceRole,
        user: { id: actorId(req), name: actorName(req), email: req.workspaceUser.email || '' },
        permissions: {
            canWrite: canWrite(req),
            canApprove: isDivisionHead(req),
            canConfigure: canManageTechnical(req),
            canExport: req.workspaceRole !== 'viewer'
        }
    });
});

route('get', '/users', async (req, res) => {
    if (!canWrite(req)) return res.json([]);
    const result = await pool.query(
        `SELECT id::text, username, email, job_role, bim_workspace_role
         FROM users WHERE is_active = true AND bim_workspace_access = true
         ORDER BY username`
    );
    res.json(result.rows.map((row) => ({
        id: row.id,
        username: row.username,
        email: row.email,
        jobRole: row.job_role || '',
        workspaceRole: row.bim_workspace_role || 'viewer'
    })));
});

function mapKpiIndicator(row) {
    return {
        id: row.id,
        parentIndicatorId: row.parent_indicator_id || null,
        parentIndicatorName: row.parent_indicator_name || '',
        code: row.code,
        sortOrder: Number(row.sort_order),
        perspectiveCode: row.perspective_code,
        perspectiveName: row.perspective_name,
        name: row.indicator_name,
        programName: row.program_name || '',
        relationType: row.relation_type,
        measurementFormula: row.measurement_formula,
        achievementFormula: row.achievement_formula,
        aggregationMethod: row.aggregation_method,
        zeroDenominatorPolicy: row.zero_denominator_policy,
        targetOperator: row.target_operator,
        targetValue: Number(row.target_value),
        targetUnit: row.target_unit,
        weight: Number(row.weight),
        calculationConfig: row.calculation_config || {},
        sourceReference: row.source_reference || ''
    };
}

function mapKpiAssignment(row) {
    return {
        id: row.id,
        scorecardId: row.scorecard_id,
        programId: row.program_id,
        programCode: row.program_code || '',
        programName: row.program_name || '',
        indicatorId: row.division_indicator_id,
        indicatorCode: row.indicator_code || '',
        indicatorName: row.indicator_name || '',
        staffUserId: row.staff_user_id,
        staffName: row.staff_name_snapshot,
        title: row.commitment_title,
        measurementType: row.measurement_type,
        targetValue: Number(row.target_value),
        targetUnit: row.target_unit,
        proposedWeight: Number(row.proposed_weight || 0),
        approvedWeight: row.approved_weight == null ? null : Number(row.approved_weight),
        dueDate: row.due_date,
        expectedEvidence: row.expected_evidence || '',
        status: row.status,
        submittedActual: row.submitted_actual == null ? null : Number(row.submitted_actual),
        actualEvidenceLink: row.actual_evidence_link || '',
        actualNote: row.actual_note || '',
        verifiedActual: row.verified_actual == null ? null : Number(row.verified_actual),
        achievement: row.achievement == null ? null : Number(row.achievement),
        weightedScore: row.weighted_score == null ? null : Number(row.weighted_score),
        reviewNote: row.review_note || '',
        taskCount: Number(row.task_count || 0),
        completedTaskCount: Number(row.completed_task_count || 0),
        createdByName: row.created_by_name_snapshot,
        delegatedByName: row.delegated_by_name_snapshot || '',
        approvedByName: row.approved_by_name_snapshot || '',
        verifiedByName: row.verified_by_name_snapshot || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function loadKpiOperations(year) {
    const [programResult, assignmentResult] = await Promise.all([
        pool.query(
            `SELECT p.*,i.code AS indicator_code,i.indicator_name,i.weight AS indicator_weight,
                    i.relation_type,i.aggregation_method
             FROM bim_kpi_programs p
             JOIN bim_kpi_indicators i ON i.id=p.division_indicator_id
             WHERE p.period_year=$1 AND p.is_active=true
             ORDER BY p.sort_order`,
            [year]
        ),
        pool.query(
            `SELECT a.*,p.code AS program_code,p.program_name,i.code AS indicator_code,i.indicator_name,
                    COUNT(t.id)::int AS task_count,
                    COUNT(t.id) FILTER (WHERE t.status='approved_done')::int AS completed_task_count
             FROM bim_kpi_assignments a
             JOIN bim_kpi_individual_scorecards s ON s.id=a.scorecard_id
             JOIN bim_kpi_programs p ON p.id=a.program_id
             JOIN bim_kpi_indicators i ON i.id=a.division_indicator_id
             LEFT JOIN bim_ops_tasks t ON t.kpi_assignment_id=a.id
             WHERE s.period_year=$1
             GROUP BY a.id,p.code,p.program_name,i.code,i.indicator_name
             ORDER BY a.created_at`,
            [year]
        )
    ]);
    const assignments = assignmentResult.rows.map(mapKpiAssignment);
    const activeStatuses = new Set(['approved', 'verification_pending', 'achieved', 'closed']);
    const programs = programResult.rows.map((row) => {
        const items = assignments.filter((item) => item.programId === row.id);
        const active = items.filter((item) => activeStatuses.has(item.status));
        const targetValue = row.target_value == null ? null : Number(row.target_value);
        const allocatedValue = active.reduce((sum, item) => sum + item.targetValue, 0);
        const verifiedValue = active.reduce((sum, item) => sum + (item.verifiedActual || 0), 0);
        let coverageStatus = 'target_required';
        if (targetValue != null && allocatedValue === 0) coverageStatus = 'empty';
        else if (targetValue != null && allocatedValue < targetValue) coverageStatus = 'partial';
        else if (targetValue != null && allocatedValue === targetValue) coverageStatus = 'covered';
        else if (targetValue != null && allocatedValue > targetValue) coverageStatus = 'overallocated';
        let executionStatus = active.length ? 'active' : 'not_started';
        if (active.some((item) => item.status === 'verification_pending')) executionStatus = 'verification';
        if (active.some((item) => item.dueDate && new Date(item.dueDate) < new Date() && !['achieved', 'closed'].includes(item.status))) executionStatus = 'at_risk';
        if (targetValue != null && verifiedValue >= targetValue) executionStatus = 'achieved';
        return {
            id: row.id,
            year: Number(row.period_year),
            code: row.code,
            sortOrder: Number(row.sort_order),
            name: row.program_name,
            indicatorId: row.division_indicator_id,
            indicatorCode: row.indicator_code,
            indicatorName: row.indicator_name,
            indicatorWeight: Number(row.indicator_weight),
            relationType: row.relation_type,
            aggregationMethod: row.aggregation_method,
            allocationMode: row.allocation_mode,
            claimPolicy: row.claim_policy,
            availabilityStatus: row.availability_status,
            targetValue,
            targetUnit: row.target_unit,
            allocatedValue,
            verifiedValue,
            coveragePercent: targetValue ? Math.round((allocatedValue / targetValue) * 100) : null,
            realizationPercent: targetValue ? Math.round((verifiedValue / targetValue) * 100) : null,
            coverageStatus,
            executionStatus,
            assignmentCount: items.length,
            activeAssignmentCount: active.length,
            assignments: items
        };
    });
    const cards = [];
    for (const assignment of assignments) {
        let card = cards.find((item) => item.staffUserId === assignment.staffUserId);
        if (!card) {
            card = { staffUserId: assignment.staffUserId, staffName: assignment.staffName, assignments: [] };
            cards.push(card);
        }
        card.assignments.push(assignment);
    }
    for (const card of cards) {
        const approved = card.assignments.filter((item) => activeStatuses.has(item.status));
        card.approvedWeight = approved.reduce((sum, item) => sum + (item.approvedWeight || 0), 0);
        card.score = approved.reduce((sum, item) => sum + (item.weightedScore || 0), 0);
        card.pendingCount = card.assignments.filter((item) => ['pending_approval', 'verification_pending'].includes(item.status)).length;
    }
    return { programs, assignments, cards };
}

async function resolveKpiStaff(req, requestedUserId) {
    const userId = isKpiManager(req) ? trimText(requestedUserId, 100) : actorId(req);
    if (!userId) return null;
    const result = await pool.query(
        `SELECT id::text,username FROM users
         WHERE id::text=$1 AND is_active=true AND bim_workspace_access=true AND bim_workspace_role='staff_bim' LIMIT 1`,
        [userId]
    );
    return result.rows[0] || null;
}

async function ensureIndividualScorecard(year, staff) {
    const existing = await pool.query(
        `SELECT * FROM bim_kpi_individual_scorecards WHERE period_year=$1 AND staff_user_id=$2`,
        [year, staff.id]
    );
    if (existing.rows.length) return existing.rows[0];
    const id = newId('kpi-card');
    const result = await pool.query(
        `INSERT INTO bim_kpi_individual_scorecards (id,period_year,staff_user_id,staff_name_snapshot,status)
         VALUES ($1,$2,$3,$4,'active') RETURNING *`,
        [id, year, staff.id, staff.username]
    );
    return result.rows[0];
}

async function validateApprovedWeight(scorecardId, assignmentId, weight) {
    const result = await pool.query(
        `SELECT COALESCE(SUM(approved_weight),0) AS total FROM bim_kpi_assignments
         WHERE scorecard_id=$1 AND id<>$2 AND status IN ('approved','verification_pending','achieved','closed')`,
        [scorecardId, assignmentId || '']
    );
    return Number(result.rows[0].total || 0) + weight <= 1.000001;
}

async function resolveKpiTaskLink(req, assignmentId, picUserId) {
    const id = trimText(assignmentId, 120);
    if (!id) return null;
    const result = await pool.query(
        `SELECT id,staff_user_id FROM bim_kpi_assignments
         WHERE id=$1 AND status IN ('approved','verification_pending','achieved','closed')`,
        [id]
    );
    if (!result.rows.length) return { error: 'Kontribusi KPI belum approved atau tidak ditemukan', status: 400 };
    if (String(result.rows[0].staff_user_id) !== String(picUserId)) {
        return { error: 'Kontribusi KPI harus dimiliki oleh PIC task', status: 400 };
    }
    return { id };
}

route('get', '/kpi', async (req, res) => {
    const year = normalizeYear(req.query.year);
    const operations = await loadKpiOperations(year);
    const cardsResult = await pool.query(
        `SELECT id,period_year,level,org_unit,title,status,max_achievement,source_reference
         FROM bim_kpi_scorecards
         WHERE period_year=$1
         ORDER BY CASE level WHEN 'department' THEN 1 WHEN 'division' THEN 2 ELSE 3 END, org_unit`,
        [year]
    );
    const cardIds = cardsResult.rows.map((row) => row.id);
    const indicatorResult = cardIds.length
        ? await pool.query(
            `SELECT i.*,parent.indicator_name AS parent_indicator_name
             FROM bim_kpi_indicators i
             LEFT JOIN bim_kpi_indicators parent ON parent.id=i.parent_indicator_id
             WHERE i.scorecard_id=ANY($1::text[]) AND i.is_active=true
             ORDER BY i.scorecard_id,i.sort_order`,
            [cardIds]
        )
        : { rows: [] };
    const indicatorsByCard = new Map();
    for (const row of indicatorResult.rows) {
        if (!indicatorsByCard.has(row.scorecard_id)) indicatorsByCard.set(row.scorecard_id, []);
        indicatorsByCard.get(row.scorecard_id).push(mapKpiIndicator(row));
    }
    const scorecards = {};
    for (const row of cardsResult.rows) {
        const indicators = indicatorsByCard.get(row.id) || [];
        scorecards[row.level] = {
            id: row.id,
            year: Number(row.period_year),
            level: row.level,
            orgUnit: row.org_unit,
            title: row.title,
            status: row.status,
            maxAchievement: Number(row.max_achievement),
            maxAchievementPercent: Math.round(Number(row.max_achievement) * 100),
            totalWeight: indicators.reduce((sum, item) => sum + item.weight, 0),
            sourceReference: row.source_reference || '',
            indicators
        };
    }
    res.json({
        year,
        calculationContract: {
            achievement: 'MIN(Hasil pengukuran / Target, 120%)',
            weightedScore: 'SUM(Achievement indikator x Bobot indikator)',
            zeroDenominator: 'Belum terukur, bukan 0%',
            maxAchievementPercent: 120
        },
        scorecards,
        programs: operations.programs,
        individual: {
            status: operations.cards.length ? 'active' : 'empty',
            cards: operations.cards,
            assignments: operations.assignments
        }
    });
});

route('put', '/kpi/programs/:id', async (req, res) => {
    if (!isKpiManager(req)) return res.status(403).json({ error: 'KPI program configuration requires Kepala Divisi BIM' });
    const existing = await pool.query(`SELECT * FROM bim_kpi_programs WHERE id=$1`, [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'KPI program not found' });
    const targetValue = req.body.targetValue === '' || req.body.targetValue == null
        ? null
        : normalizeNumber(req.body.targetValue, 0, 0.0001, 1000000000);
    const availability = normalizeEnum(req.body.availabilityStatus, new Set(['open', 'closed']), existing.rows[0].availability_status);
    const targetUnit = trimText(req.body.targetUnit, 60) || existing.rows[0].target_unit;
    const result = await pool.query(
        `UPDATE bim_kpi_programs SET target_value=$2,target_unit=$3,availability_status=$4,updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 RETURNING *`,
        [req.params.id, targetValue, targetUnit, availability]
    );
    await logActivity(req, 'kpi_program', req.params.id, 'configured', `Target program dikonfigurasi: ${result.rows[0].program_name}`, { targetValue, targetUnit, availability });
    res.json(result.rows[0]);
});

route('post', '/kpi/assignments', async (req, res) => {
    if (!canWrite(req)) return res.status(403).json({ error: 'Write access required' });
    const programResult = await pool.query(`SELECT * FROM bim_kpi_programs WHERE id=$1 AND is_active=true`, [trimText(req.body.programId, 120)]);
    if (!programResult.rows.length) return res.status(404).json({ error: 'KPI program not found' });
    const program = programResult.rows[0];
    const manager = isKpiManager(req);
    if (manager && program.target_value == null) {
        return res.status(409).json({ error: 'Target operasional program harus ditetapkan sebelum delegasi' });
    }
    if (!manager && (program.availability_status !== 'open' || program.claim_policy !== 'staff_proposable')) {
        return res.status(403).json({ error: 'Program ini hanya dapat didelegasikan oleh Kepala Divisi' });
    }
    const staff = await resolveKpiStaff(req, req.body.staffUserId);
    if (!staff) return res.status(400).json({ error: 'User Staff BIM aktif wajib dipilih' });
    const card = await ensureIndividualScorecard(Number(program.period_year), staff);
    const activeCount = await pool.query(
        `SELECT COUNT(*)::int AS total FROM bim_kpi_assignments
         WHERE scorecard_id=$1 AND status NOT IN ('rejected','closed')`, [card.id]
    );
    if (Number(activeCount.rows[0].total) >= 5) return res.status(409).json({ error: 'Maksimum lima kontribusi KPI aktif per staff' });
    const title = trimText(req.body.title, 300);
    if (!title) return res.status(400).json({ error: 'Komitmen individu wajib diisi' });
    const targetValue = normalizeNumber(req.body.targetValue, 0, 0.0001, 1000000000);
    if (!targetValue) return res.status(400).json({ error: 'Target kontribusi harus lebih besar dari nol' });
    const proposedWeight = normalizeNumber(req.body.proposedWeight, 0, 0.0001, 1);
    if (!proposedWeight) return res.status(400).json({ error: 'Bobot kontribusi harus lebih besar dari nol' });
    if (manager && !(await validateApprovedWeight(card.id, '', proposedWeight))) {
        return res.status(409).json({ error: 'Total bobot KPI individu tidak boleh melebihi 100%' });
    }
    try {
        const id = newId('kpi-assignment');
        const result = await pool.query(
            `INSERT INTO bim_kpi_assignments
             (id,scorecard_id,program_id,division_indicator_id,staff_user_id,staff_name_snapshot,commitment_title,
              measurement_type,target_value,target_unit,proposed_weight,approved_weight,due_date,expected_evidence,status,
              created_by_user_id,created_by_name_snapshot,delegated_by_user_id,delegated_by_name_snapshot,
              approved_by_user_id,approved_by_name_snapshot,approved_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
             RETURNING *`,
            [id, card.id, program.id, program.division_indicator_id, staff.id, staff.username, title,
             normalizeEnum(req.body.measurementType, new Set(['quantity', 'milestone', 'ratio', 'quality_acceptance', 'sla']), 'quantity'),
             targetValue, trimText(req.body.targetUnit, 60) || program.target_unit, proposedWeight, manager ? proposedWeight : null,
             normalizeDate(req.body.dueDate), trimText(req.body.expectedEvidence, 1000) || null,
             manager ? 'approved' : 'pending_approval', actorId(req), actorName(req), manager ? actorId(req) : null,
             manager ? actorName(req) : null, manager ? actorId(req) : null, manager ? actorName(req) : null,
             manager ? new Date() : null]
        );
        await logActivity(req, 'kpi_assignment', id, manager ? 'delegated' : 'proposed', `${manager ? 'Kontribusi didelegasikan' : 'Kontribusi diusulkan'}: ${title}`, { programId: program.id, staffUserId: staff.id });
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'Staff tersebut sudah memiliki kontribusi pada program ini' });
        throw error;
    }
});

route('post', '/kpi/assignments/:id/review', async (req, res) => {
    if (!isKpiManager(req)) return res.status(403).json({ error: 'KPI review requires Kepala Divisi BIM' });
    const current = await pool.query(
        `SELECT a.*,p.target_value AS program_target_value,p.target_unit AS program_target_unit,
                p.program_name
         FROM bim_kpi_assignments a
         JOIN bim_kpi_programs p ON p.id=a.program_id
         WHERE a.id=$1`, [req.params.id]
    );
    if (!current.rows.length) return res.status(404).json({ error: 'KPI assignment not found' });
    const assignment = current.rows[0];
    const action = normalizeEnum(req.body.action, new Set(['approve', 'revision', 'reject']), 'revision');
    const note = trimText(req.body.note, 1000);
    if (action !== 'approve' && !note) return res.status(400).json({ error: 'Catatan review wajib diisi' });
    const targetValue = normalizeNumber(req.body.targetValue, Number(assignment.target_value), 0.0001, 1000000000);
    const approvedWeight = normalizeNumber(req.body.approvedWeight, Number(assignment.proposed_weight), 0.0001, 1);
    const programTargetValue = assignment.program_target_value == null
        ? normalizeNumber(req.body.programTargetValue, 0, 0.0001, 1000000000)
        : Number(assignment.program_target_value);
    if (action === 'approve' && !programTargetValue) {
        return res.status(409).json({ error: 'Target program divisi wajib ditetapkan sebelum kontribusi disetujui' });
    }
    if (action === 'approve' && !(await validateApprovedWeight(assignment.scorecard_id, assignment.id, approvedWeight))) {
        return res.status(409).json({ error: 'Total bobot KPI individu tidak boleh melebihi 100%' });
    }
    if (action === 'approve' && assignment.program_target_value == null) {
        await pool.query(
            `UPDATE bim_kpi_programs SET target_value=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
            [assignment.program_id,programTargetValue]
        );
        await logActivity(req,'kpi_program',assignment.program_id,'configured',
            `Target program ditetapkan saat review: ${assignment.program_name}`,
            {targetValue:programTargetValue,targetUnit:assignment.program_target_unit,availability:'open'}
        );
    }
    const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'revision_required';
    const result = await pool.query(
        `UPDATE bim_kpi_assignments SET commitment_title=$2,measurement_type=$3,target_value=$4,target_unit=$5,
            approved_weight=$6,due_date=$7,expected_evidence=$8,status=$9,review_note=$10,
            approved_by_user_id=$11,approved_by_name_snapshot=$12,approved_at=$13,updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 RETURNING *`,
        [assignment.id, trimText(req.body.title, 300) || assignment.commitment_title,
         normalizeEnum(req.body.measurementType, new Set(['quantity', 'milestone', 'ratio', 'quality_acceptance', 'sla']), assignment.measurement_type),
         targetValue, trimText(req.body.targetUnit, 60) || assignment.target_unit, action === 'approve' ? approvedWeight : null,
         normalizeDate(req.body.dueDate) || assignment.due_date, trimText(req.body.expectedEvidence, 1000) || assignment.expected_evidence,
         status, note || null, action === 'approve' ? actorId(req) : null, action === 'approve' ? actorName(req) : null,
         action === 'approve' ? new Date() : null]
    );
    await logActivity(req, 'kpi_assignment', assignment.id, `review_${action}`, `Review KPI: ${assignment.commitment_title}`, { note });
    res.json(result.rows[0]);
});

route('put', '/kpi/assignments/:id', async (req, res) => {
    const current = await pool.query(`SELECT * FROM bim_kpi_assignments WHERE id=$1`, [req.params.id]);
    if (!current.rows.length) return res.status(404).json({ error: 'KPI assignment not found' });
    const assignment = current.rows[0];
    if (assignment.staff_user_id !== actorId(req)) return res.status(403).json({ error: 'Only the assignment owner can revise this contribution' });
    if (assignment.status !== 'revision_required') return res.status(409).json({ error: 'Only revision-required contribution can be edited' });
    const title = trimText(req.body.title, 300);
    const targetValue = normalizeNumber(req.body.targetValue, 0, 0.0001, 1000000000);
    const proposedWeight = normalizeNumber(req.body.proposedWeight, 0, 0.0001, 1);
    if (!title || !targetValue || !proposedWeight) return res.status(400).json({ error: 'Komitmen, target, dan bobot wajib diisi' });
    const result = await pool.query(
        `UPDATE bim_kpi_assignments SET commitment_title=$2,measurement_type=$3,target_value=$4,target_unit=$5,
            proposed_weight=$6,due_date=$7,expected_evidence=$8,status='pending_approval',approved_weight=NULL,
            updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`,
        [assignment.id, title,
         normalizeEnum(req.body.measurementType, new Set(['quantity', 'milestone', 'ratio', 'quality_acceptance', 'sla']), assignment.measurement_type),
         targetValue, trimText(req.body.targetUnit, 60) || assignment.target_unit, proposedWeight,
         normalizeDate(req.body.dueDate), trimText(req.body.expectedEvidence, 1000) || null]
    );
    await logActivity(req, 'kpi_assignment', assignment.id, 'revision_submitted', `Revisi kontribusi diajukan: ${title}`);
    res.json(result.rows[0]);
});

route('post', '/kpi/assignments/:id/submit-actual', async (req, res) => {
    const current = await pool.query(`SELECT * FROM bim_kpi_assignments WHERE id=$1`, [req.params.id]);
    if (!current.rows.length) return res.status(404).json({ error: 'KPI assignment not found' });
    const assignment = current.rows[0];
    if (!isKpiManager(req) && assignment.staff_user_id !== actorId(req)) return res.status(403).json({ error: 'Only the assignment owner can submit actual' });
    if (!['approved', 'achieved'].includes(assignment.status)) return res.status(409).json({ error: 'Only approved contribution can submit actual' });
    const actual = normalizeNumber(req.body.actualValue, -1, 0, 1000000000);
    const evidence = trimText(req.body.evidenceLink, 2000);
    if (actual < 0 || !evidence) return res.status(400).json({ error: 'Actual dan evidence wajib diisi' });
    const result = await pool.query(
        `UPDATE bim_kpi_assignments SET submitted_actual=$2,actual_evidence_link=$3,actual_note=$4,
            status='verification_pending',updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`,
        [assignment.id, actual, evidence, trimText(req.body.note, 1000) || null]
    );
    await logActivity(req, 'kpi_assignment', assignment.id, 'actual_submitted', `Actual KPI diajukan: ${assignment.commitment_title}`, { actual });
    res.json(result.rows[0]);
});

route('post', '/kpi/assignments/:id/verify', async (req, res) => {
    if (!isKpiManager(req)) return res.status(403).json({ error: 'Actual verification requires Kepala Divisi BIM' });
    const current = await pool.query(`SELECT * FROM bim_kpi_assignments WHERE id=$1`, [req.params.id]);
    if (!current.rows.length) return res.status(404).json({ error: 'KPI assignment not found' });
    const assignment = current.rows[0];
    if (assignment.status !== 'verification_pending') return res.status(409).json({ error: 'Actual is not awaiting verification' });
    const action = normalizeEnum(req.body.action, new Set(['approve', 'revision']), 'revision');
    const note = trimText(req.body.note, 1000);
    if (action === 'revision') {
        const result = await pool.query(
            `UPDATE bim_kpi_assignments SET status='approved',review_note=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`,
            [assignment.id, note || 'Actual dikembalikan untuk revisi']
        );
        return res.json(result.rows[0]);
    }
    const verifiedActual = normalizeNumber(req.body.verifiedActual, Number(assignment.submitted_actual), 0, 1000000000);
    const achievement = Math.min(MAX_ACHIEVEMENT, verifiedActual / Number(assignment.target_value));
    const weightedScore = achievement * Number(assignment.approved_weight || 0);
    const result = await pool.query(
        `UPDATE bim_kpi_assignments SET verified_actual=$2,achievement=$3,weighted_score=$4,status='achieved',
            review_note=$5,verified_by_user_id=$6,verified_by_name_snapshot=$7,verified_at=CURRENT_TIMESTAMP,
            updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`,
        [assignment.id, verifiedActual, achievement, weightedScore, note || null, actorId(req), actorName(req)]
    );
    await logActivity(req, 'kpi_assignment', assignment.id, 'actual_verified', `Actual KPI diverifikasi: ${assignment.commitment_title}`, { verifiedActual, achievement });
    res.json(result.rows[0]);
});

route('get', '/kpi/task-options', async (req, res) => {
    const year = normalizeYear(req.query.year);
    const picUserId = isKpiManager(req) && req.query.picUserId ? trimText(req.query.picUserId, 100) : actorId(req);
    const result = await pool.query(
        `SELECT a.id,a.commitment_title,a.staff_user_id,p.code AS program_code,p.program_name
         FROM bim_kpi_assignments a
         JOIN bim_kpi_individual_scorecards s ON s.id=a.scorecard_id
         JOIN bim_kpi_programs p ON p.id=a.program_id
         WHERE s.period_year=$1 AND a.staff_user_id=$2 AND a.status IN ('approved','verification_pending','achieved','closed')
         ORDER BY p.sort_order,a.commitment_title`,
        [year, picUserId]
    );
    res.json(result.rows.map((row) => ({ id: row.id, title: row.commitment_title, staffUserId: row.staff_user_id, programCode: row.program_code, programName: row.program_name })));
});

route('get', '/dashboard', async (req, res) => {
    const period = normalizePeriod(req.query.period);
    const [taskSummary, issueSummary, actionSummary, outputs, activity] = await Promise.all([
        pool.query(`
            SELECT COUNT(*) FILTER (WHERE intake_status='approved')::int AS total,
                   COUNT(*) FILTER (WHERE status='approved_done')::int AS completed,
                   COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status NOT IN ('approved_done','cancelled'))::int AS overdue,
                   COUNT(*) FILTER (WHERE status='blocked')::int AS blocked,
                   COUNT(*) FILTER (WHERE intake_status='pending_approval' OR status='submitted_for_review')::int AS pending_approval,
                   COUNT(*) FILTER (WHERE intake_status='approved' AND status NOT IN ('approved_done','cancelled'))::int AS active,
                   COALESCE(ROUND(AVG(progress_percent) FILTER (WHERE intake_status='approved' AND status NOT IN ('cancelled')),1),0) AS average_progress,
                   COUNT(*) FILTER (WHERE status='approved_done' AND approved_at::date <= due_date)::int AS on_time_completed
            FROM bim_ops_tasks WHERE period_month=$1`, [period]),
        pool.query(`SELECT COUNT(*) FILTER (WHERE status IN ('accepted','action_required','resolved_pending_approval'))::int AS open,
                           COUNT(*) FILTER (WHERE status='submitted')::int AS pending,
                           COUNT(*) FILTER (WHERE severity IN ('high','critical') AND status NOT IN ('closed','rejected','cancelled'))::int AS important
                    FROM bim_ops_issues WHERE period_month=$1`, [period]),
        pool.query(`SELECT COUNT(*) FILTER (WHERE a.status NOT IN ('closed','cancelled'))::int AS open,
                           COUNT(*) FILTER (WHERE a.planned_due_date < CURRENT_DATE AND a.status NOT IN ('closed','cancelled'))::int AS overdue
                    FROM bim_ops_meeting_actions a JOIN bim_ops_meetings m ON m.id=a.meeting_id
                    WHERE m.period_month=$1`, [period]),
        pool.query(`SELECT w.id,w.work_date,w.task_item_text,w.pic_name_snapshot,w.output_result,w.blocker,w.created_at
                    FROM bim_ops_worklogs w WHERE w.period_month=$1 AND w.confirmation_status='confirmed'
                      AND COALESCE(w.output_result,'')<>''
                    ORDER BY w.work_date DESC,w.created_at DESC LIMIT 8`, [period]),
        pool.query(`SELECT entity_type,entity_id,action,summary,actor_name_snapshot,created_at
                    FROM bim_ops_activity_log ORDER BY created_at DESC LIMIT 12`)
    ]);
    const task = taskSummary.rows[0];
    const total = Number(task.total || 0);
    const completed = Number(task.completed || 0);
    res.json({
        period,
        indicators: {
            total,
            active: Number(task.active || 0),
            completed,
            completionPercent: total ? Math.round((completed / total) * 100) : 0,
            onTimePercent: completed ? Math.round((Number(task.on_time_completed || 0) / completed) * 100) : 0,
            averageProgress: Number(task.average_progress || 0),
            overdue: Number(task.overdue || 0),
            blocked: Number(task.blocked || 0),
            pendingApproval: Number(task.pending_approval || 0),
            openIssues: Number(issueSummary.rows[0].open || 0),
            pendingIssues: Number(issueSummary.rows[0].pending || 0),
            importantIssues: Number(issueSummary.rows[0].important || 0),
            openMeetingActions: Number(actionSummary.rows[0].open || 0),
            overdueMeetingActions: Number(actionSummary.rows[0].overdue || 0)
        },
        recentOutputs: outputs.rows,
        recentActivity: activity.rows
    });
});

function mapTask(row) {
    return {
        id: row.id,
        periodMonth: row.period_month,
        title: row.title,
        description: row.description || '',
        projectName: row.project_name || '',
        taskType: row.task_type,
        officialOwnerName: row.official_owner_name,
        picUserId: row.pic_user_id || '',
        picName: row.pic_name_snapshot || '',
        delegatedByUserId: row.delegated_by_user_id || '',
        delegatedByName: row.delegated_by_name_snapshot || '',
        delegatedAt: row.delegated_at,
        startDate: row.start_date,
        dueDate: row.due_date,
        priority: row.priority,
        intakeStatus: row.intake_status,
        status: row.status,
        progressPercent: Number(row.progress_percent || 0),
        isRoutine: !!row.is_routine,
        evidenceLink: row.evidence_link || '',
        kpiAssignmentId: row.kpi_assignment_id || '',
        sourceType: row.source_type || 'manual',
        sourceId: row.source_id || '',
        createdByUserId: row.created_by_user_id,
        createdByName: row.created_by_name_snapshot,
        intakeReviewNote: row.intake_review_note || '',
        reviewNote: row.review_note || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

route('get', '/tasks', async (req, res) => {
    const period = normalizePeriod(req.query.period);
    const userId = actorId(req);
    const manager = isDivisionHead(req) || req.workspaceRole === 'system_admin';
    const result = await pool.query(
        `SELECT * FROM bim_ops_tasks
         WHERE period_month=$1
           AND (intake_status='approved' OR created_by_user_id=$2 OR $3::boolean=true)
         ORDER BY COALESCE(start_date,due_date),created_at`, [period, userId, manager]
    );
    res.json(result.rows.map(mapTask));
});

route('get', '/task-project-contexts', async (req, res) => {
    if (!canWrite(req)) return res.json([]);
    const result = await pool.query(`
        WITH project_names AS (
            SELECT TRIM(REGEXP_REPLACE(project_name, '\\s+', ' ', 'g')) AS name,
                   ROW_NUMBER() OVER (
                       PARTITION BY LOWER(TRIM(REGEXP_REPLACE(project_name, '\\s+', ' ', 'g')))
                       ORDER BY updated_at DESC, created_at DESC
                   ) AS position
            FROM bim_ops_tasks
            WHERE NULLIF(TRIM(project_name), '') IS NOT NULL
        )
        SELECT name
        FROM project_names
        WHERE position = 1
        ORDER BY LOWER(name)
        LIMIT 200
    `);
    res.json(result.rows.map((row) => row.name));
});

route('post', '/tasks', async (req, res) => {
    if (!canWrite(req)) return res.status(403).json({ error: 'Write access required' });
    const title = trimText(req.body.title, 240);
    if (!title) return res.status(400).json({ error: 'Task title is required' });
    const id = newId('task');
    const directApproval = isKpiManager(req);
    const period = normalizePeriod(req.body.periodMonth || req.body.period);
    const assignment = await resolveTaskAssignment(req, req.body.picUserId);
    if (assignment.error) return res.status(assignment.status).json({ error: assignment.error });
    const kpiLink = await resolveKpiTaskLink(req, req.body.kpiAssignmentId, assignment.picId);
    if (kpiLink?.error) return res.status(kpiLink.status).json({ error: kpiLink.error });
    const kpiAssignmentId = kpiLink?.id || null;
    const result = await pool.query(
        `INSERT INTO bim_ops_tasks
         (id,period_month,title,description,project_name,task_type,pic_user_id,pic_name_snapshot,start_date,due_date,
          priority,intake_status,status,progress_percent,is_routine,source_type,source_id,evidence_link,
          kpi_assignment_id,created_by_user_id,created_by_name_snapshot,intake_reviewed_by_user_id,intake_reviewed_by_name_snapshot,intake_reviewed_at,
          delegated_by_user_id,delegated_by_name_snapshot,delegated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'planned',0,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
         RETURNING *`,
        [id, period, title, trimText(req.body.description), normalizeProjectName(req.body.projectName),
         normalizeEnum(req.body.taskType, TASK_TYPES, 'project_task'), assignment.picId, assignment.picName,
         normalizeDate(req.body.startDate), normalizeDate(req.body.dueDate), normalizeEnum(req.body.priority, PRIORITIES, 'normal'),
         directApproval ? 'approved' : 'draft', !!req.body.isRoutine, trimText(req.body.sourceType, 40) || 'manual',
         trimText(req.body.sourceId, 120) || null, trimText(req.body.evidenceLink, 2000) || null, kpiAssignmentId,
         actorId(req), actorName(req), directApproval ? actorId(req) : null, directApproval ? actorName(req) : null,
         directApproval ? new Date() : null, assignment.delegated ? actorId(req) : null,
         assignment.delegated ? actorName(req) : null, assignment.delegated ? new Date() : null]
    );
    await logActivity(
        req,
        'task',
        id,
        assignment.delegated ? 'delegated' : 'created',
        assignment.delegated ? `Task didelegasikan kepada ${assignment.picName}: ${title}` : `Task dibuat: ${title}`,
        { intakeStatus: directApproval ? 'approved' : 'draft', picUserId: assignment.picId, delegated: assignment.delegated }
    );
    res.status(201).json(mapTask(result.rows[0]));
});

route('put', '/tasks/:id', async (req, res) => {
    if (!canWrite(req)) return res.status(403).json({ error: 'Write access required' });
    const existing = await pool.query(`SELECT * FROM bim_ops_tasks WHERE id=$1`, [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Task not found' });
    const task = existing.rows[0];
    const isCreator = task.created_by_user_id === actorId(req);
    const isPic = task.pic_user_id === actorId(req);
    const manager = isDivisionHead(req) || req.workspaceRole === 'system_admin';
    const canEditDefinition = manager || (isCreator && ['draft', 'revision_required'].includes(task.intake_status));
    if (!manager && !isCreator && !(task.intake_status === 'approved' && isPic)) return res.status(403).json({ error: 'Task edit denied' });
    if (!manager && task.intake_status === 'pending_approval') return res.status(409).json({ error: 'Task is locked while awaiting approval' });
    if (!manager && task.status === 'submitted_for_review') return res.status(409).json({ error: 'Task is locked while awaiting completion review' });
    if (task.status === 'approved_done') return res.status(409).json({ error: 'Completed task is locked' });
    const requestedStatus = normalizeEnum(req.body.status, TASK_STATUSES, task.status);
    const nextStatus = manager || ['planned', 'in_progress', 'blocked'].includes(requestedStatus)
        ? requestedStatus
        : task.status;
    let assignment = {
        picId: task.pic_user_id,
        picName: task.pic_name_snapshot,
        delegated: !!task.delegated_by_user_id,
        delegatedByUserId: task.delegated_by_user_id,
        delegatedByName: task.delegated_by_name_snapshot,
        delegatedAt: task.delegated_at
    };
    if (canEditDefinition) {
        assignment = await resolveTaskAssignment(req, req.body.picUserId);
        if (assignment.error) return res.status(assignment.status).json({ error: assignment.error });
        const existingDelegation = assignment.delegated && task.pic_user_id === assignment.picId && task.delegated_by_user_id;
        assignment.delegatedByUserId = assignment.delegated ? (existingDelegation ? task.delegated_by_user_id : actorId(req)) : null;
        assignment.delegatedByName = assignment.delegated ? (existingDelegation ? task.delegated_by_name_snapshot : actorName(req)) : null;
        assignment.delegatedAt = assignment.delegated ? (existingDelegation ? task.delegated_at : new Date()) : null;
    }
    const kpiLink = canEditDefinition
        ? await resolveKpiTaskLink(req, req.body.kpiAssignmentId, assignment.picId)
        : { id: task.kpi_assignment_id };
    if (kpiLink?.error) return res.status(kpiLink.status).json({ error: kpiLink.error });
    const kpiAssignmentId = kpiLink?.id || null;
    const result = await pool.query(
        `UPDATE bim_ops_tasks SET
            title=COALESCE(NULLIF($2,''),title), description=$3, project_name=$4,
            task_type=$5, pic_user_id=$6, pic_name_snapshot=$7, start_date=$8, due_date=$9,
            priority=$10, status=$11, progress_percent=$12, is_routine=$13, evidence_link=$14,
            delegated_by_user_id=$15, delegated_by_name_snapshot=$16, delegated_at=$17,
            kpi_assignment_id=$18,
            updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 RETURNING *`,
        [req.params.id, canEditDefinition ? trimText(req.body.title, 240) : task.title,
         canEditDefinition ? trimText(req.body.description) : task.description,
         canEditDefinition ? normalizeProjectName(req.body.projectName) : task.project_name,
         canEditDefinition ? normalizeEnum(req.body.taskType, TASK_TYPES, task.task_type) : task.task_type,
         assignment.picId, assignment.picName,
         canEditDefinition ? normalizeDate(req.body.startDate) : task.start_date,
         canEditDefinition ? normalizeDate(req.body.dueDate) : task.due_date,
         canEditDefinition ? normalizeEnum(req.body.priority, PRIORITIES, task.priority) : task.priority,
         nextStatus, normalizeNumber(req.body.progressPercent, Number(task.progress_percent || 0), 0, 100),
         canEditDefinition ? !!req.body.isRoutine : task.is_routine,
         trimText(req.body.evidenceLink, 2000) || null,
         assignment.delegatedByUserId, assignment.delegatedByName, assignment.delegatedAt, kpiAssignmentId]
    );
    const reassigned = canEditDefinition && task.pic_user_id !== assignment.picId;
    await logActivity(
        req,
        'task',
        req.params.id,
        reassigned && assignment.delegated ? 'delegated' : 'updated',
        reassigned && assignment.delegated
            ? `Task didelegasikan kepada ${assignment.picName}: ${result.rows[0].title}`
            : `Task diperbarui: ${result.rows[0].title}`,
        {
            ...(reassigned ? { previousPicUserId: task.pic_user_id || null, picUserId: assignment.picId } : {}),
            previousProgress: Number(task.progress_percent || 0),
            progressPercent: Number(result.rows[0].progress_percent || 0),
            previousStatus: task.status,
            status: result.rows[0].status,
            evidenceLink: result.rows[0].evidence_link || ''
        }
    );
    res.json(mapTask(result.rows[0]));
});

route('post', '/tasks/:id/submit-intake', async (req, res) => {
    if (!canWrite(req)) return res.status(403).json({ error: 'Write access required' });
    const result = await pool.query(
        `UPDATE bim_ops_tasks SET intake_status='pending_approval',intake_submitted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 AND created_by_user_id=$2 AND intake_status IN ('draft','revision_required') RETURNING *`,
        [req.params.id, actorId(req)]
    );
    if (!result.rows.length) return res.status(409).json({ error: 'Task cannot be submitted' });
    await logActivity(req, 'task', req.params.id, 'submitted', 'Task diajukan untuk approval input');
    res.json(mapTask(result.rows[0]));
});

route('post', '/tasks/:id/intake-review', async (req, res) => {
    if (!isDivisionHead(req)) return res.status(403).json({ error: 'Division Head approval required' });
    const action = normalizeEnum(req.body.action, new Set(['approve', 'revision', 'reject']), '');
    if (!action) return res.status(400).json({ error: 'Invalid review action' });
    const next = action === 'approve' ? 'approved' : action === 'revision' ? 'revision_required' : 'rejected';
    const result = await pool.query(
        `UPDATE bim_ops_tasks SET intake_status=$2,intake_reviewed_by_user_id=$3,intake_reviewed_by_name_snapshot=$4,
                intake_reviewed_at=CURRENT_TIMESTAMP,intake_review_note=$5,updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 AND intake_status='pending_approval' RETURNING *`,
        [req.params.id, next, actorId(req), actorName(req), trimText(req.body.note, 2000)]
    );
    if (!result.rows.length) return res.status(409).json({ error: 'Task is not pending approval' });
    await logActivity(req, 'task', req.params.id, `intake_${action}`, `Input task ${action}`, { note: req.body.note || '' });
    res.json(mapTask(result.rows[0]));
});

route('post', '/tasks/:id/submit-completion', async (req, res) => {
    if (!canWrite(req)) return res.status(403).json({ error: 'Write access required' });
    const result = await pool.query(
        `UPDATE bim_ops_tasks SET status='submitted_for_review',progress_percent=100,completion_submitted_at=CURRENT_TIMESTAMP,
                evidence_link=COALESCE(NULLIF($3,''),evidence_link),updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 AND intake_status='approved' AND status NOT IN ('approved_done','cancelled')
           AND (created_by_user_id=$2 OR pic_user_id=$2) RETURNING *`,
        [req.params.id, actorId(req), trimText(req.body.evidenceLink, 2000)]
    );
    if (!result.rows.length) return res.status(409).json({ error: 'Task cannot be submitted for completion' });
    await logActivity(req, 'task', req.params.id, 'completion_submitted', 'Task diajukan untuk completion review');
    res.json(mapTask(result.rows[0]));
});

route('post', '/tasks/:id/completion-review', async (req, res) => {
    if (!isDivisionHead(req)) return res.status(403).json({ error: 'Division Head approval required' });
    const approve = req.body.action === 'approve';
    const next = approve ? 'approved_done' : 'rejected_revision';
    const result = await pool.query(
        `UPDATE bim_ops_tasks SET status=$2,approved_by_user_id=$3,approved_by_name_snapshot=$4,approved_at=CURRENT_TIMESTAMP,
                review_note=$5,completed_at=CASE WHEN $2='approved_done' THEN CURRENT_TIMESTAMP ELSE NULL END,
                progress_percent=CASE WHEN $2='approved_done' THEN 100 ELSE progress_percent END,updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 AND status='submitted_for_review' RETURNING *`,
        [req.params.id, next, actorId(req), actorName(req), trimText(req.body.note, 2000)]
    );
    if (!result.rows.length) return res.status(409).json({ error: 'Task is not awaiting completion review' });
    await logActivity(req, 'task', req.params.id, approve ? 'approved' : 'revision_requested', approve ? 'Task disetujui selesai' : 'Task dikembalikan untuk revisi');
    res.json(mapTask(result.rows[0]));
});

route('post', '/tasks/carry-forward', async (req, res) => {
    if (!canWrite(req)) return res.status(403).json({ error: 'Write access required' });
    const sourcePeriod = normalizePeriod(req.body.sourcePeriod);
    const targetPeriod = normalizePeriod(req.body.targetPeriod);
    const includeRoutine = req.body.includeRoutine === true;
    const ids = Array.isArray(req.body.taskIds) ? req.body.taskIds.map((id) => trimText(id, 120)).filter(Boolean) : [];
    const params = [sourcePeriod];
    let filter = `period_month=$1 AND intake_status='approved'
                  AND (status NOT IN ('approved_done','cancelled') OR ($2::boolean=true AND is_routine=true))`;
    params.push(includeRoutine);
    if (ids.length) {
        params.push(ids);
        filter += ` AND id=ANY($3::text[])`;
    }
    params.push(targetPeriod);
    filter += ` AND NOT EXISTS (
        SELECT 1 FROM bim_ops_tasks target
        WHERE target.period_month=$${params.length} AND target.carried_from_task_id=bim_ops_tasks.id
    )`;
    const source = await pool.query(`SELECT * FROM bim_ops_tasks WHERE ${filter}`, params);
    const created = [];
    for (const task of source.rows) {
        const id = newId('task');
        const row = await pool.query(
            `INSERT INTO bim_ops_tasks
             (id,period_month,title,description,project_name,task_type,pic_user_id,pic_name_snapshot,start_date,due_date,
              priority,intake_status,status,progress_percent,is_routine,carried_from_task_id,source_type,source_id,evidence_link,
              created_by_user_id,created_by_name_snapshot)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,NULL,$9,'approved',$10,$11,$12,$13,'carry_forward',$13,$14,$15,$16)
             RETURNING *`,
            [id,targetPeriod,task.title,task.description,task.project_name,task.task_type,task.pic_user_id,task.pic_name_snapshot,
             task.priority,task.status === 'approved_done' ? 'planned' : task.status,
             task.status === 'approved_done' ? 0 : task.progress_percent,task.is_routine,task.id,task.evidence_link,actorId(req),actorName(req)]
        );
        await logActivity(req, 'task', id, 'carried_forward', `Task dibawa dari ${sourcePeriod}`, { sourceTaskId: task.id });
        created.push(mapTask(row.rows[0]));
    }
    res.status(201).json(created);
});

function mapWorklog(row, req) {
    const own = row.pic_user_id === actorId(req);
    return {
        id: row.id,
        workDate: dateOnly(row.work_date),
        periodMonth: row.period_month,
        taskId: row.task_id || '',
        taskItem: row.task_item_text,
        projectName: row.project_name || '',
        picUserId: row.pic_user_id,
        picName: row.pic_name_snapshot,
        worklogType: row.worklog_type,
        taskStatus: row.task_status || '',
        hoursSpent: own ? Number(row.private_hours || 0) : null,
        workSummary: row.work_summary,
        outputResult: row.output_result || '',
        blocker: row.blocker || '',
        nextAction: row.next_action || '',
        evidenceLink: row.evidence_link || '',
        remarks: row.remarks || '',
        sourceType: row.source_type || 'manual',
        sourceId: row.source_id || '',
        entryOrigin: row.entry_origin || 'manual',
        confirmationStatus: row.confirmation_status || 'confirmed',
        confirmedAt: row.confirmed_at,
        progressBefore: row.progress_before == null ? null : Number(row.progress_before),
        progressAfter: row.progress_after == null ? null : Number(row.progress_after),
        systemSummary: row.system_summary || '',
        eventCount: Number(row.event_count || 0),
        isOwn: own,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function mapActivityEvent(row) {
    return {
        id: row.id,
        eventType: row.event_type,
        activityClass: row.activity_class,
        sourceType: row.source_type,
        sourceId: row.source_id,
        actorUserId: row.actor_user_id || '',
        actorName: row.actor_name_snapshot || '',
        picUserId: row.pic_user_id || '',
        picName: row.pic_name_snapshot || '',
        projectContext: row.project_context || '',
        eventDate: dateOnly(row.event_date),
        occurredAt: row.occurred_at,
        summary: row.summary,
        output: row.output_snapshot || '',
        progress: row.progress_snapshot == null ? null : Number(row.progress_snapshot),
        status: row.status_snapshot || '',
        evidenceLink: row.evidence_link || '',
        countsAsWork: !!row.counts_as_work,
        worklogId: row.consolidated_worklog_id || ''
    };
}

async function resolveWorklogSource(req, sourceType, sourceId) {
    if (sourceType === 'task') {
        const result = await pool.query(
            `SELECT id,title AS item_text,project_name AS project_context,status,progress_percent,evidence_link,
                    pic_user_id,pic_name_snapshot
             FROM bim_ops_tasks
             WHERE id=$1 AND intake_status='approved' AND status NOT IN ('approved_done','cancelled')`, [sourceId]
        );
        const row = result.rows[0];
        if (!row) return { error: 'Task aktif tidak ditemukan', status: 404 };
        if (row.pic_user_id !== actorId(req)) return { error: 'Worklog task hanya dapat dikonfirmasi oleh PIC', status: 403 };
        return row;
    }
    if (sourceType === 'kpi_assignment') {
        const result = await pool.query(
            `SELECT a.id,a.commitment_title AS item_text,p.program_name AS project_context,a.status,
                    a.achievement * 100 AS progress_percent,a.actual_evidence_link AS evidence_link,
                    a.staff_user_id AS pic_user_id,a.staff_name_snapshot AS pic_name_snapshot
             FROM bim_kpi_assignments a JOIN bim_kpi_programs p ON p.id=a.program_id
             WHERE a.id=$1 AND a.status NOT IN ('rejected','cancelled')`, [sourceId]
        );
        const row = result.rows[0];
        if (!row) return { error: 'Kontribusi KPI aktif tidak ditemukan', status: 404 };
        if (row.pic_user_id !== actorId(req)) return { error: 'Worklog KPI hanya dapat dikonfirmasi oleh staff terkait', status: 403 };
        return row;
    }
    if (sourceType === 'issue') {
        const result = await pool.query(
            `SELECT id,title AS item_text,project_context,status,NULL::numeric AS progress_percent,evidence_link,
                    COALESCE(owner_user_id,reported_by_user_id) AS pic_user_id,
                    COALESCE(owner_name_snapshot,reported_by_name_snapshot) AS pic_name_snapshot
             FROM bim_ops_issues WHERE id=$1 AND status NOT IN ('closed','rejected','cancelled')`, [sourceId]
        );
        const row = result.rows[0];
        if (!row) return { error: 'Issue aktif tidak ditemukan', status: 404 };
        if (row.pic_user_id !== actorId(req)) return { error: 'Worklog issue hanya dapat dikonfirmasi oleh owner', status: 403 };
        return row;
    }
    if (sourceType === 'meeting_action') {
        const result = await pool.query(
            `SELECT a.id,a.description AS item_text,COALESCE(NULLIF(m.project_name,''),m.subject) AS project_context,
                    a.status,NULL::numeric AS progress_percent,a.evidence_link,
                    a.action_owner_user_id AS pic_user_id,a.action_owner_name AS pic_name_snapshot
             FROM bim_ops_meeting_actions a JOIN bim_ops_meetings m ON m.id=a.meeting_id
             WHERE a.id=$1 AND a.status NOT IN ('closed','cancelled')`, [sourceId]
        );
        const row = result.rows[0];
        if (!row) return { error: 'Action MoM aktif tidak ditemukan', status: 404 };
        if (row.pic_user_id !== actorId(req)) return { error: 'Worklog action MoM hanya dapat dikonfirmasi oleh owner', status: 403 };
        return row;
    }
    return { error: 'Sumber aktivitas tidak valid', status: 400 };
}

async function upsertPrivateWorklogTime(worklogId, userId, hoursSpent) {
    await pool.query(
        `INSERT INTO bim_ops_worklog_time (worklog_id,user_id,hours_spent)
         VALUES ($1,$2,$3)
         ON CONFLICT (worklog_id,user_id) DO UPDATE
         SET hours_spent=EXCLUDED.hours_spent,updated_at=CURRENT_TIMESTAMP`,
        [worklogId,userId,normalizeNumber(hoursSpent,0,0,24)]
    );
}

async function getMappedWorklog(id, req) {
    const result = await pool.query(
        `SELECT w.*,wt.hours_spent AS private_hours
         FROM bim_ops_worklogs w
         LEFT JOIN bim_ops_worklog_time wt ON wt.worklog_id=w.id AND wt.user_id=$2
         WHERE w.id=$1`, [id,actorId(req)]
    );
    return result.rows[0] ? mapWorklog(result.rows[0], req) : null;
}

route('get', '/worklogs', async (req, res) => {
    const period = normalizePeriod(req.query.period);
    const [worklogs, events] = await Promise.all([
        pool.query(
            `SELECT w.*,wt.hours_spent AS private_hours
             FROM bim_ops_worklogs w
             LEFT JOIN bim_ops_worklog_time wt ON wt.worklog_id=w.id AND wt.user_id=$2
             WHERE w.period_month=$1 ORDER BY w.work_date DESC,w.updated_at DESC`, [period,actorId(req)]
        ),
        pool.query(
            `SELECT * FROM bim_ops_activity_events
             WHERE event_date >= ($1 || '-01')::date
               AND event_date < (($1 || '-01')::date + INTERVAL '1 month')
             ORDER BY occurred_at DESC LIMIT 250`, [period]
        )
    ]);
    const mapped = worklogs.rows.map((row) => mapWorklog(row, req));
    res.json({
        period,
        worklogs: mapped,
        events: events.rows.map(mapActivityEvent),
        summary: {
            autoDraft: mapped.filter((item) => item.confirmationStatus === 'auto_draft').length,
            confirmed: mapped.filter((item) => item.confirmationStatus === 'confirmed').length,
            executionEvents: events.rows.filter((item) => item.activity_class === 'execution').length,
            planningEvents: events.rows.filter((item) => item.activity_class === 'planning').length
        }
    });
});

route('get', '/worklog-sources', async (req, res) => {
    if (!canWrite(req)) return res.json([]);
    const userId = actorId(req);
    const year = normalizeYear(req.query.year || String(normalizePeriod(req.query.period).slice(0,4)));
    const [tasks, assignments, issues, actions] = await Promise.all([
        pool.query(
            `SELECT id,'task' AS source_type,title AS item_text,project_name AS project_context,status,
                    progress_percent,evidence_link
             FROM bim_ops_tasks WHERE pic_user_id=$1 AND intake_status='approved'
               AND status NOT IN ('approved_done','cancelled') ORDER BY due_date NULLS LAST,title`, [userId]
        ),
        pool.query(
            `SELECT a.id,'kpi_assignment' AS source_type,a.commitment_title AS item_text,p.program_name AS project_context,
                    a.status,a.achievement * 100 AS progress_percent,a.actual_evidence_link AS evidence_link
             FROM bim_kpi_assignments a
             JOIN bim_kpi_individual_scorecards s ON s.id=a.scorecard_id
             JOIN bim_kpi_programs p ON p.id=a.program_id
             WHERE a.staff_user_id=$1 AND s.period_year=$2 AND a.status NOT IN ('rejected','cancelled')
             ORDER BY p.sort_order,a.commitment_title`, [userId,year]
        ),
        pool.query(
            `SELECT id,'issue' AS source_type,title AS item_text,project_context,status,
                    NULL::numeric AS progress_percent,evidence_link
             FROM bim_ops_issues WHERE COALESCE(owner_user_id,reported_by_user_id)=$1
               AND status NOT IN ('closed','rejected','cancelled') ORDER BY due_date NULLS LAST,title`, [userId]
        ),
        pool.query(
            `SELECT a.id,'meeting_action' AS source_type,a.description AS item_text,
                    COALESCE(NULLIF(m.project_name,''),m.subject) AS project_context,a.status,
                    NULL::numeric AS progress_percent,a.evidence_link
             FROM bim_ops_meeting_actions a JOIN bim_ops_meetings m ON m.id=a.meeting_id
             WHERE a.action_owner_user_id=$1 AND a.status NOT IN ('closed','cancelled')
             ORDER BY a.planned_due_date NULLS LAST,a.description`, [userId]
        )
    ]);
    res.json([...tasks.rows,...assignments.rows,...issues.rows,...actions.rows].map((row) => ({
        id: row.id,
        sourceType: row.source_type,
        itemText: row.item_text,
        projectContext: row.project_context || '',
        status: row.status || '',
        progressPercent: row.progress_percent == null ? null : Number(row.progress_percent),
        evidenceLink: row.evidence_link || ''
    })));
});

route('post', '/worklogs', async (req, res) => {
    if (!canWrite(req)) return res.status(403).json({ error: 'Worklog write access required' });
    const workDate = normalizeDate(req.body.workDate) || dateOnly();
    const sourceType = trimText(req.body.sourceType, 40) || (req.body.taskId ? 'task' : 'manual');
    const sourceId = trimText(req.body.sourceId || req.body.taskId, 140) || null;
    const manual = sourceType === 'manual';
    let source = null;
    if (!manual) {
        source = await resolveWorklogSource(req, sourceType, sourceId);
        if (source.error) return res.status(source.status).json({ error: source.error });
    }
    const taskItem = source?.item_text || trimText(req.body.taskItem, 300);
    const projectName = source?.project_context || trimText(req.body.projectName, 240);
    if (!taskItem) return res.status(400).json({ error: 'Item aktivitas wajib diisi' });
    const operationalReason = trimText(req.body.remarks, 4000);
    if (manual && !operationalReason) return res.status(400).json({ error: 'Aktivitas manual memerlukan alasan atau konteks operasional' });
    const workSummary = trimText(req.body.workSummary, 6000);
    if (!workSummary) return res.status(400).json({ error: 'Ringkasan pekerjaan wajib diisi' });
    const taskId = sourceType === 'task' ? sourceId : null;
    const kpiAssignmentId = sourceType === 'kpi_assignment' ? sourceId : null;
    const issueId = sourceType === 'issue' ? sourceId : null;
    const meetingActionId = sourceType === 'meeting_action' ? sourceId : null;
    const taskStatus = sourceType === 'task'
        ? normalizeEnum(req.body.taskStatus,TASK_STATUSES,source.status)
        : source?.status || trimText(req.body.taskStatus,80);
    const progressAfter = Number.isFinite(Number(req.body.progressPercent))
        ? normalizeNumber(req.body.progressPercent,0,0,100)
        : source?.progress_percent == null ? null : Number(source.progress_percent);
    const autoKey = manual ? null : `${workDate}:${actorId(req)}:${sourceType}:${sourceId}`;
    const id = newId('worklog');
    const result = await pool.query(
        `INSERT INTO bim_ops_worklogs
         (id,work_date,period_month,task_id,task_item_text,project_name,pic_user_id,pic_name_snapshot,
          worklog_type,task_status,hours_spent,work_summary,output_result,blocker,next_action,evidence_link,remarks,
          created_by_user_id,created_by_name_snapshot,source_type,source_id,kpi_assignment_id,issue_id,meeting_action_id,
          entry_origin,confirmation_status,confirmed_at,progress_after,system_summary,event_count,auto_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,
                 $24,'confirmed',CURRENT_TIMESTAMP,$25,$11,1,$26)
         ON CONFLICT (auto_key) WHERE auto_key IS NOT NULL DO UPDATE SET
             worklog_type=EXCLUDED.worklog_type,task_status=EXCLUDED.task_status,work_summary=EXCLUDED.work_summary,
             output_result=EXCLUDED.output_result,blocker=EXCLUDED.blocker,next_action=EXCLUDED.next_action,
             evidence_link=EXCLUDED.evidence_link,remarks=EXCLUDED.remarks,entry_origin=EXCLUDED.entry_origin,
             confirmation_status='confirmed',confirmed_at=CURRENT_TIMESTAMP,progress_after=EXCLUDED.progress_after,
             updated_at=CURRENT_TIMESTAMP
         RETURNING *`,
        [id,workDate,workDate.slice(0,7),taskId,taskItem,projectName,actorId(req),actorName(req),
         trimText(req.body.worklogType,80) || 'progress_update',taskStatus,workSummary,
         trimText(req.body.outputResult,6000),trimText(req.body.blocker,4000),trimText(req.body.nextAction,4000),
         trimText(req.body.evidenceLink,2000) || source?.evidence_link || null,operationalReason,actorId(req),actorName(req),
         sourceType,sourceId,kpiAssignmentId,issueId,meetingActionId,manual?'manual':'source_confirmed',progressAfter,autoKey]
    );
    const saved = result.rows[0];
    await upsertPrivateWorklogTime(saved.id,actorId(req),req.body.hoursSpent);
    if (taskId && req.body.updateTaskStatus !== false) {
        await pool.query(
            `UPDATE bim_ops_tasks SET status=$2,
                    progress_percent=CASE WHEN $3::numeric IS NULL THEN progress_percent ELSE $3 END,
                    updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status NOT IN ('approved_done','cancelled')`,
            [taskId, taskStatus, progressAfter]
        );
        await logActivity(req,'task',taskId,'updated',`Progress task diperbarui melalui Worklog: ${taskItem}`,{
            previousProgress: source.progress_percent,
            progressPercent: progressAfter,
            status: taskStatus,
            worklogId: saved.id
        });
    }
    await logActivity(req,'worklog',saved.id,manual?'created':'confirmed',`${manual?'Worklog manual ditambahkan':'Update kerja dikonfirmasi'}: ${taskItem}`,{sourceType,sourceId});
    res.status(201).json(await getMappedWorklog(saved.id,req));
});

route('put', '/worklogs/:id', async (req, res) => {
    const existing = await pool.query(`SELECT w.*,t.status AS linked_task_status FROM bim_ops_worklogs w LEFT JOIN bim_ops_tasks t ON t.id=w.task_id WHERE w.id=$1`, [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Worklog not found' });
    const row = existing.rows[0];
    if (row.pic_user_id !== actorId(req)) return res.status(403).json({ error: 'Only worklog owner can edit' });
    if (row.linked_task_status === 'approved_done') return res.status(409).json({ error: 'Worklog is locked after task approval' });
    const workDate = row.source_type === 'manual'
        ? normalizeDate(req.body.workDate) || String(row.work_date).slice(0,10)
        : String(row.work_date).slice(0,10);
    const remarks = trimText(req.body.remarks,4000);
    if (row.source_type === 'manual' && !remarks) {
        return res.status(400).json({ error: 'Aktivitas manual memerlukan alasan atau konteks operasional' });
    }
    const result = await pool.query(
        `UPDATE bim_ops_worklogs SET work_date=$2,period_month=$3,worklog_type=$4,task_status=$5,
                work_summary=$6,output_result=$7,blocker=$8,next_action=$9,evidence_link=$10,remarks=$11,
                confirmation_status='confirmed',confirmed_at=COALESCE(confirmed_at,CURRENT_TIMESTAMP),
                progress_after=$12,
                task_item_text=CASE WHEN source_type='manual' THEN COALESCE(NULLIF($13,''),task_item_text) ELSE task_item_text END,
                project_name=CASE WHEN source_type='manual' THEN $14 ELSE project_name END,
                updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`,
        [req.params.id,workDate,workDate.slice(0,7),
         trimText(req.body.worklogType,80)||row.worklog_type,normalizeEnum(req.body.taskStatus,TASK_STATUSES,row.task_status),
         trimText(req.body.workSummary,6000)||row.work_summary,
         trimText(req.body.outputResult,6000),trimText(req.body.blocker,4000),trimText(req.body.nextAction,4000),
         trimText(req.body.evidenceLink,2000),remarks,
         Number.isFinite(Number(req.body.progressPercent)) ? normalizeNumber(req.body.progressPercent,0,0,100) : row.progress_after,
         trimText(req.body.taskItem,300),trimText(req.body.projectName,240)]
    );
    await upsertPrivateWorklogTime(req.params.id,actorId(req),req.body.hoursSpent);
    await logActivity(req, 'worklog', req.params.id, 'updated', `Worklog diperbarui: ${row.task_item_text}`);
    res.json(await getMappedWorklog(result.rows[0].id,req));
});

route('post', '/worklogs/:id/confirm', async (req, res) => {
    const existing = await pool.query(
        `SELECT w.*,t.status AS linked_task_status
         FROM bim_ops_worklogs w LEFT JOIN bim_ops_tasks t ON t.id=w.task_id WHERE w.id=$1`, [req.params.id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Worklog tidak ditemukan' });
    const row = existing.rows[0];
    if (row.pic_user_id !== actorId(req)) return res.status(403).json({ error: 'Hanya PIC yang dapat mengonfirmasi Worklog' });
    if (row.linked_task_status === 'approved_done') return res.status(409).json({ error: 'Worklog terkunci setelah task disetujui selesai' });
    const workSummary = trimText(req.body.workSummary,6000) || row.work_summary;
    if (!workSummary) return res.status(400).json({ error: 'Ringkasan pekerjaan wajib diisi' });
    const taskStatus = row.task_id
        ? normalizeEnum(req.body.taskStatus,TASK_STATUSES,row.task_status)
        : row.task_status;
    const progressAfter = Number.isFinite(Number(req.body.progressPercent))
        ? normalizeNumber(req.body.progressPercent,0,0,100)
        : row.progress_after;
    await pool.query(
        `UPDATE bim_ops_worklogs SET work_summary=$2,output_result=$3,blocker=$4,next_action=$5,
                evidence_link=$6,remarks=$7,task_status=$8,progress_after=$9,
                confirmation_status='confirmed',confirmed_at=CURRENT_TIMESTAMP,entry_origin='auto_confirmed',
                updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
        [row.id,workSummary,trimText(req.body.outputResult,6000)||row.output_result,
         trimText(req.body.blocker,4000),trimText(req.body.nextAction,4000),
         trimText(req.body.evidenceLink,2000)||row.evidence_link,trimText(req.body.remarks,4000),taskStatus,progressAfter]
    );
    await upsertPrivateWorklogTime(row.id,actorId(req),req.body.hoursSpent);
    if (row.task_id) {
        await pool.query(
            `UPDATE bim_ops_tasks SET status=$2,progress_percent=COALESCE($3,progress_percent),
                    evidence_link=COALESCE(NULLIF($4,''),evidence_link),updated_at=CURRENT_TIMESTAMP
             WHERE id=$1 AND status NOT IN ('approved_done','cancelled')`,
            [row.task_id,taskStatus,progressAfter,trimText(req.body.evidenceLink,2000)]
        );
        await logActivity(req,'task',row.task_id,'updated',`Progress task dikonfirmasi melalui Worklog: ${row.task_item_text}`,{
            previousProgress: row.progress_before,
            progressPercent: progressAfter,
            status: taskStatus,
            worklogId: row.id
        });
    }
    await logActivity(req,'worklog',row.id,'confirmed',`Worklog dikonfirmasi: ${row.task_item_text}`,{sourceType:row.source_type,sourceId:row.source_id});
    res.json(await getMappedWorklog(row.id,req));
});

const ROMAN_MONTHS = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

async function nextMeetingNumber(client, meetingDate) {
    const period = meetingDate.slice(0,7);
    await client.query('LOCK TABLE bim_ops_meetings IN SHARE ROW EXCLUSIVE MODE');
    const result = await client.query(`SELECT COUNT(*)::int AS total FROM bim_ops_meetings WHERE period_month=$1`, [period]);
    const [year, month] = period.split('-').map(Number);
    return `${String(Number(result.rows[0].total || 0) + 1).padStart(2,'0')}/BIM/${ROMAN_MONTHS[month-1]}/${year}`;
}

async function getMeetingDetail(id) {
    const [meeting, attendees, actions] = await Promise.all([
        pool.query(`SELECT * FROM bim_ops_meetings WHERE id=$1`, [id]),
        pool.query(`SELECT * FROM bim_ops_meeting_attendees WHERE meeting_id=$1 ORDER BY created_at`, [id]),
        pool.query(`SELECT * FROM bim_ops_meeting_actions WHERE meeting_id=$1 ORDER BY section_type DESC,created_at`, [id])
    ]);
    if (!meeting.rows.length) return null;
    return { ...meeting.rows[0], attendees: attendees.rows, actions: actions.rows };
}

route('get', '/meetings', async (req, res) => {
    const period = normalizePeriod(req.query.period);
    const manager = isDivisionHead(req) || req.workspaceRole === 'system_admin';
    const result = await pool.query(
        `SELECT m.*,
                (SELECT COUNT(*) FROM bim_ops_meeting_actions a WHERE a.meeting_id=m.id AND a.status NOT IN ('closed','cancelled'))::int AS open_actions
         FROM bim_ops_meetings m WHERE period_month=$1
           AND (status<>'draft' OR created_by_user_id=$2 OR $3::boolean=true)
         ORDER BY meeting_date DESC,created_at DESC`, [period,actorId(req),manager]
    );
    res.json(result.rows);
});

route('get', '/legacy-risalah', async (req, res) => {
    const requestedPeriod = trimText(req.query.period, 7);
    const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedPeriod) ? requestedPeriod : '';
    const allFiles = walkLegacyRisalahFiles(LEGACY_RISALAH_ROOT);
    const files = allFiles
        .filter((item) => !period || String(item.meetingDate || '').slice(0, 7) === period)
        .sort((a, b) => String(b.meetingDate).localeCompare(String(a.meetingDate)) || a.projectName.localeCompare(b.projectName, 'id-ID'));
    res.json({ rootAvailable: fs.existsSync(LEGACY_RISALAH_ROOT), period: period || 'all', files });
});

route('get', '/legacy-risalah/file', async (req, res) => {
    const relativePath = normalizePathSlash(trimText(req.query.path, 2000));
    if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes('..')) {
        return res.status(400).json({ error: 'Invalid legacy Risalah path' });
    }
    const fullPath = path.resolve(LEGACY_RISALAH_ROOT, relativePath);
    const allowedRoot = `${LEGACY_RISALAH_ROOT}${path.sep}`;
    if (!fullPath.startsWith(allowedRoot) || path.extname(fullPath).toLowerCase() !== '.pdf') {
        return res.status(403).json({ error: 'Legacy Risalah access denied' });
    }
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Legacy Risalah PDF not found' });
    res.sendFile(fullPath);
});

route('get', '/meetings/:id', async (req, res) => {
    const detail = await getMeetingDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: 'Risalah not found' });
    const allowed = detail.status !== 'draft' || detail.created_by_user_id === actorId(req) || isDivisionHead(req) || req.workspaceRole === 'system_admin';
    if (!allowed) return res.status(403).json({ error: 'Draft visibility denied' });
    res.json(detail);
});

route('post', '/meetings', async (req, res) => {
    if (!canWrite(req)) return res.status(403).json({ error: 'Write access required' });
    const subject = trimText(req.body.subject, 300);
    const meetingDate = normalizeDate(req.body.meetingDate) || new Date().toISOString().slice(0,10);
    if (!subject) return res.status(400).json({ error: 'Perihal rapat wajib diisi' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const id = newId('meeting');
        const meetingNo = await nextMeetingNumber(client, meetingDate);
        await client.query(
            `INSERT INTO bim_ops_meetings
             (id,meeting_no,period_month,subject,scope_type,project_name,meeting_date,start_time,end_time,place,
              reported_by_name,reported_by_position,acknowledged_by_name,acknowledged_by_position,department_division,
              reference_memo_no,reference_agenda_no,reference_archive_no,created_by_user_id,created_by_name_snapshot)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
            [id,meetingNo,meetingDate.slice(0,7),subject,trimText(req.body.scopeType,40)||'kantor',trimText(req.body.projectName,240),
             meetingDate,trimText(req.body.startTime,8)||null,trimText(req.body.endTime,8)||null,trimText(req.body.place,240),
             trimText(req.body.reportedByName,160)||actorName(req),trimText(req.body.reportedByPosition,160),
             trimText(req.body.acknowledgedByName,160),trimText(req.body.acknowledgedByPosition,160),
             trimText(req.body.departmentDivision,160)||'Engineering / BIM',trimText(req.body.referenceMemoNo,120),
             trimText(req.body.referenceAgendaNo,120),trimText(req.body.referenceArchiveNo,120),actorId(req),actorName(req)]
        );
        const attendees = Array.isArray(req.body.attendees) ? req.body.attendees : [];
        for (const attendee of attendees) {
            if (!trimText(attendee.name,160)) continue;
            await client.query(
                `INSERT INTO bim_ops_meeting_attendees
                 (id,meeting_id,user_id,name,initial,attendance_status,position,company_or_division)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [newId('attendee'),id,trimText(attendee.userId,100)||null,trimText(attendee.name,160),trimText(attendee.initial,20),
                 trimText(attendee.attendanceStatus,20)||'present',trimText(attendee.position,120),trimText(attendee.companyOrDivision,160)]
            );
        }
        if (req.body.carryForward !== false) {
            const outstanding = await client.query(
                `SELECT a.* FROM bim_ops_meeting_actions a JOIN bim_ops_meetings m ON m.id=a.meeting_id
                  WHERE a.status NOT IN ('closed','cancelled') AND m.meeting_date<$1
                  AND NOT EXISTS (
                      SELECT 1 FROM bim_ops_meeting_actions child
                      WHERE child.carried_from_action_id=a.id
                  )
                  ORDER BY a.planned_due_date NULLS LAST,a.created_at`, [meetingDate]
            );
            for (const action of outstanding.rows) {
                await client.query(
                    `INSERT INTO bim_ops_meeting_actions
                     (id,meeting_id,carried_from_action_id,section_type,description,action_owner_name,action_owner_user_id,
                      planned_due_date,status,evidence_link,created_by_user_id,created_by_name_snapshot)
                     VALUES ($1,$2,$3,'carried_forward',$4,$5,$6,$7,$8,$9,$10,$11)`,
                    [newId('action'),id,action.id,action.description,action.action_owner_name,action.action_owner_user_id,
                     action.planned_due_date,action.status,action.evidence_link,actorId(req),actorName(req)]
                );
            }
        }
        await client.query('COMMIT');
        await logActivity(req,'meeting',id,'created',`Draft Risalah dibuat: ${meetingNo}`);
        res.status(201).json(await getMeetingDetail(id));
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
});

route('put', '/meetings/:id', async (req, res) => {
    const existing = await pool.query(`SELECT * FROM bim_ops_meetings WHERE id=$1`, [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Risalah not found' });
    const meeting = existing.rows[0];
    if (meeting.status !== 'draft') return res.status(409).json({ error: 'Issued Risalah must be revised, not overwritten' });
    if (meeting.created_by_user_id !== actorId(req) && !isDivisionHead(req)) return res.status(403).json({ error: 'Draft edit denied' });
    await pool.query(
        `UPDATE bim_ops_meetings SET subject=COALESCE(NULLIF($2,''),subject),scope_type=$3,project_name=$4,
                meeting_date=$5,start_time=$6,end_time=$7,place=$8,reported_by_name=$9,reported_by_position=$10,
                acknowledged_by_name=$11,acknowledged_by_position=$12,reference_memo_no=$13,reference_agenda_no=$14,
                reference_archive_no=$15,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
        [req.params.id,trimText(req.body.subject,300),trimText(req.body.scopeType,40)||meeting.scope_type,trimText(req.body.projectName,240),
         normalizeDate(req.body.meetingDate)||meeting.meeting_date,trimText(req.body.startTime,8)||null,trimText(req.body.endTime,8)||null,
         trimText(req.body.place,240),trimText(req.body.reportedByName,160),trimText(req.body.reportedByPosition,160),
         trimText(req.body.acknowledgedByName,160),trimText(req.body.acknowledgedByPosition,160),trimText(req.body.referenceMemoNo,120),
         trimText(req.body.referenceAgendaNo,120),trimText(req.body.referenceArchiveNo,120)]
    );
    await logActivity(req,'meeting',req.params.id,'updated','Draft Risalah diperbarui');
    res.json(await getMeetingDetail(req.params.id));
});

route('post', '/meetings/:id/status', async (req, res) => {
    if (!isDivisionHead(req)) return res.status(403).json({ error: 'Division Head approval required' });
    const status = normalizeEnum(req.body.status, MEETING_STATUSES, '');
    if (!status || status === 'draft') return res.status(400).json({ error: 'Invalid meeting status' });
    const result = await pool.query(
        `UPDATE bim_ops_meetings SET status=$2,issued_at=CASE WHEN $2='issued' THEN CURRENT_TIMESTAMP ELSE issued_at END,
                closed_at=CASE WHEN $2='closed' THEN CURRENT_TIMESTAMP ELSE closed_at END,updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 RETURNING *`, [req.params.id,status]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Risalah not found' });
    await logActivity(req,'meeting',req.params.id,status,`Risalah berstatus ${status}`);
    res.json(await getMeetingDetail(req.params.id));
});

route('post', '/meetings/:id/actions', async (req, res) => {
    if (!canWrite(req)) return res.status(403).json({ error: 'Write access required' });
    const description = trimText(req.body.description,4000);
    if (!description) return res.status(400).json({ error: 'Action description is required' });
    const meeting = await pool.query(`SELECT * FROM bim_ops_meetings WHERE id=$1`, [req.params.id]);
    if (!meeting.rows.length) return res.status(404).json({ error: 'Risalah not found' });
    if (meeting.rows[0].status === 'closed') return res.status(409).json({ error: 'Closed Risalah is locked' });
    const id = newId('action');
    const result = await pool.query(
        `INSERT INTO bim_ops_meeting_actions
         (id,meeting_id,section_type,description,action_owner_name,action_owner_user_id,planned_due_date,status,evidence_link,
          created_by_user_id,created_by_name_snapshot)
         VALUES ($1,$2,'current',$3,$4,$5,$6,'open',$7,$8,$9) RETURNING *`,
        [id,req.params.id,description,trimText(req.body.ownerName,160),trimText(req.body.ownerUserId,100)||null,
         normalizeDate(req.body.dueDate),trimText(req.body.evidenceLink,2000),actorId(req),actorName(req)]
    );
    await logActivity(req,'meeting_action',id,'created',`Action item dibuat: ${description.slice(0,120)}`);
    res.status(201).json(result.rows[0]);
});

route('put', '/meeting-actions/:id', async (req, res) => {
    const existing = await pool.query(`SELECT * FROM bim_ops_meeting_actions WHERE id=$1`, [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Action item not found' });
    const action = existing.rows[0];
    const allowed = isDivisionHead(req) || action.action_owner_user_id === actorId(req) || action.created_by_user_id === actorId(req);
    if (!allowed) return res.status(403).json({ error: 'Action update denied' });
    const status = normalizeEnum(req.body.status,ACTION_STATUSES,action.status);
    if (status === 'closed' && !isDivisionHead(req)) return res.status(403).json({ error: 'Division Head closes action items' });
    const result = await pool.query(
        `UPDATE bim_ops_meeting_actions SET status=$2,review_note=$3,reviewer_name=$4,reviewer_user_id=$5,
                review_date=CASE WHEN $2='closed' THEN CURRENT_DATE ELSE review_date END,
                evidence_link=COALESCE(NULLIF($6,''),evidence_link),closed_at=CASE WHEN $2='closed' THEN CURRENT_TIMESTAMP ELSE NULL END,
                updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`,
        [req.params.id,status,trimText(req.body.reviewNote,3000),isDivisionHead(req)?actorName(req):action.reviewer_name,
         isDivisionHead(req)?actorId(req):action.reviewer_user_id,trimText(req.body.evidenceLink,2000)]
    );
    await logActivity(req,'meeting_action',req.params.id,'updated',`Action item berstatus ${status}`);
    res.json(result.rows[0]);
});

route('post', '/meeting-actions/:id/create-task', async (req, res) => {
    if (!canWrite(req)) return res.status(403).json({ error: 'Write access required' });
    const actionResult = await pool.query(`SELECT * FROM bim_ops_meeting_actions WHERE id=$1`, [req.params.id]);
    if (!actionResult.rows.length) return res.status(404).json({ error: 'Action item not found' });
    const action = actionResult.rows[0];
    if (action.created_task_id) return res.status(409).json({ error: 'Action already linked to a task' });
    const id = newId('task');
    const period = normalizePeriod(req.body.period || (action.planned_due_date ? String(action.planned_due_date).slice(0,7) : ''));
    const directApproval = isDivisionHead(req);
    const task = await pool.query(
        `INSERT INTO bim_ops_tasks
         (id,period_month,title,description,task_type,pic_user_id,pic_name_snapshot,due_date,priority,intake_status,status,
          source_type,source_id,created_by_user_id,created_by_name_snapshot)
         VALUES ($1,$2,$3,$4,'coordination',$5,$6,$7,'normal',$8,'planned','risalah_action',$9,$10,$11) RETURNING *`,
        [id,period,trimText(req.body.title,240)||action.description.slice(0,240),action.description,action.action_owner_user_id,
         action.action_owner_name,action.planned_due_date,directApproval?'approved':'draft',action.id,actorId(req),actorName(req)]
    );
    await pool.query(`UPDATE bim_ops_meeting_actions SET created_task_id=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [action.id,id]);
    await logActivity(req,'task',id,'created_from_meeting','Task dibuat dari action Risalah',{actionId:action.id});
    res.status(201).json(mapTask(task.rows[0]));
});

function mapIssue(row) {
    return {
        id: row.id,
        issueDate: row.issue_date,
        periodMonth: row.period_month,
        title: row.title,
        description: row.description,
        issueType: row.issue_type,
        projectContext: row.project_context || '',
        severity: row.severity,
        status: row.status,
        reportedByUserId: row.reported_by_user_id,
        reportedByName: row.reported_by_name_snapshot,
        ownerUserId: row.owner_user_id || '',
        ownerName: row.owner_name_snapshot || '',
        dueDate: row.due_date,
        impactNote: row.impact_note || '',
        actionNote: row.action_note || '',
        mitigationNote: row.mitigation_note || '',
        resolutionNote: row.resolution_note || '',
        evidenceLink: row.evidence_link || '',
        sourceType: row.source_type || 'manual',
        sourceId: row.source_id || '',
        createdTaskId: row.created_task_id || '',
        acceptanceNote: row.acceptance_note || '',
        rejectionReason: row.rejection_reason || '',
        closureNote: row.closure_note || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

route('get', '/issues', async (req, res) => {
    const period = normalizePeriod(req.query.period);
    const manager = isDivisionHead(req) || req.workspaceRole === 'system_admin';
    const result = await pool.query(
        `SELECT * FROM bim_ops_issues WHERE period_month=$1
           AND (status IN ('submitted','accepted','action_required','resolved_pending_approval','closed')
                OR reported_by_user_id=$2 OR $3::boolean=true)
         ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
                  issue_date DESC,created_at DESC`, [period,actorId(req),manager]
    );
    res.json(result.rows.map(mapIssue));
});

route('post', '/issues', async (req, res) => {
    if (!canWrite(req)) return res.status(403).json({ error: 'Issue write access required' });
    const title = trimText(req.body.title,300);
    const description = trimText(req.body.description,6000);
    if (!title || !description) return res.status(400).json({ error: 'Issue title and description are required' });
    const issueDate = normalizeDate(req.body.issueDate) || new Date().toISOString().slice(0,10);
    const id = newId('issue');
    const result = await pool.query(
        `INSERT INTO bim_ops_issues
         (id,issue_date,period_month,title,description,issue_type,project_context,severity,status,
          reported_by_user_id,reported_by_name_snapshot,owner_user_id,owner_name_snapshot,due_date,impact_note,
          action_note,mitigation_note,resolution_note,evidence_link,source_type,source_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
        [id,issueDate,issueDate.slice(0,7),title,description,normalizeEnum(req.body.issueType,ISSUE_TYPES,'internal_issue'),
         trimText(req.body.projectContext,240),normalizeEnum(req.body.severity,SEVERITIES,'medium'),actorId(req),actorName(req),
         trimText(req.body.ownerUserId,100)||null,trimText(req.body.ownerName,160)||null,normalizeDate(req.body.dueDate),
         trimText(req.body.impactNote,4000),trimText(req.body.actionNote,4000),trimText(req.body.mitigationNote,4000),
         trimText(req.body.resolutionNote,4000),trimText(req.body.evidenceLink,2000),trimText(req.body.sourceType,40)||'manual',
         trimText(req.body.sourceId,120)||null]
    );
    await logActivity(req,'issue',id,'created',`Draft issue dibuat: ${title}`);
    res.status(201).json(mapIssue(result.rows[0]));
});

route('put', '/issues/:id', async (req, res) => {
    const existing = await pool.query(`SELECT * FROM bim_ops_issues WHERE id=$1`, [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Issue not found' });
    const issue = existing.rows[0];
    const manager = isDivisionHead(req);
    if (!manager && issue.reported_by_user_id !== actorId(req) && issue.owner_user_id !== actorId(req)) return res.status(403).json({ error: 'Issue edit denied' });
    if (!manager && !['draft','accepted','action_required'].includes(issue.status)) return res.status(409).json({ error: 'Issue is locked in current status' });
    const result = await pool.query(
        `UPDATE bim_ops_issues SET title=COALESCE(NULLIF($2,''),title),description=COALESCE(NULLIF($3,''),description),
                issue_type=$4,project_context=$5,severity=$6,owner_user_id=$7,owner_name_snapshot=$8,due_date=$9,
                impact_note=$10,action_note=$11,mitigation_note=$12,resolution_note=$13,evidence_link=$14,
                updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`,
        [req.params.id,trimText(req.body.title,300),trimText(req.body.description,6000),
         normalizeEnum(req.body.issueType,ISSUE_TYPES,issue.issue_type),trimText(req.body.projectContext,240),
         normalizeEnum(req.body.severity,SEVERITIES,issue.severity),trimText(req.body.ownerUserId,100)||null,
         trimText(req.body.ownerName,160)||null,normalizeDate(req.body.dueDate),trimText(req.body.impactNote,4000),
         trimText(req.body.actionNote,4000),trimText(req.body.mitigationNote,4000),trimText(req.body.resolutionNote,4000),
         trimText(req.body.evidenceLink,2000)]
    );
    await logActivity(req,'issue',req.params.id,'updated',`Issue diperbarui: ${result.rows[0].title}`);
    res.json(mapIssue(result.rows[0]));
});

route('post', '/issues/:id/submit', async (req, res) => {
    const result = await pool.query(
        `UPDATE bim_ops_issues SET status='submitted',submitted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 AND reported_by_user_id=$2 AND status='draft' RETURNING *`, [req.params.id,actorId(req)]
    );
    if (!result.rows.length) return res.status(409).json({ error: 'Issue cannot be submitted' });
    await logActivity(req,'issue',req.params.id,'submitted','Issue diajukan untuk approval');
    res.json(mapIssue(result.rows[0]));
});

route('post', '/issues/:id/review', async (req, res) => {
    if (!isDivisionHead(req)) return res.status(403).json({ error: 'Division Head approval required' });
    const action = normalizeEnum(req.body.action,new Set(['accept','reject']),'');
    if (!action) return res.status(400).json({ error: 'Invalid issue review action' });
    const next = action === 'accept' ? 'accepted' : 'rejected';
    const result = await pool.query(
        `UPDATE bim_ops_issues SET status=$2,accepted_by_user_id=$3,accepted_by_name_snapshot=$4,
                accepted_at=CASE WHEN $2='accepted' THEN CURRENT_TIMESTAMP ELSE accepted_at END,
                acceptance_note=CASE WHEN $2='accepted' THEN $5 ELSE acceptance_note END,
                rejection_reason=CASE WHEN $2='rejected' THEN $5 ELSE rejection_reason END,updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 AND status='submitted' RETURNING *`,
        [req.params.id,next,actorId(req),actorName(req),trimText(req.body.note,3000)]
    );
    if (!result.rows.length) return res.status(409).json({ error: 'Issue is not pending review' });
    await logActivity(req,'issue',req.params.id,action,`Issue ${action}`);
    res.json(mapIssue(result.rows[0]));
});

route('post', '/issues/:id/request-closure', async (req, res) => {
    const result = await pool.query(
        `UPDATE bim_ops_issues SET status='resolved_pending_approval',resolution_note=$3,closure_note=$4,
                closure_requested_by_user_id=$2,closure_requested_at=CURRENT_TIMESTAMP,
                evidence_link=COALESCE(NULLIF($5,''),evidence_link),updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 AND status IN ('accepted','action_required')
           AND (reported_by_user_id=$2 OR owner_user_id=$2) RETURNING *`,
        [req.params.id,actorId(req),trimText(req.body.resolutionNote,4000),trimText(req.body.closureNote,3000),trimText(req.body.evidenceLink,2000)]
    );
    if (!result.rows.length) return res.status(409).json({ error: 'Issue closure cannot be requested' });
    await logActivity(req,'issue',req.params.id,'closure_requested','Closure issue diajukan');
    res.json(mapIssue(result.rows[0]));
});

route('post', '/issues/:id/closure-review', async (req, res) => {
    if (!isDivisionHead(req)) return res.status(403).json({ error: 'Division Head approval required' });
    const approve = req.body.action === 'approve';
    const result = await pool.query(
        `UPDATE bim_ops_issues SET status=$2,closed_by_user_id=CASE WHEN $2='closed' THEN $3 ELSE NULL END,
                closed_by_name_snapshot=CASE WHEN $2='closed' THEN $4 ELSE NULL END,
                closed_at=CASE WHEN $2='closed' THEN CURRENT_TIMESTAMP ELSE NULL END,
                closure_approval_note=$5,updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 AND status='resolved_pending_approval' RETURNING *`,
        [req.params.id,approve?'closed':'action_required',actorId(req),actorName(req),trimText(req.body.note,3000)]
    );
    if (!result.rows.length) return res.status(409).json({ error: 'Issue is not pending closure approval' });
    await logActivity(req,'issue',req.params.id,approve?'closed':'reopened',approve?'Issue ditutup':'Issue dikembalikan untuk tindak lanjut');
    res.json(mapIssue(result.rows[0]));
});

route('post', '/issues/:id/create-task', async (req, res) => {
    if (!canWrite(req)) return res.status(403).json({ error: 'Write access required' });
    const issueResult = await pool.query(`SELECT * FROM bim_ops_issues WHERE id=$1`, [req.params.id]);
    if (!issueResult.rows.length) return res.status(404).json({ error: 'Issue not found' });
    const issue = issueResult.rows[0];
    if (!['accepted','action_required'].includes(issue.status)) return res.status(409).json({ error: 'Only accepted issues can create tasks' });
    if (issue.created_task_id) return res.status(409).json({ error: 'Issue already linked to a task' });
    const id = newId('task');
    const directApproval = isDivisionHead(req);
    const task = await pool.query(
        `INSERT INTO bim_ops_tasks
         (id,period_month,title,description,project_name,task_type,pic_user_id,pic_name_snapshot,due_date,priority,
          intake_status,status,source_type,source_id,created_by_user_id,created_by_name_snapshot)
         VALUES ($1,$2,$3,$4,$5,'coordination',$6,$7,$8,$9,$10,'planned','issue',$11,$12,$13) RETURNING *`,
        [id,normalizePeriod(req.body.period||issue.period_month),trimText(req.body.title,240)||issue.title,issue.description,
         issue.project_context,issue.owner_user_id,issue.owner_name_snapshot,issue.due_date,
         issue.severity==='critical'?'urgent':issue.severity==='high'?'high':'normal',directApproval?'approved':'draft',
         issue.id,actorId(req),actorName(req)]
    );
    await pool.query(`UPDATE bim_ops_issues SET created_task_id=$2,status='action_required',updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [issue.id,id]);
    await logActivity(req,'task',id,'created_from_issue','Task dibuat dari issue',{issueId:issue.id});
    res.status(201).json(mapTask(task.rows[0]));
});

route('get', '/reports/summary', async (req, res) => {
    const period = normalizePeriod(req.query.period);
    const [tasks, issues, actions, worklogs] = await Promise.all([
        pool.query(`SELECT id,title,project_name,pic_name_snapshot,start_date,due_date,priority,status,progress_percent,intake_status,evidence_link
                    FROM bim_ops_tasks WHERE period_month=$1 AND intake_status='approved' ORDER BY due_date NULLS LAST,title`,[period]),
        pool.query(`SELECT issue_date,title,project_context,severity,status,reported_by_name_snapshot,owner_name_snapshot,due_date
                    FROM bim_ops_issues WHERE period_month=$1 AND status NOT IN ('draft','rejected','cancelled') ORDER BY severity,due_date`,[period]),
        pool.query(`SELECT m.meeting_no,m.subject,a.description,a.action_owner_name,a.planned_due_date,a.status
                    FROM bim_ops_meeting_actions a JOIN bim_ops_meetings m ON m.id=a.meeting_id
                    WHERE m.period_month=$1 AND a.status NOT IN ('closed','cancelled') ORDER BY a.planned_due_date NULLS LAST`,[period]),
        pool.query(`SELECT w.work_date,w.task_item_text,w.project_name,w.pic_user_id,w.pic_name_snapshot,
                           wt.hours_spent,w.work_summary,w.output_result,w.blocker,w.next_action,w.source_type
                    FROM bim_ops_worklogs w
                    LEFT JOIN bim_ops_worklog_time wt ON wt.worklog_id=w.id AND wt.user_id=$2
                    WHERE w.period_month=$1 AND w.confirmation_status='confirmed'
                    ORDER BY w.work_date DESC`,[period,actorId(req)])
    ]);
    const sanitizedWorklogs = worklogs.rows.map((row) => ({
        ...row,
        hours_spent: row.pic_user_id === actorId(req) ? Number(row.hours_spent || 0) : null
    }));
    res.json({ period,tasks:tasks.rows,issues:issues.rows,meetingActions:actions.rows,worklogs:sanitizedWorklogs });
});

router.use((error, req, res, next) => {
    console.error('ERROR: Divisi BIM Workspace route failed:', error);
    if (res.headersSent) return next(error);
    res.status(500).json({ error: 'Divisi BIM Workspace operation failed' });
});

module.exports = router;
