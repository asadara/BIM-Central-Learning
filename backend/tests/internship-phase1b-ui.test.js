const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ui = require('../../BC-Learning-Main/elearning-assets/js/internship.js');

const frontendRoot = path.join(__dirname, '../../BC-Learning-Main');

function fixturePath() {
    return {
        id: 'pilot-path',
        title: 'BIM & Digital Engineering',
        versionNumber: 1,
        modules: [{
            id: 'module-2', moduleKey: 'information', title: 'Information Management',
            outcome: 'Mengelola informasi proyek.', sequenceNumber: 2,
            progress: { required: 1, completed: 0, percent: 0 },
            items: [{
                contentId: 'pdf:information', type: 'pdf', title: 'Information Manual',
                href: '/public/reader.html?material=information', required: true,
                sequenceNumber: 1, status: 'not_started'
            }], assessments: []
        }, {
            id: 'module-1', moduleKey: 'mindset', title: 'BIM Mindset',
            outcome: 'Memahami BIM sebagai proses informasi.', sequenceNumber: 1,
            progress: { required: 2, completed: 1, percent: 50 },
            items: [{
                contentId: 'page:bim-mindset', type: 'page', title: 'Konsep BIM Mindset',
                href: '/pages/bim-mindset.html', required: true,
                sequenceNumber: 1, status: 'completed'
            }, {
                contentId: 'video:workflow', type: 'video', title: 'Workflow BIM',
                href: '/elearning-assets/courses.html?contentId=video%3Aworkflow', required: true,
                sequenceNumber: 2, status: 'not_started'
            }], assessments: []
        }]
    };
}

test('program selection only accepts batch IDs returned by /me', () => {
    const enrollments = [{ id: 'allowed-a' }, { id: 'allowed-b' }];
    assert.equal(ui.chooseEnrollment(enrollments, 'allowed-b').id, 'allowed-b');
    assert.equal(ui.chooseEnrollment(enrollments, 'modified-url-batch').id, 'allowed-a');
    assert.equal(ui.chooseEnrollment([{ id: 'only-program' }], null).id, 'only-program');
    assert.equal(ui.chooseEnrollment([], 'anything'), null);
});

test('learning path order and current focus derive from the first incomplete required item', () => {
    const journey = ui.deriveJourney(fixturePath(), { percent: 18.5, completed: 1, required: 3 });
    assert.deepEqual(journey.modules.map((module) => module.title), ['BIM Mindset', 'Information Management']);
    assert.equal(journey.current.module.moduleKey, 'mindset');
    assert.equal(journey.current.entry.id, 'video:workflow');
    assert.equal(journey.modules[0].uiStatus, 'in_progress');
    assert.equal(journey.modules[0].entries[0].uiStatus, 'completed');
    assert.equal(journey.modules[0].entries[1].uiStatus, 'in_progress');
});

test('overall progress displays the exact server value rather than recomputing it', () => {
    const journey = ui.deriveJourney(fixturePath(), { percent: 18.5, completed: 1, required: 3 });
    assert.equal(journey.progress.percent, 18.5);
    assert.equal(journey.progress.completed, 1);
    assert.equal(journey.progress.required, 3);
});

test('canonical BCL hrefs remain links and unsafe or unknown references become unavailable', () => {
    assert.equal(ui.safeContentHref('/pages/bim-mindset.html'), '/pages/bim-mindset.html');
    assert.equal(
        ui.safeContentHref('/public/reader.html?material=manual-one'),
        '/public/reader.html?material=manual-one'
    );
    assert.equal(ui.safeContentHref('file:///G:/secret.pdf'), null);
    assert.equal(ui.safeContentHref('/api/video-stream/G%3A%2Fsecret.mp4'), null);
    assert.equal(ui.safeContentHref('\\\\pc-bim02\\secret.pdf'), null);

    const pathData = fixturePath();
    pathData.modules[0].items[0].href = '\\\\pc-bim02\\secret.pdf';
    pathData.modules[0].items[0].title = 'G:\\confidential\\manual.pdf';
    const markup = ui.renderLearningPathMarkup(ui.deriveJourney(pathData, { percent: 0, completed: 0, required: 3 }));
    assert.equal(markup.includes('pc-bim02'), false);
    assert.equal(markup.includes('G:\\'), false);
    assert.match(markup, /Belum tersedia/);
});

