const path = require('node:path');
const { createCanonicalLearningContentResolver } = require('../services/canonicalLearningContentResolver');
const { createInternshipRepository } = require('../repositories/internshipRepository');
const { createInternshipProgramService } = require('../services/internshipProgramService');
const { createInternshipReviewService } = require('../services/internshipReviewService');
const { createInternshipProgramProgressService } = require('../services/internshipProgramProgressService');
const {
    createInternshipEvidenceService,
    createLocalEvidenceStorage
} = require('../services/internshipEvidenceService');
const { createInternshipRoutes } = require('../routes/internshipRoutes');

function registerInternshipFeature({
    app,
    enabled,
    assignmentsEnabled = false,
    submissionsEnabled = false,
    reviewEnabled = false,
    completionEnabled = false,
    pgPool,
    catalogService,
    evidenceStorage = null
}) {
    if (!enabled) return { enabled: false, mounted: false };
    if (!app || typeof app.use !== 'function') throw new Error('Express app is required');
    if (!catalogService) throw new Error('Unified learning catalog service is required for Internship');

    const submissionFeatureEnabled = assignmentsEnabled === true && submissionsEnabled === true;
    const reviewFeatureEnabled = submissionFeatureEnabled && reviewEnabled === true;
    const completionFeatureEnabled = reviewFeatureEnabled && completionEnabled === true;
    const contentResolver = createCanonicalLearningContentResolver({ catalogService });
    const repository = createInternshipRepository({
        pgPool,
        revisionsEnabled: reviewFeatureEnabled,
        completionEnabled: completionFeatureEnabled
    });
    const evidenceService = submissionFeatureEnabled
        ? createInternshipEvidenceService({
            storage: evidenceStorage || createLocalEvidenceStorage({
                rootDirectory: path.join(__dirname, '..', 'private', 'internship-evidence')
            })
        })
        : null;
    const internshipService = createInternshipProgramService({ repository, contentResolver, evidenceService });
    const reviewService = reviewFeatureEnabled
        ? createInternshipReviewService({ repository, evidenceService })
        : null;
    const progressService = completionFeatureEnabled
        ? createInternshipProgramProgressService({ repository })
        : null;
    app.use('/api/training/internships', createInternshipRoutes({
        internshipService,
        assignmentsEnabled,
        submissionsEnabled: submissionFeatureEnabled,
        reviewEnabled: reviewFeatureEnabled,
        reviewService,
        completionEnabled: completionFeatureEnabled,
        progressService
    }));
    return {
        enabled: true,
        assignmentsEnabled: assignmentsEnabled === true,
        submissionsEnabled: submissionFeatureEnabled,
        reviewEnabled: reviewFeatureEnabled,
        completionEnabled: completionFeatureEnabled,
        mounted: true,
        internshipService,
        reviewService,
        progressService
    };
}

module.exports = { registerInternshipFeature };
