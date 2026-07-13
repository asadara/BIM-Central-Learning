const KPI_YEAR = 2026;
const MAX_ACHIEVEMENT = 1.2;

const PERSPECTIVES = {
    financial_market: 'Keuangan & Pasar',
    customer_focus: 'Fokus Pelanggan',
    product_process: 'Efektivitas Produk & Proses',
    learning_growth: 'Pembelajaran & Pertumbuhan'
};

function indicator(config) {
    return {
        targetOperator: '>=',
        targetUnit: 'percent',
        achievementFormula: 'MIN(Hasil pengukuran / Target, 120%)',
        zeroDenominatorPolicy: 'not_measured',
        ...config,
        perspectiveName: PERSPECTIVES[config.perspectiveCode]
    };
}

const departmentIndicators = [
    indicator({
        id: 'kpi-dept-eng-2026-01', code: 'DEPT-01', sortOrder: 1,
        perspectiveCode: 'financial_market', name: 'Implementasi Value Engineering',
        measurementFormula: '(VE terimplementasi / Total permintaan dan inisiatif VE) x 100%',
        aggregationMethod: 'ratio_of_sums', targetValue: 1, weight: 0.15,
        calculationConfig: { mode: 'ratio', numerator: 've_implemented', denominator: 've_requests_and_initiatives' },
        sourceReference: 'Scorecard Dept Eng!C15:G15'
    }),
    indicator({
        id: 'kpi-dept-eng-2026-02', code: 'DEPT-02', sortOrder: 2,
        perspectiveCode: 'financial_market', name: 'Efisiensi Budget RKAP',
        measurementFormula: '(Rencana budget RKAP / Aktual budget RKAP) x 100%',
        aggregationMethod: 'ratio_of_sums', targetValue: 0.95, weight: 0.05,
        calculationConfig: { mode: 'inverse_ratio', numerator: 'rkap_plan', denominator: 'rkap_actual' },
        sourceReference: 'Scorecard Dept Eng!C16:G16'
    }),
    indicator({
        id: 'kpi-dept-eng-2026-03', code: 'DEPT-03', sortOrder: 3,
        perspectiveCode: 'customer_focus', name: 'Dukungan Engineering',
        measurementFormula: '(Realisasi dukungan Engineering / Permintaan dukungan Engineering) x 100%',
        aggregationMethod: 'ratio_of_sums', targetValue: 1, weight: 0.15,
        calculationConfig: { mode: 'ratio', numerator: 'engineering_support_completed', denominator: 'engineering_support_requests' },
        sourceReference: 'Scorecard Dept Eng!C18:G18'
    }),
    indicator({
        id: 'kpi-dept-eng-2026-04', code: 'DEPT-04', sortOrder: 4,
        perspectiveCode: 'product_process', name: 'Implementasi BIM',
        measurementFormula: '(Aktual implementasi BIM / Rencana implementasi BIM) x 100%',
        aggregationMethod: 'ratio_of_sums', targetValue: 1, weight: 0.10,
        calculationConfig: { mode: 'ratio', numerator: 'bim_implementations_actual', denominator: 'bim_implementations_plan' },
        sourceReference: 'Scorecard Dept Eng!C20:G20'
    }),
    indicator({
        id: 'kpi-dept-eng-2026-05', code: 'DEPT-05', sortOrder: 5,
        perspectiveCode: 'product_process', name: 'Performa Quality Survey',
        measurementFormula: 'AVERAGE(Pemenuhan peralatan Survey, Quality Survey Program, Akurasi data Survey)',
        aggregationMethod: 'average_components', targetValue: 1, weight: 0.10,
        calculationConfig: { mode: 'average', inputs: ['survey_equipment_fulfillment', 'survey_program_quality', 'survey_data_accuracy'] },
        sourceReference: 'Scorecard Dept Eng!C21:G21'
    }),
    indicator({
        id: 'kpi-dept-eng-2026-06', code: 'DEPT-06', sortOrder: 6,
        perspectiveCode: 'product_process', name: 'Program Digitalisasi',
        measurementFormula: '(Aktual milestone digitalisasi / Rencana milestone digitalisasi) x 100%',
        aggregationMethod: 'latest_checkpoint', targetValue: 1, weight: 0.10,
        calculationConfig: { mode: 'latest_ratio', numerator: 'digitalization_actual_checkpoint', denominator: 'digitalization_plan_checkpoint' },
        sourceReference: 'Scorecard Dept Eng!C22:G22'
    }),
    indicator({
        id: 'kpi-dept-eng-2026-07', code: 'DEPT-07', sortOrder: 7,
        perspectiveCode: 'product_process', name: 'Implementasi PMP Engineering',
        measurementFormula: 'AVERAGE(Score PMP Engineering seluruh project)',
        aggregationMethod: 'average_period_scores', targetValue: 0.70, weight: 0.15,
        calculationConfig: { mode: 'average', inputs: ['pmp_engineering_project_scores'], inputScale: '0_to_1' },
        sourceReference: 'Scorecard Dept Eng!C23:G23'
    }),
    indicator({
        id: 'kpi-dept-eng-2026-08', code: 'DEPT-08', sortOrder: 8,
        perspectiveCode: 'learning_growth', name: 'Pelatihan & Pengembangan',
        measurementFormula: '(Aktual pelatihan / Rencana pelatihan) x 100%',
        aggregationMethod: 'ratio_of_sums', targetValue: 1, weight: 0.05,
        calculationConfig: { mode: 'ratio', numerator: 'training_actual', denominator: 'training_plan' },
        sourceReference: 'Scorecard Dept Eng!C25:G25'
    }),
    indicator({
        id: 'kpi-dept-eng-2026-09', code: 'DEPT-09', sortOrder: 9,
        perspectiveCode: 'learning_growth', name: 'Engineering Capability Upgrade',
        measurementFormula: '(Aktual personel ter-develop / Rencana pengembangan personel Engineering) x 100%',
        aggregationMethod: 'ratio_of_sums', targetValue: 1, weight: 0.05,
        calculationConfig: { mode: 'ratio', numerator: 'capability_people_actual', denominator: 'capability_people_plan' },
        sourceReference: 'Scorecard Dept Eng!C26:G26'
    }),
    indicator({
        id: 'kpi-dept-eng-2026-10', code: 'DEPT-10', sortOrder: 10,
        perspectiveCode: 'learning_growth', name: 'Inovasi & Improvisasi',
        measurementFormula: 'Jumlah inovasi QCC/QCP tervalidasi secara kumulatif YTD',
        aggregationMethod: 'cumulative_count', targetValue: 3, targetUnit: 'qty', weight: 0.10,
        calculationConfig: { mode: 'cumulative_count', input: 'validated_innovations' },
        sourceReference: 'Scorecard Dept Eng!C27:G27'
    })
];