test('completed, current, and not-started participant statuses render without technical state names', () => {
    const markup = ui.renderLearningPathMarkup(ui.deriveJourney(fixturePath(), { percent: 18, completed: 1, required: 3 }));
    assert.match(markup, /Selesai/);
    assert.match(markup, /Sedang Dipelajari/);
    assert.match(markup, /Belum Mulai/);
    assert.doesNotMatch(markup, /not_started|in_progress|learning_activity_events/);
});

test('feature-disabled and unauthorized responses map to safe participant states', () => {
    assert.equal(ui.classifyFailure(404, 'enrollments'), 'feature_disabled');
    assert.equal(ui.classifyFailure(404, 'program'), 'unavailable');
    assert.equal(ui.classifyFailure(403, 'program'), 'unauthorized');
    assert.equal(ui.classifyFailure(401, 'program'), 'unauthenticated');
});

test('participant state copy covers loading, empty, disabled, access, unavailable, and backend failures', () => {
    const source = fs.readFileSync(path.join(frontendRoot, 'elearning-assets/js/internship.js'), 'utf8');
    for (const stateName of [
        'loading', 'empty', 'feature_disabled', 'unauthenticated', 'unauthorized', 'unavailable', 'error'
    ]) assert.match(source, new RegExp(`${stateName}:`), stateName);
    assert.match(source, /Anda belum terdaftar pada program magang aktif/);
    assert.match(source, /Data program belum dapat dimuat/);
    assert.doesNotMatch(source, /error\.message|error\.stack/);
});

test('an entirely completed required path reports completion without inferring final Internship completion', () => {
    const pathData = fixturePath();
    pathData.modules.forEach((module) => {
        module.items.forEach((item) => { item.status = 'completed'; });
    });
    const journey = ui.deriveJourney(pathData, { percent: 100, completed: 3, required: 3 });
    assert.equal(journey.current, null);
    assert.equal(journey.allComplete, true);
    assert.equal(journey.progress.percent, 100);
});

test('page consumes all Phase 1A endpoints and contains no local learning-state fallback', () => {
    const source = fs.readFileSync(path.join(frontendRoot, 'elearning-assets/js/internship.js'), 'utf8');
    assert.match(source, /\/api\/training\/internships/);
    assert.match(source, /\$\{API_BASE\}\/me/);
    assert.match(source, /\$\{API_BASE\}\/\$\{encoded\}\/learning-path/);
    assert.match(source, /\$\{API_BASE\}\/\$\{encoded\}\/progress/);
    assert.doesNotMatch(source, /bcl_completed_|bcl_video_completed_|examHistory|practiceHistory|gamification_userProgress/);
    assert.doesNotMatch(source, /localStorage\.(?:getItem|setItem)\([^)]*(?:progress|completion|history)/i);
    assert.match(source, /addEventListener\('pageshow'/);
});

test('both navbar fragments use the same default-hidden feature-gated Internship entry', () => {
    const fragments = [
        path.join(frontendRoot, 'components/navbar.html'),
        path.join(frontendRoot, 'elearning-assets/components/navbar.html')
    ].map((file) => fs.readFileSync(file, 'utf8'));
    fragments.forEach((html) => {
        assert.match(html, /href="\/elearning-assets\/internship\.html"/);
        assert.match(html, /data-internship-nav hidden style="display: none;"/);
        assert.match(html, /\/api\/training\/internships\/me/);
        assert.match(html, /Magang \/ Internship/);
    });
});

test('participant page uses the native workspace shell and contains no pilot identity or out-of-scope workflow', () => {
    const html = fs.readFileSync(path.join(frontendRoot, 'elearning-assets/internship.html'), 'utf8');
    assert.match(html, /class="elearn-workspace-theme"/);
    assert.match(html, /component-loader\.js/);
    assert.match(html, /sidebar-loader\.js/);
    assert.match(html, /internship\.css/);
    assert.doesNotMatch(html, /Ridho|evidence upload|mentor scoring|attendance|capstone project/i);
});

test('existing core BCL learning surfaces remain present', () => {
    for (const relativePath of [
        'pages/elearning.html',
        'elearning-assets/dashboard.html',
        'elearning-assets/my-training.html',
        'elearning-assets/courses.html'
    ]) assert.equal(fs.existsSync(path.join(frontendRoot, relativePath)), true, relativePath);
});
