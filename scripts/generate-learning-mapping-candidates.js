const fs = require('fs');
const path = require('path');
const tutorialRoutes = require('../backend/routes/tutorialRoutes');
const { loadLearningMaterialsData } = require('../backend/services/learningMaterialsSource');
const { readLearningPaths } = require('../backend/elearning/services/learningPathService');
const createUnifiedLearningCatalogService = require('../backend/services/unifiedLearningCatalogService');

const outputPath = path.join(__dirname, '../backend/elearning/learning-mapping-candidates.json');

const NEEDS_REVIEW = new Set([
    'video:7__audio_visual_learning_1__aerial_survey_1__drone_pelatihan_midas_gen_dasar_mp4',
    'video:7__audio_visual_learning_3__cde_2__share_point_2025_12_24_13_36_57_meeting_monitoring_bim_ft_unp_project_20260708t062649z_3_001_2025_12_24_13_36_57_meeting_monitoring_bim_ft_unp_project_video1632687988_mp4',
    'video:7__audio_visual_learning_5__software_4__civil_3d_1__csi_1__video_training_1_1__hari_3_gmt20200916_031353_training_c_1920x1080_mp4',
    'video:7__audio_visual_learning_5__software_4__civil_3d_1__csi_1__video_training_1_2__hari_4_gmt20200917_023005_training_c_1920x1080_mp4',
    'video:7__audio_visual_learning_5__software_5__infraworks_1__video_training_1_1__hari_1_gmt20200924_020204_training_i_1920x1080_mp4',
    'video:7__audio_visual_learning_5__software_5__infraworks_1__video_training_1_2__hari_2_gmt20200925_020417_training_i_1920x1080_mp4',
    'video:7__audio_visual_learning_5__software_7__revit_1__konstruksi_gedung_3__arsitektural_1__video_training_1__hari_1_day_1_part_1_mp4',
    'video:7__audio_visual_learning_5__software_9__twinmotion_2__video_rekaman_kelas_flashclass_day_1_mp4',
    'video:7__audio_visual_learning_5__software_9__twinmotion_2__video_rekaman_kelas_flashclass_day_2_mp4',
    'video:7__audio_visual_learning_6__video_archi_tutor_ai_house_whatsapp_video_2021_09_28_at_10_15_40_mp4',
    'video:bim_implementation_documents_monitoring_koordinasi_rutin_2024_09_20_16_17_38_koordinasi_implementasi_bim_project_rsau___pps_unp_video1595004912_mp4',
    'video:vidio_konten_youtube_data_center__tutorial__mp4',
    'video:vidio_konten_youtube_hasil_editan_utk_yt_new_folder_0718_mp4',
    'video:vidio_konten_youtube_hasil_editan_utk_yt_new_folder_0725_1__mp4',
    'video:vidio_konten_youtube_hasil_editan_utk_yt_new_folder_0725_mp4',
    'video:vidio_konten_youtube_hasil_editan_utk_yt_new_folder_0902_mp4',
    'video:vidio_konten_youtube_vidio_backgroud_hutan_2655829_hd_1920_1080_24fps_mp4',
    'video:vidio_konten_youtube_vidio_backgroud_hutan_3696058_hd_1920_1080_24fps_mp4',
    'video:vidio_konten_youtube_vidio_backgroud_kota_12173531_2160_3840_30fps_mp4',
    'video:vidio_konten_youtube_vidio_backgroud_kota_13625904_3840_2160_30fps_mp4',
    'video:vidio_konten_youtube_mentahan_vidio_proyek_perpustakaan_unp__work_stage__udah_upload_mp4'
]);