const divisionIndicators = [
    indicator({
        id: 'kpi-div-bim-2026-01', code: 'BIM-01', sortOrder: 1, parentIndicatorId: 'kpi-dept-eng-2026-01',
        perspectiveCode: 'financial_market', name: 'Implementasi Value Engineering', programName: 'Program VE berbasis BIM', relationType: 'contribution',
        measurementFormula: '(VE berbasis BIM terimplementasi / Total permintaan dan inisiatif VE yang memerlukan dukungan BIM) x 100%',
        aggregationMethod: 'ratio_of_sums', targetValue: 1, weight: 0.15,
        calculationConfig: { mode: 'ratio', numerator: 'bim_ve_implemented', denominator: 'bim_ve_requests_and_initiatives' },
        sourceReference: 'Scorecard Div BIM!C21:I21'
    }),
    indicator({
        id: 'kpi-div-bim-2026-02', code: 'BIM-02', sortOrder: 2, parentIndicatorId: 'kpi-dept-eng-2026-02',
        perspectiveCode: 'financial_market', name: 'Efisiensi Budget RKAP', programName: 'Program Pengendalian RKAP BIM', relationType: 'scoped_rollup',
        measurementFormula: '(Rencana budget RKAP Divisi BIM / Aktual budget RKAP Divisi BIM) x 100%',
        aggregationMethod: 'ratio_of_sums', targetValue: 0.95, weight: 0.05,
        calculationConfig: { mode: 'inverse_ratio', numerator: 'bim_rkap_plan', denominator: 'bim_rkap_actual' },
        sourceReference: 'Scorecard Div BIM!C23:I23'
    }),
    indicator({
        id: 'kpi-div-bim-2026-03', code: 'BIM-03', sortOrder: 3, parentIndicatorId: 'kpi-dept-eng-2026-03',
        perspectiveCode: 'customer_focus', name: 'Dukungan Engineering', programName: 'Program Support BIM Tender & Proyek', relationType: 'contribution',
        measurementFormula: '(Realisasi dukungan BIM / Permintaan dukungan BIM) x 100%',
        aggregationMethod: 'ratio_of_sums', targetValue: 1, weight: 0.15,
        calculationConfig: { mode: 'ratio', numerator: 'bim_support_completed', denominator: 'bim_support_requests' },
        sourceReference: 'Scorecard Div BIM!C26:I26'
    }),
    indicator({
        id: 'kpi-div-bim-2026-04', code: 'BIM-04', sortOrder: 4, parentIndicatorId: 'kpi-dept-eng-2026-04',
        perspectiveCode: 'product_process', name: 'Implementasi BIM Projects', programName: 'Program Implementasi 3D-5D BIM', relationType: 'direct',
        measurementFormula: '(Project target dengan implementasi BIM terlaksana / Total project target BIM) x 100%',
        aggregationMethod: 'ratio_of_sums', targetValue: 1, weight: 0.10,
        calculationConfig: { mode: 'ratio', numerator: 'bim_target_projects_implemented', denominator: 'bim_target_projects_total' },
        sourceReference: 'Scorecard Div BIM!C29:I29'
    }),
    indicator({
        id: 'kpi-div-bim-2026-05', code: 'BIM-05', sortOrder: 5, parentIndicatorId: 'kpi-dept-eng-2026-05',
        perspectiveCode: 'product_process', name: 'Performa Quality Survey', programName: 'Program Integrasi Survey & Model', relationType: 'contribution',
        measurementFormula: '(Data Survey tervalidasi dan terintegrasi / Total data Survey yang digunakan dalam model BIM) x 100%',
        aggregationMethod: 'ratio_of_sums', targetValue: 1, weight: 0.10,
        calculationConfig: { mode: 'ratio', numerator: 'survey_data_validated_in_bim', denominator: 'survey_data_used_in_bim' },
        sourceReference: 'Scorecard Div BIM!C31:I31'
    }),
    indicator({
        id: 'kpi-div-bim-2026-06', code: 'BIM-06', sortOrder: 6, parentIndicatorId: 'kpi-dept-eng-2026-06',
        perspectiveCode: 'product_process', name: 'Program Digitalisasi', programName: 'Program Digitalisasi BIM', relationType: 'direct',
        measurementFormula: '(Aktual milestone digitalisasi BIM / Rencana milestone digitalisasi BIM) x 100%',
        aggregationMethod: 'latest_checkpoint', targetValue: 1, weight: 0.10,
        calculationConfig: { mode: 'latest_ratio', numerator: 'bim_digitalization_actual_checkpoint', denominator: 'bim_digitalization_plan_checkpoint' },
        sourceReference: 'Scorecard Div BIM!C33:I33'
    }),
    indicator({
        id: 'kpi-div-bim-2026-07', code: 'BIM-07', sortOrder: 7, parentIndicatorId: 'kpi-dept-eng-2026-07',
        perspectiveCode: 'product_process', name: 'Implementasi PMP Engineering', programName: 'Program Support PMP via BIM', relationType: 'contribution',
        measurementFormula: '(Realisasi dukungan PMP via BIM / Rencana dukungan PMP via BIM) x 100%',
        aggregationMethod: 'ratio_of_sums', targetValue: 1, weight: 0.15,
        calculationConfig: { mode: 'ratio', numerator: 'bim_pmp_support_actual', denominator: 'bim_pmp_support_plan' },
        sourceReference: 'Scorecard Div BIM!C35:I35'
    }),
    indicator({
        id: 'kpi-div-bim-2026-08', code: 'BIM-08', sortOrder: 8, parentIndicatorId: 'kpi-dept-eng-2026-08',
        perspectiveCode: 'learning_growth', name: 'Pelatihan & Pengembangan', programName: 'Program Training BIM', relationType: 'scoped_rollup',
        measurementFormula: '(Aktual pelatihan BIM / Rencana pelatihan BIM) x 100%',
        aggregationMethod: 'ratio_of_sums', targetValue: 1, weight: 0.05,
        calculationConfig: { mode: 'ratio', numerator: 'bim_training_actual', denominator: 'bim_training_plan' },
        sourceReference: 'Scorecard Div BIM!C38:I38'
    }),
    indicator({
        id: 'kpi-div-bim-2026-09', code: 'BIM-09', sortOrder: 9, parentIndicatorId: 'kpi-dept-eng-2026-09',
        perspectiveCode: 'learning_growth', name: 'Engineering Capability Upgrade', programName: 'Program Sertifikasi & Assessment BIM', relationType: 'scoped_rollup',
        measurementFormula: '(Aktual personel BIM ter-develop / Rencana pengembangan personel BIM) x 100%',
        aggregationMethod: 'ratio_of_sums', targetValue: 1, weight: 0.05,
        calculationConfig: { mode: 'ratio', numerator: 'bim_capability_people_actual', denominator: 'bim_capability_people_plan' },
        sourceReference: 'Scorecard Div BIM!C40:I40'
    }),
    indicator({
        id: 'kpi-div-bim-2026-10', code: 'BIM-10', sortOrder: 10, parentIndicatorId: 'kpi-dept-eng-2026-10',
        perspectiveCode: 'learning_growth', name: 'Inovasi & Improvisasi', programName: 'Program Inovasi BIM', relationType: 'contribution',
        measurementFormula: 'Jumlah inovasi BIM tervalidasi secara kumulatif YTD',
        aggregationMethod: 'cumulative_count', targetValue: 3, targetUnit: 'qty', weight: 0.10,
        calculationConfig: { mode: 'cumulative_count', input: 'bim_validated_innovations' },
        sourceReference: 'Scorecard Div BIM!C42:I42'
    })
];

