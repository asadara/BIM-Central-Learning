const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    BIM_COMPETENCY_LEVELS,
    mapUserProfileState,
    normalizeBimCompetencyLevel,
    normalizeCompetencyStatus,
    normalizePositionVerificationStatus,
    normalizeSystemRole
} = require('../backend/utils/userProfileSchema');
const { normalizeAccessProfile } = require('../backend/utils/userAccess');
const { isAdminRole } = require('../backend/utils/auth');

assert.deepStrictEqual(BIM_COMPETENCY_LEVELS, [
    'BIM Modeller',
    'BIM Coordinator',
    'BIM Specialist',
    'BIM Manager'
]);

assert.strictEqual(normalizeBimCompetencyLevel(''), null);
assert.strictEqual(normalizeBimCompetencyLevel('bim specialist'), 'BIM Specialist');
assert.strictEqual(normalizeBimCompetencyLevel('Expert'), null);
assert.strictEqual(normalizeCompetencyStatus('', null), 'not_assessed');
assert.strictEqual(normalizeCompetencyStatus('', 'BIM Modeller'), 'self_declared');
assert.strictEqual(normalizePositionVerificationStatus('VERIFIED'), 'verified');
assert.strictEqual(normalizeSystemRole('unknown'), 'employee');

const separatedProfile = mapUserProfileState({
    position_label: 'Site Engineer',
    position_verification_status: 'verified',
    bim_level: 'BIM Coordinator',
    competency_status: 'assessment_in_progress',
    target_bim_level: 'BIM Specialist',
    system_role: 'employee'
});

assert.deepStrictEqual(separatedProfile, {
    positionLabel: 'Site Engineer',
    positionVerificationStatus: 'verified',
    competencyLevel: 'BIM Coordinator',
    competencyStatus: 'assessment_in_progress',
    targetCompetencyLevel: 'BIM Specialist',
    systemRole: 'employee'
});

const unclassifiedProfile = mapUserProfileState({ position_label: 'Project Controller' });
assert.strictEqual(unclassifiedProfile.positionLabel, 'Project Controller');
assert.strictEqual(unclassifiedProfile.competencyLevel, null);
assert.strictEqual(unclassifiedProfile.competencyStatus, 'not_assessed');

assert.strictEqual(normalizeAccessProfile({ bimWorkspaceRole: 'staff_bim' }).bimWorkspaceRole, 'staff_bim');
assert.strictEqual(normalizeAccessProfile({ bimWorkspaceRole: 'division_head' }).bimWorkspaceRole, 'division_head');
assert.notStrictEqual(
    normalizeAccessProfile({ bimWorkspaceRole: 'BIM Specialist' }).bimWorkspaceRole,
    'BIM Specialist'
);
assert.strictEqual(isAdminRole('system_admin'), true);
assert.strictEqual(isAdminRole('System Administrator'), false);
assert.strictEqual(isAdminRole('Project Admin'), false);

for (const relativeFile of [
    'BC-Learning-Main/pages/login.html',
    'BC-Learning-Main/pages/signup.html'
]) {
    const html = fs.readFileSync(path.join(__dirname, '..', relativeFile), 'utf8');
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
        .map((match) => match[1].trim())
        .filter(Boolean);
    scripts.forEach((source) => new Function(source));
}

const profileHtml = fs.readFileSync(
    path.join(__dirname, '..', 'BC-Learning-Main/elearning-assets/profile.html'),
    'utf8'
);
const sidebarTheme = fs.readFileSync(
    path.join(__dirname, '..', 'BC-Learning-Main/elearning-assets/css/workspace-theme.css'),
    'utf8'
);
assert.strictEqual(profileHtml.includes('profile-data-status'), false);
assert.strictEqual(sidebarTheme.includes('.sidebar-competency-pill'), true);

console.log('User profile schema smoke checks passed.');
