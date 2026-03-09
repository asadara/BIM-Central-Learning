// Enhanced Exam Question Database - Phase 2 Content
// Formal examination questions with proper categorization and validation

const enhancedExamDatabase = {
    "BIM Modeller": {
        certificationExams: [
            {
                examId: "bim-mod-cert-001",
                title: "BIM Modeller Certification Exam",
                description: "Comprehensive assessment of BIM modeling fundamentals and practical skills",
                duration: 120, // minutes
                totalQuestions: 80,
                passingScore: 80,
                questionTypes: {
                    "multiple-choice": 60,
                    "true-false": 10,
                    "practical-scenario": 10
                },
                categories: {
                    "bim-fundamentals": {
                        weight: 25, // percentage of exam
                        questions: 20,
                        topics: [
                            "BIM Definitions and Concepts",
                            "Industry Standards (ISO 19650)",
                            "BIM Levels and Maturity",
                            "Information Management",
                            "Collaboration Principles"
                        ]
                    },
                    "3d-modeling": {
                        weight: 35,
                        questions: 28,
                        topics: [
                            "Revit Architecture Modeling",
                            "Revit Structure Basics",
                            "Revit MEP Introduction",
                            "Family Creation",
                            "Parametric Design"
                        ]
                    },
                    "quality-control": {
                        weight: 20,
                        questions: 16,
                        topics: [
                            "Model Validation",
                            "Error Detection and Correction",
                            "Standards Compliance",
                            "File Management",
                            "Version Control"
                        ]
                    },
                    "file-formats": {
                        weight: 10,
                        questions: 8,
                        topics: [
                            "IFC Format Understanding",
                            "Data Exchange",
                            "Import/Export Procedures",
                            "Interoperability"
                        ]
                    },
                    "collaboration": {
                        weight: 10,
                        questions: 8,
                        topics: [
                            "Central File Management",
                            "Workset Organization",
                            "Synchronization Process",
                            "Communication Protocols"
                        ]
                    }
                },
                sampleQuestions: [
                    {
                        id: "bim-mod-exam-001",
                        category: "bim-fundamentals",
                        type: "multiple-choice",
                        difficulty: "intermediate",
                        question: "According to ISO 19650, what is the primary purpose of the Master Information Delivery Plan (MIDP)?",
                        options: [
                            "To schedule software training sessions",
                            "To define when information will be delivered and by whom throughout the project",
                            "To establish file naming conventions",
                            "To set up hardware requirements"
                        ],
                        correctAnswer: 1,
                        explanation: "The MIDP establishes the project's overall information delivery strategy, defining what information is needed, when it should be delivered, and who is responsible for its creation and delivery.",
                        bloomsTaxonomy: "Understanding",
                        timeAllocation: 90, // seconds
                        references: ["ISO 19650-2:2018", "PAS 1192-2:2013"]
                    },
                    {
                        id: "bim-mod-exam-002",
                        category: "3d-modeling",
                        type: "practical-scenario",
                        difficulty: "advanced",
                        question: "You are creating a custom door family in Revit. The door needs to have variable width (800mm, 900mm, 1000mm) and the frame should automatically adjust. Describe the steps and parameters needed.",
                        rubric: {
                            "Template Selection": "Chooses appropriate door family template",
                            "Reference Planes": "Creates reference planes for width control",
                            "Parameters": "Defines width parameter with correct constraints",
                            "Geometry Creation": "Builds door and frame geometry properly constrained",
                            "Testing": "Demonstrates testing of parameter changes"
                        },
                        bloomsTaxonomy: "Application",
                        timeAllocation: 600, // seconds
                        practicalComponent: true,
                        modelingTask: "Create parametric door family with specifications"
                    },
                    {
                        id: "bim-mod-exam-003",
                        category: "quality-control",
                        type: "multiple-choice",
                        difficulty: "intermediate",
                        question: "Which of the following is NOT a recommended practice for maintaining model quality?",
                        options: [
                            "Regular model auditing using built-in tools",
                            "Consistent use of naming conventions",
                            "Creating detailed geometry for all elements regardless of view scale",
                            "Periodic cleanup of unused families and types"
                        ],
                        correctAnswer: 2,
                        explanation: "Creating detailed geometry for all elements regardless of view scale can lead to unnecessary file size increases and performance issues. Level of Detail should match the intended use and view scale.",
                        bloomsTaxonomy: "Analysis",
                        timeAllocation: 75,
                        keyLearning: "Understanding Level of Detail principles"
                    }
                ],
                prerequisites: [
                    "Complete all BIM Modeller learning path courses",
                    "Pass phase assessments with 75% minimum",
                    "Submit practice portfolio with 3 projects"
                ],
                validation: {
                    "contentValidity": "Questions reviewed by industry experts",
                    "constructValidity": "Aligned with job analysis and competency framework",
                    "criterionValidity": "Correlated with on-job performance measures"
                },
                accommodations: {
                    "timeExtension": "25% additional time for documented learning differences",
                    "languageSupport": "Glossary available for non-native speakers",
                    "assistiveTechnology": "Screen reader compatible"
                }
            }
        ],
        phaseAssessments: [
            {
                phaseId: "phase-1-fundamentals",
                title: "BIM Fundamentals Assessment",
                duration: 45,
                questions: 30,
                passingScore: 75,
                retakePolicy: "Unlimited retakes with 24-hour waiting period"
            },
            {
                phaseId: "phase-2-modeling",
                title: "3D Modeling Skills Assessment",
                duration: 60,
                questions: 25,
                practicalComponent: true,
                passingScore: 75,
                retakePolicy: "Unlimited retakes with 24-hour waiting period"
            }
        ]
    },

    "BIM Coordinator": {
        certificationExams: [
            {
                examId: "bim-coord-cert-001",
                title: "BIM Coordinator Certification Exam",
                description: "Advanced assessment of coordination, leadership, and project management skills",
                duration: 180,
                totalQuestions: 100,
                passingScore: 85,
                questionTypes: {
                    "multiple-choice": 60,
                    "case-study": 15,
                    "practical-scenario": 15,
                    "essay": 10
                },
                categories: {
                    "coordination-management": {
                        weight: 30,
                        questions: 30,
                        topics: [
                            "BIM Execution Plan Development",
                            "Stakeholder Management",
                            "Coordination Process Design",
                            "Issue Resolution",
                            "Progress Tracking"
                        ]
                    },
                    "clash-detection": {
                        weight: 25,
                        questions: 25,
                        topics: [
                            "Advanced Clash Detection",
                            "Clash Resolution Strategies",
                            "Navisworks Workflows",
                            "Coordination Models",
                            "Quality Assurance"
                        ]
                    },
                    "team-leadership": {
                        weight: 20,
                        questions: 20,
                        topics: [
                            "Team Leadership Principles",
                            "Conflict Resolution",
                            "Communication Strategies",
                            "Performance Management",
                            "Training and Development"
                        ]
                    },
                    "technology-management": {
                        weight: 15,
                        questions: 15,
                        topics: [
                            "CDE Management",
                            "Technology Integration",
                            "Automation and Scripting",
                            "Data Management",
                            "Security and Compliance"
                        ]
                    },
                    "project-delivery": {
                        weight: 10,
                        questions: 10,
                        topics: [
                            "Integrated Project Delivery",
                            "Lean Construction",
                            "Risk Management",
                            "Performance Measurement",
                            "Continuous Improvement"
                        ]
                    }
                },
                sampleQuestions: [
                    {
                        id: "bim-coord-exam-001",
                        category: "coordination-management",
                        type: "case-study",
                        difficulty: "advanced",
                        scenario: "You are coordinating a 30-story mixed-use building project with architectural, structural, MEP, and facade consultants. The project is 3 months behind schedule, and there are ongoing coordination issues between MEP and structural systems.",
                        question: "Develop a coordination recovery plan addressing the schedule delays and technical conflicts.",
                        rubric: {
                            "Problem Analysis": "Identifies root causes of delays and conflicts",
                            "Stakeholder Strategy": "Proposes effective stakeholder engagement approach",
                            "Technical Solutions": "Addresses coordination issues with practical solutions",
                            "Schedule Recovery": "Develops realistic schedule recovery plan",
                            "Risk Mitigation": "Identifies and mitigates project risks"
                        },
                        bloomsTaxonomy: "Synthesis",
                        timeAllocation: 900,
                        realWorldApplication: "Large-scale project coordination challenges"
                    },
                    {
                        id: "bim-coord-exam-002",
                        category: "clash-detection",
                        type: "practical-scenario",
                        difficulty: "expert",
                        question: "In Navisworks, you discover 247 clashes in a coordination model. Describe your systematic approach to prioritize, categorize, and resolve these clashes efficiently.",
                        assessmentCriteria: [
                            "Demonstrates understanding of clash prioritization strategies",
                            "Shows knowledge of clash categorization methods",
                            "Proposes efficient resolution workflows",
                            "Considers project timeline and resource constraints",
                            "Includes quality control measures"
                        ],
                        bloomsTaxonomy: "Evaluation",
                        timeAllocation: 720,
                        toolsRequired: ["Navisworks Manage", "Clash Detection Rules"]
                    }
                ],
                prerequisites: [
                    "BIM Modeller Certification",
                    "Complete all BIM Coordinator learning path courses",
                    "Pass all phase assessments with 80% minimum",
                    "Complete practical coordination project",
                    "Demonstrate 6+ months modeling experience"
                ],
                validation: {
                    "industryReview": "Questions validated by practicing BIM coordinators",
                    "competencyAlignment": "Mapped to industry competency standards",
                    "performancePredictive": "Correlated with job performance metrics"
                }
            }
        ]
    },

    "BIM Manager": {
        certificationExams: [
            {
                examId: "bim-mgr-cert-001",
                title: "BIM Manager Certification Exam",
                description: "Executive-level assessment of strategic leadership, organizational development, and industry expertise",
                duration: 240,
                totalQuestions: 120,
                passingScore: 90,
                questionTypes: {
                    "multiple-choice": 40,
                    "case-study": 30,
                    "strategic-planning": 25,
                    "industry-analysis": 15,
                    "presentation": 10
                },
                categories: {
                    "strategic-leadership": {
                        weight: 35,
                        questions: 42,
                        topics: [
                            "Organizational Strategy Development",
                            "Change Management Leadership",
                            "Executive Communication",
                            "Innovation Management",
                            "Industry Thought Leadership"
                        ]
                    },
                    "enterprise-implementation": {
                        weight: 30,
                        questions: 36,
                        topics: [
                            "Enterprise Standards Development",
                            "Technology Infrastructure",
                            "Performance Measurement",
                            "Compliance Management",
                            "Scalability Planning"
                        ]
                    },
                    "business-development": {
                        weight: 20,
                        questions: 24,
                        topics: [
                            "ROI Analysis and Communication",
                            "Business Case Development",
                            "Market Analysis",
                            "Competitive Positioning",
                            "Client Relationship Management"
                        ]
                    },
                    "technology-leadership": {
                        weight: 10,
                        questions: 12,
                        topics: [
                            "Emerging Technology Evaluation",
                            "Digital Transformation",
                            "Cybersecurity Strategy",
                            "Data Analytics",
                            "Future Technology Planning"
                        ]
                    },
                    "industry-contribution": {
                        weight: 5,
                        questions: 6,
                        topics: [
                            "Standards Development Participation",
                            "Research and Publication",
                            "Professional Networking",
                            "Mentorship and Development",
                            "Industry Advocacy"
                        ]
                    }
                },
                sampleQuestions: [
                    {
                        id: "bim-mgr-exam-001",
                        category: "strategic-leadership",
                        type: "strategic-planning",
                        difficulty: "expert",
                        scenario: "A 500-person AEC firm wants to implement BIM organization-wide. They currently have minimal BIM experience, mixed technology platforms, and resistance from senior partners.",
                        question: "Develop a comprehensive 3-year BIM implementation strategy including change management, technology roadmap, training program, and success metrics.",
                        deliverables: [
                            "Executive summary presentation (10 slides)",
                            "Detailed implementation plan",
                            "Change management strategy",
                            "ROI analysis and business case",
                            "Risk assessment and mitigation plan"
                        ],
                        assessmentCriteria: {
                            "Strategic Vision": "Articulates clear, achievable strategic vision",
                            "Change Management": "Demonstrates sophisticated change management approach",
                            "Financial Analysis": "Provides compelling ROI analysis",
                            "Risk Management": "Identifies and addresses key risks",
                            "Implementation Planning": "Shows practical, phased implementation approach"
                        },
                        bloomsTaxonomy: "Creation",
                        timeAllocation: 1800,
                        realWorldComplexity: "Enterprise-scale transformation project"
                    }
                ],
                prerequisites: [
                    "BIM Coordinator Certification",
                    "Complete all BIM Manager learning path courses",
                    "Pass all phase assessments with 85% minimum",
                    "Complete strategic project with excellent rating",
                    "Demonstrate industry contribution",
                    "12+ months management experience"
                ],
                validation: {
                    "executiveReview": "Questions validated by C-level executives",
                    "industryStandards": "Aligned with global industry leadership competencies",
                    "futureReadiness": "Incorporates emerging industry trends and challenges"
                }
            }
        ]
    }
};