function normalized(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function target(pathId, moduleKey, requirementType = 'elective') {
    return { pathId, moduleKey, requirementType };
}

function navisworksLesson(text) {
    const match = text.match(/lesson[^0-9]*0*(\d{1,2})(?!\d)/i);
    return match ? Number(match[1]) : null;
}

function civilTutorial(text) {
    const match = text.match(/-\s*tutorial\s*0*(\d{1,2})\b/i);
    return match ? Number(match[1]) : null;
}

function classify(item) {
    const haystack = normalized(`${item.title} ${item.contentId} ${item.category}`);

    if (NEEDS_REVIEW.has(item.contentId)) {
        return { decision: 'needs_review', mappingStatus: 'needs_review', reason: 'SME: judul minim informasi, salah kategori, atau versi belum terverifikasi', targets: [] };
    }

    if (item.sourceType === 'page') {
        const pathId = item.metadata.legacyPathId;
        const moduleKey = item.metadata.legacyModuleId;
        return { decision: 'required', mappingStatus: 'candidate', reason: 'Reference halaman resmi pada path legacy', targets: [target(pathId, moduleKey, 'required')] };
    }

    if (/complete pelatihan autocad.*day\s*[12]/i.test(item.title)) {
        return { decision: 'alternate', mappingStatus: 'candidate', reason: 'SME: kandidat rekaman lengkap pengganti seri AutoCAD; coverage perlu ditonton', targets: [target('autocad-certified-user', 'autocad-basics-course')] };
    }
    if (/cara_membuat_file_central/i.test(item.contentId)) {
        return { decision: 'alternate', mappingStatus: 'candidate', reason: 'SME: exact-size duplicate candidate Revit central file', targets: [target('revit-architecture-professional', 'revit-quality-collaboration')] };
    }
    if (/azure.*(?:timeliner|time liner)/i.test(item.title) && /udah_upload/i.test(item.contentId)) {
        return { decision: 'alternate', mappingStatus: 'candidate', reason: 'SME: exact-size Azure Timeliner copy candidate', targets: [target('bim-delivery-workflow-foundation', 'delivery-case-study')] };
    }

    if (item.sourceType === 'pdf') {
        if (item.category === 'bim-modeller') {
            const topic = normalized(item.metadata.moduleTopic);
            let moduleKey = 'modeller-foundations';
            if (/quantity/.test(topic)) moduleKey = 'modeller-qto';
            else if (/kolaboratif/.test(topic)) moduleKey = 'modeller-collaboration';
            else if (/penyesuaian/.test(topic)) moduleKey = 'modeller-data-engineering';
            else if (/solusi/.test(topic)) moduleKey = 'modeller-problem-solving';
            else if (/mekanikal|elektrikal|plumbing|mep|hvac|fire/.test(haystack)) moduleKey = 'modeller-mep-production';
            else if (/pemodelan|produksi/.test(topic)) moduleKey = 'modeller-model-production';
            return { decision: 'required', mappingStatus: 'candidate', reason: 'SME: manual book BIM Modeller', targets: [target('bim-modeller-core', moduleKey, 'required')] };
        }
        if (item.category === 'bim-manager') {
            const moduleKey = /modul\s*0?[12]\b/i.test(item.title) ? 'manager-strategy' : 'manager-leadership';
            return { decision: 'required', mappingStatus: 'candidate', reason: 'SME: manual book BIM Manager', targets: [target('bim-manager-certification', moduleKey, 'required')] };
        }
        return { decision: 'elective', mappingStatus: 'candidate', reason: 'SME: PDF pendukung, belum menjadi prerequisite', targets: [target('bim-governance-foundation', 'governance-reference-library')] };
    }

    if (/pengenalan (?:bim|building information modeling)/.test(haystack)) {
        return { decision: 'required', mappingStatus: 'candidate', reason: 'SME: pengantar BIM', targets: [target('bim-mindset-foundation', 'bim-mindset-information-management', 'required')] };
    }

    const autocadPart = item.title.match(/pelatihan autocad\s*[_-]?\s*part\s*(\d{1,2})/i);
    if (autocadPart && Number(autocadPart[1]) <= 15) {
        const part = Number(autocadPart[1]);
        const moduleKey = part <= 5 ? 'autocad-foundations' : part <= 11 ? 'autocad-drafting-annotation' : 'autocad-output-certification';
        return { decision: 'required', mappingStatus: 'candidate', reason: `SME: seri AutoCAD Part ${part}`, targets: [target('autocad-certified-user', moduleKey, 'required')] };
    }

    if (/revit untuk pemula|revit architecture.*(?:16|17).*sept.*2020/i.test(item.title) || /create_central_file/i.test(item.contentId)) {
        return { decision: 'required', mappingStatus: 'candidate', reason: 'SME: core Revit course', targets: [target('revit-architecture-professional', 'revit-core-production', 'required')] };
    }

    if (/bim 360 docs.*(?:pt|part)[ .-]*0*(?:[1-9]|10)\b/i.test(item.title)) {
        return { decision: 'required', mappingStatus: 'candidate', reason: 'SME: BIM 360 Docs core series', targets: [target('bim-governance-foundation', 'governance-cde', 'required')] };
    }

    const lesson = item.category === 'navisworks' ? navisworksLesson(item.title) : null;
    if (lesson && ((lesson >= 1 && lesson <= 4) || (lesson >= 6 && lesson <= 8))) {
        return { decision: 'required', mappingStatus: 'candidate', reason: `SME: Navisworks core lesson ${lesson}`, targets: [target('bim-governance-foundation', 'governance-federation', 'required')] };
    }
    if (lesson && lesson >= 25 && lesson <= 30) {
        return { decision: 'required', mappingStatus: 'candidate', reason: `SME: Navisworks clash lesson ${lesson}`, targets: [target('bim-governance-foundation', 'governance-clash', 'required')] };
    }
    if (lesson && lesson >= 31 && lesson <= 35) {
        return { decision: 'required', mappingStatus: 'candidate', reason: `SME: Navisworks 4D/5D lesson ${lesson}`, targets: [target('bim-delivery-workflow-foundation', lesson === 35 ? 'delivery-qto' : 'delivery-4d', 'required')] };
    }

    const civilPart = item.category === 'civil-3d' ? civilTutorial(item.title) : null;
    if (civilPart && civilPart <= 20) {
        const moduleKey = civilPart <= 7 ? 'civil-data-surface' : civilPart <= 13 ? 'civil-alignment-profile' : civilPart <= 15 ? 'civil-corridor' : 'civil-quantity';
        return { decision: 'required', mappingStatus: 'candidate', reason: `SME: Civil 3D concise tutorial ${civilPart}`, targets: [target('civil-infrastructure-modelling', moduleKey, 'required')] };
    }

    const infraPart = item.title.match(/part\s*0*([1-8])\b.*basic autodesk infraworks/i);
    if (infraPart) {
        return { decision: 'required', mappingStatus: 'candidate', reason: `SME: InfraWorks Part ${infraPart[1]}`, targets: [target('civil-infrastructure-modelling', 'civil-infraworks', 'required')] };
    }

    if (/plannerly/i.test(item.title) && /^(?:plan|scope|schedule|track|verify)\b|^the complete bim management workflow/i.test(item.title)) {
        return { decision: 'required', mappingStatus: 'candidate', reason: 'SME: Plannerly management workflow', targets: [target('bim-manager-certification', 'manager-workflow', 'required')] };
    }

    if (/download.*(?:navisworks|software)|one minute|1 minute|trailer|training summary|promo|promosi|traffic management|tender/i.test(item.title)
        || ['projects', 'tender', 'traffic-management'].includes(item.category)) {
        return { decision: 'library_only', mappingStatus: 'candidate', reason: 'SME: referensi/showcase, bukan prerequisite jalur', targets: [] };
    }

    const electivePathByCategory = {
        autocad: ['autocad-certified-user', 'autocad-electives'],
        revit: ['revit-architecture-professional', 'revit-electives'],
        navisworks: ['bim-governance-foundation', 'governance-reference-library'],
        'civil-3d': ['civil-infrastructure-modelling', 'civil-advanced-topics'],
        infraworks: ['civil-infrastructure-modelling', 'civil-infraworks'],
        plannerly: ['bim-manager-certification', 'manager-workflow'],
        'trimble-connect': ['bim-governance-foundation', 'governance-cde'],
        fulcrum: ['bim-governance-foundation', 'governance-field-information'],
        'open-bim': ['bim-delivery-workflow-foundation', 'delivery-open-bim'],
        archicad: ['bim-modeller-core', 'modeller-model-production'],
        'strubim-cype': ['bim-modeller-core', 'modeller-model-production']
    };
    const fallback = electivePathByCategory[item.category] || ['bim-modeller-core', 'modeller-electives'];
    return { decision: 'elective', mappingStatus: 'candidate', reason: 'SME: materi relevan sebagai pendukung/elective', targets: [target(fallback[0], fallback[1])] };
}

function equivalenceKey(item) {
    const text = normalized(`${item.title} ${item.contentId}`);
    if (/central file|create central|cara membuat file central/.test(text)) return 'revit-central-file';
    if (/office interior.*global dinamika|global dinamika.*office interior/.test(text)) return 'office-interior-global-dinamika';
    if (/proyek fakultas teknik unp/.test(text)) return 'proyek-fakultas-teknik-unp';
    if (/azure.*(?:apartment|aparment).*timeliner/.test(text)) return 'azure-apartment-timeliner';
    if (/proyek perpustakaan unp/.test(text)) return 'proyek-perpustakaan-unp';
    if (/kolaborasi dan pengelolaan data dalam cde/.test(text)) return 'pdf-cde-collaboration';
    if (/memproduksi data model bim/.test(text)) return 'pdf-model-production';
    return normalized(item.title).replace(/\b(?:copy|salinan|udah upload)\b/g, '').trim();
}

function buildEquivalenceCandidates(items) {
    const groups = new Map();
    for (const item of items) {
        const key = equivalenceKey(item);
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
    }

    return [...groups.entries()]
        .filter(([, members]) => members.length > 1)
        .map(([key, members], index) => ({
            groupKey: `candidate-${index + 1}-${key.slice(0, 55).replace(/\s+/g, '-')}`,
            title: members[0].title,
            status: 'candidate',
            completionPolicy: null,
            evidence: 'Normalized-title collision only; checksum/visual review required',
            members: members.map((item) => ({ contentId: item.contentId, size: item.metadata.size || null }))
        }));
}

async function main() {
    const service = createUnifiedLearningCatalogService({
        loadVideos: tutorialRoutes.loadTutorialCatalog,
        loadMaterials: loadLearningMaterialsData,
        readLearningPaths
    });
    const items = await service.loadCatalog();
    const decisions = items.map((item) => ({
        contentId: item.contentId,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        title: item.title,
        category: item.category,
        ...classify(item),
        reviewedBy: null,
        reviewedAt: null,
        publishable: false
    }));
    const sequenceByModule = new Map();
    for (const decision of decisions) {
        decision.targets = decision.targets.map((mappingTarget) => {
            const key = `${mappingTarget.pathId}:${mappingTarget.moduleKey}`;
            const sequence = (sequenceByModule.get(key) || 0) + 1;
            sequenceByModule.set(key, sequence);
            return { ...mappingTarget, proposedSequence: sequence };
        });
    }
    const decisionCounts = decisions.reduce((counts, item) => {
        counts[item.decision] = (counts[item.decision] || 0) + 1;
        return counts;
    }, {});
    const payload = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        status: 'SME_CANDIDATE_REVIEW',
        autoPublished: false,
        inventory: {
            total: items.length,
            byType: items.reduce((counts, item) => {
                counts[item.sourceType] = (counts[item.sourceType] || 0) + 1;
                return counts;
            }, {}),
            decisionCounts
        },
        reviewPolicy: {
            note: 'Seluruh keputusan masih kandidat. approved/reviewedBy/reviewedAt wajib sebelum publish.',
            needsReviewBlocksRequiredPublish: true,
            equivalenceRequiresChecksumOrVisualReview: true
        },
        equivalenceCandidates: buildEquivalenceCandidates(items),
        decisions
    };

    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ outputPath, ...payload.inventory, equivalenceCandidates: payload.equivalenceCandidates.length }, null, 2));
}

main().then(() => process.exit(0)).catch((error) => {
    console.error(error);
    process.exit(1);
});