const programDefinitions = [
    ['01', 'project_scope', 'staff_proposable', null, 'scope'],
    ['02', 'owner_only', 'delegation_only', null, 'budget scope'],
    ['03', 'dynamic_queue', 'staff_proposable', null, 'request'],
    ['04', 'project_scope', 'staff_proposable', null, 'project'],
    ['05', 'project_scope', 'staff_proposable', null, 'project'],
    ['06', 'milestone', 'staff_proposable', null, 'milestone'],
    ['07', 'project_scope', 'staff_proposable', null, 'project'],
    ['08', 'milestone', 'staff_proposable', null, 'training'],
    ['09', 'milestone', 'staff_proposable', null, 'person'],
    ['10', 'quantity', 'staff_proposable', 3, 'innovation']
];

const programs = programDefinitions.map(([suffix, allocationMode, claimPolicy, targetValue, targetUnit], index) => ({
    id: `program-bim-${KPI_YEAR}-${suffix}`,
    periodYear: KPI_YEAR,
    divisionIndicatorId: divisionIndicators[index].id,
    code: `PRG-BIM-${suffix}`,
    sortOrder: index + 1,
    name: divisionIndicators[index].programName,
    allocationMode,
    claimPolicy,
    availabilityStatus: claimPolicy === 'staff_proposable' ? 'open' : 'closed',
    targetValue,
    targetUnit
}));