// Exam analytics and adaptive testing
const examAnalytics = {
    questionStatistics: {
        calculateDifficulty: function (responses) {
            // P-value: percentage of test-takers who answered correctly
            const correctResponses = responses.filter(r => r.correct).length;
            return correctResponses / responses.length;
        },

        calculateDiscrimination: function (responses, overallScores) {
            // Point-biserial correlation between item scores and total scores
            // Higher values indicate better discrimination
            const itemScores = responses.map(r => r.correct ? 1 : 0);
            return this.correlation(itemScores, overallScores);
        },

        identifyDistractionEffectiveness: function (responses) {
            // Analysis of incorrect answer choices to ensure they're plausible
            const distractorAnalysis = {};
            responses.forEach(response => {
                if (!response.correct) {
                    distractorAnalysis[response.selectedOption] =
                        (distractorAnalysis[response.selectedOption] || 0) + 1;
                }
            });
            return distractorAnalysis;
        }
    },

    adaptiveTesting: {
        selectNextQuestion: function (userAbility, questionBank) {
            // Item Response Theory-based question selection
            // Select question that provides maximum information at user's ability level
            return questionBank.find(q =>
                Math.abs(q.difficulty - userAbility) < 0.5
            );
        },

        updateAbilityEstimate: function (responses) {
            // Maximum likelihood estimation of user ability
            // Updates after each response for adaptive testing
            let ability = 0;
            responses.forEach(response => {
                if (response.correct) {
                    ability += (1 - this.probabilityCorrect(ability, response.difficulty));
                } else {
                    ability -= this.probabilityCorrect(ability, response.difficulty);
                }
            });
            return ability;
        },

        probabilityCorrect: function (ability, difficulty) {
            // 2-parameter logistic model for IRT
            const discrimination = 1.7; // Typical value
            return 1 / (1 + Math.exp(-discrimination * (ability - difficulty)));
        }
    },

    certificationValidation: {
        ensureContentValidity: function (examQuestions, jobAnalysis) {
            // Ensure exam content matches actual job requirements
            return examQuestions.every(q =>
                jobAnalysis.competencies.includes(q.competency)
            );
        },

        maintainReliability: function (examResponses) {
            // Cronbach's alpha for internal consistency
            // Should be > 0.8 for high-stakes certification
            return this.cronbachsAlpha(examResponses);
        },

        validateCriterionValidity: function (examScores, jobPerformance) {
            // Correlation between exam scores and actual job performance
            // Should be > 0.3 for meaningful prediction
            return this.correlation(examScores, jobPerformance);
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { enhancedExamDatabase, examAnalytics };
} else {
    window.enhancedExamDatabase = enhancedExamDatabase;
    window.examAnalytics = examAnalytics;
}