const scorecards = [
    {
        id: 'scorecard-dept-eng-2026', periodYear: KPI_YEAR, level: 'department', orgUnit: 'Engineering',
        title: 'KPI Departemen Engineering', status: 'reference', maxAchievement: MAX_ACHIEVEMENT,
        sourceReference: 'Scorecard & KPI (Departemen - Individu).xlsx / Scorecard Dept Eng',
        indicators: departmentIndicators
    },
    {
        id: 'scorecard-div-bim-2026', periodYear: KPI_YEAR, level: 'division', orgUnit: 'BIM',
        title: 'KPI Divisi BIM', status: 'reference', maxAchievement: MAX_ACHIEVEMENT,
        sourceReference: 'Scorecard & KPI (Departemen - Individu).xlsx / Scorecard Div BIM',
        indicators: divisionIndicators
    }
];

function calculateAchievement(measurement, target) {
    if (measurement === null || measurement === undefined || measurement === '') return null;
    const measured = Number(measurement);
    const targetValue = Number(target);
    if (!Number.isFinite(measured) || !Number.isFinite(targetValue) || targetValue <= 0) return null;
    return Math.min(MAX_ACHIEVEMENT, Math.max(0, measured / targetValue));
}

function validateCatalog() {
    const departmentIds = new Set(departmentIndicators.map((item) => item.id));
    for (const card of scorecards) {
        if (card.indicators.length !== 10) throw new Error(`${card.id} must contain 10 indicators`);
        const weight = card.indicators.reduce((sum, item) => sum + item.weight, 0);
        if (Math.abs(weight - 1) > 1e-9) throw new Error(`${card.id} weights must total 100%`);
        if (new Set(card.indicators.map((item) => item.code)).size !== card.indicators.length) {
            throw new Error(`${card.id} contains duplicate indicator codes`);
        }
    }
    for (const item of divisionIndicators) {
        if (!departmentIds.has(item.parentIndicatorId)) throw new Error(`${item.id} has an invalid department parent`);
    }
    if (programs.length !== divisionIndicators.length) throw new Error('Each division KPI must have one program');
    if (new Set(programs.map((item) => item.divisionIndicatorId)).size !== divisionIndicators.length) {
        throw new Error('Division KPI programs must be unique');
    }
    if (calculateAchievement(1.5, 1) !== MAX_ACHIEVEMENT) throw new Error('Achievement cap validation failed');
    if (calculateAchievement(null, 1) !== null) throw new Error('Empty measurement validation failed');
}

validateCatalog();

module.exports = {
    KPI_YEAR,
    MAX_ACHIEVEMENT,
    calculateAchievement,
    scorecards,
    programs
};
