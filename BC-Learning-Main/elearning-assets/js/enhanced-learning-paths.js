// Enhanced Learning Paths - Phase 2 Content
// Level-aware content delivery system

const enhancedLearningPaths = {
    "BIM Modeller": {
        title: "BIM Modeller Learning Path",
        description: "Foundation skills for 3D modeling and BIM fundamentals",
        color: "#4CAF50",
        icon: "fas fa-cube",
        totalHours: 120,
        prerequisites: [],
        learningOutcome: "Master 3D modeling, understand BIM principles, and create accurate building models",

        phases: [
            {
                phase: 1,
                title: "BIM Fundamentals",
                duration: "30 hours",
                courses: [
                    {
                        id: "bim-intro-001",
                        title: "Introduction to BIM",
                        description: "Understanding Building Information Modeling concepts and workflow",
                        duration: "8 hours",
                        modules: [
                            "What is BIM?",
                            "BIM vs CAD Differences",
                            "BIM Levels (0-6)",
                            "Industry Standards (ISO 19650)",
                            "BIM Maturity Levels",
                            "Project Lifecycle with BIM"
                        ],
                        skills: ["BIM Fundamentals", "Industry Knowledge", "Project Understanding"],
                        difficulty: "Beginner",
                        certification: "BIM Foundation Certificate"
                    },
                    {
                        id: "cad-basics-002",
                        title: "CAD Fundamentals",
                        description: "Basic 2D drafting and technical drawing principles",
                        duration: "12 hours",
                        modules: [
                            "Technical Drawing Standards",
                            "2D Drafting Principles",
                            "Layers and Line Types",
                            "Dimensioning Standards",
                            "Plotting and Layout",
                            "File Management"
                        ],
                        skills: ["Technical Drawing", "CAD Operations", "Standards Compliance"],
                        difficulty: "Beginner",
                        certification: "CAD Fundamentals Certificate"
                    },
                    {
                        id: "ifc-basics-003",
                        title: "IFC and File Formats",
                        description: "Understanding Industry Foundation Classes and data exchange",
                        duration: "10 hours",
                        modules: [
                            "IFC File Format Structure",
                            "Data Exchange Principles",
                            "Common BIM Formats",
                            "Import/Export Best Practices",
                            "Quality Control",
                            "Troubleshooting File Issues"
                        ],
                        skills: ["Data Exchange", "File Management", "Quality Control"],
                        difficulty: "Beginner",
                        certification: "IFC Specialist Certificate"
                    }
                ]
            },
            {
                phase: 2,
                title: "3D Modeling Mastery",
                duration: "45 hours",
                courses: [
                    {
                        id: "revit-arch-004",
                        title: "Revit Architecture Fundamentals",
                        description: "Complete architectural modeling with Autodesk Revit",
                        duration: "20 hours",
                        modules: [
                            "Revit Interface and Navigation",
                            "Walls, Doors, and Windows",
                            "Floors and Roofs",
                            "Stairs and Railings",
                            "Families and Components",
                            "Documentation and Sheets"
                        ],
                        skills: ["Revit Modeling", "Architectural Design", "Family Creation"],
                        difficulty: "Intermediate",
                        certification: "Revit Architecture Specialist"
                    },
                    {
                        id: "revit-struct-005",
                        title: "Revit Structure Basics",
                        description: "Structural modeling and analysis preparation",
                        duration: "15 hours",
                        modules: [
                            "Structural Framework",
                            "Foundations and Footings",
                            "Beams and Columns",
                            "Structural Connections",
                            "Rebar Modeling",
                            "Analysis Integration"
                        ],
                        skills: ["Structural Modeling", "Analysis Preparation", "Construction Details"],
                        difficulty: "Intermediate",
                        certification: "Revit Structure Certificate"
                    },
                    {
                        id: "revit-mep-006",
                        title: "Revit MEP Introduction",
                        description: "Basic mechanical, electrical, and plumbing systems",
                        duration: "10 hours",
                        modules: [
                            "MEP System Basics",
                            "Ductwork and Piping",
                            "Electrical Systems",
                            "Equipment Placement",
                            "System Connections",
                            "MEP Documentation"
                        ],
                        skills: ["MEP Modeling", "Systems Design", "Technical Documentation"],
                        difficulty: "Intermediate",
                        certification: "Revit MEP Basics Certificate"
                    }
                ]
            },
            {
                phase: 3,
                title: "Quality Control & Standards",
                duration: "25 hours",
                courses: [
                    {
                        id: "qc-standards-007",
                        title: "BIM Quality Control",
                        description: "Model checking, validation, and quality assurance",
                        duration: "12 hours",
                        modules: [
                            "Model Checking Procedures",
                            "Validation Tools",
                            "Error Detection and Fixing",
                            "Quality Standards",
                            "Documentation Requirements",
                            "Audit Procedures"
                        ],
                        skills: ["Quality Control", "Model Validation", "Standards Compliance"],
                        difficulty: "Intermediate",
                        certification: "BIM Quality Specialist"
                    },
                    {
                        id: "naming-conventions-008",
                        title: "BIM Standards and Naming",
                        description: "Standardization and naming conventions",
                        duration: "8 hours",
                        modules: [
                            "Naming Conventions",
                            "Layer Standards",
                            "File Organization",
                            "Template Creation",
                            "Standard Libraries",
                            "Version Control"
                        ],
                        skills: ["Standardization", "File Management", "Template Creation"],
                        difficulty: "Beginner",
                        certification: "BIM Standards Certificate"
                    },
                    {
                        id: "collaboration-009",
                        title: "Basic Collaboration",
                        description: "Working in collaborative BIM environments",
                        duration: "5 hours",
                        modules: [
                            "Central File Concepts",
                            "Workset Management",
                            "Synchronization Process",
                            "Conflict Resolution",
                            "Communication Protocols",
                            "Backup Procedures"
                        ],
                        skills: ["Collaboration", "Teamwork", "Communication"],
                        difficulty: "Intermediate",
                        certification: "BIM Collaboration Basics"
                    }
                ]
            },
            {
                phase: 4,
                title: "Specialization & Advanced Skills",
                duration: "20 hours",
                courses: [
                    {
                        id: "visualization-010",
                        title: "3D Visualization",
                        description: "Rendering and presentation techniques",
                        duration: "8 hours",
                        modules: [
                            "Rendering Basics",
                            "Material Applications",
                            "Lighting Setup",
                            "Camera Positioning",
                            "Animation Basics",
                            "Presentation Techniques"
                        ],
                        skills: ["Visualization", "Rendering", "Presentation"],
                        difficulty: "Intermediate",
                        certification: "BIM Visualization Specialist"
                    },
                    {
                        id: "parametric-011",
                        title: "Parametric Modeling",
                        description: "Advanced family creation and parametric design",
                        duration: "12 hours",
                        modules: [
                            "Family Creation Principles",
                            "Parametric Constraints",
                            "Formula and Parameters",
                            "Adaptive Families",
                            "System Families",
                            "Family Testing and QC"
                        ],
                        skills: ["Parametric Design", "Family Creation", "Advanced Modeling"],
                        difficulty: "Advanced",
                        certification: "Parametric Modeling Expert"
                    }
                ]
            }
        ],

        assessments: [
            {
                type: "Phase Assessment",
                frequency: "After each phase",
                passingScore: 75,
                retakePolicy: "Unlimited with 24-hour waiting period"
            },
            {
                type: "Final Certification Exam",
                duration: "2 hours",
                passingScore: 80,
                prerequisites: "Complete all phases"
            }
        ],

        careerProgression: {
            nextLevel: "BIM Coordinator",
            requirements: [
                "Complete all BIM Modeller courses with 80% average",
                "Pass final certification exam",
                "6 months practical experience",
                "Portfolio submission with 3 completed projects"
            ],
            timeframe: "6-12 months"
        }
    },

    "BIM Coordinator": {
        title: "BIM Coordinator Learning Path",
        description: "Advanced coordination, clash detection, and project management skills",
        color: "#FF9800",
        icon: "fas fa-users-cog",
        totalHours: 150,
        prerequisites: ["BIM Modeller Certification"],
        learningOutcome: "Lead BIM coordination, manage multidisciplinary teams, and ensure project integration",

        phases: [
            {
                phase: 1,
                title: "Coordination Fundamentals",
                duration: "40 hours",
                courses: [
                    {
                        id: "coord-principles-012",
                        title: "BIM Coordination Principles",
                        description: "Understanding coordination workflows and responsibilities",
                        duration: "15 hours",
                        modules: [
                            "Coordination Roles and Responsibilities",
                            "Project Phases and Milestones",
                            "Stakeholder Management",
                            "Communication Protocols",
                            "Issue Tracking Systems",
                            "Documentation Standards"
                        ],
                        skills: ["Project Coordination", "Stakeholder Management", "Communication"],
                        difficulty: "Intermediate",
                        certification: "BIM Coordination Specialist"
                    },
                    {
                        id: "federated-models-013",
                        title: "Federated Model Management",
                        description: "Managing combined models from multiple disciplines",
                        duration: "12 hours",
                        modules: [
                            "Federated Model Concepts",
                            "Model Integration Process",
                            "Reference Management",
                            "Coordination Views",
                            "Model Validation",
                            "Performance Optimization"
                        ],
                        skills: ["Model Integration", "Performance Optimization", "Validation"],
                        difficulty: "Advanced",
                        certification: "Federated Model Expert"
                    },
                    {
                        id: "clash-detection-014",
                        title: "Advanced Clash Detection",
                        description: "Comprehensive clash detection and resolution strategies",
                        duration: "13 hours",
                        modules: [
                            "Clash Detection Theory",
                            "Navisworks Manage",
                            "Clash Rules and Sets",
                            "Clash Matrix Development",
                            "Resolution Workflows",
                            "Progress Tracking"
                        ],
                        skills: ["Clash Detection", "Navisworks", "Problem Resolution"],
                        difficulty: "Advanced",
                        certification: "Clash Detection Expert"
                    }
                ]
            },
            {
                phase: 2,
                title: "Process Management",
                duration: "45 hours",
                courses: [
                    {
                        id: "bep-development-015",
                        title: "BIM Execution Plan Development",
                        description: "Creating comprehensive BIM execution strategies",
                        duration: "18 hours",
                        modules: [
                            "BEP Structure and Components",
                            "Project Requirements Analysis",
                            "Technology Planning",
                            "Resource Allocation",
                            "Risk Assessment",
                            "Implementation Strategy"
                        ],
                        skills: ["Strategic Planning", "Risk Management", "Resource Planning"],
                        difficulty: "Advanced",
                        certification: "BIM Planning Specialist"
                    },
                    {
                        id: "cde-management-016",
                        title: "Common Data Environment Management",
                        description: "Managing project information and collaboration platforms",
                        duration: "15 hours",
                        modules: [
                            "CDE Principles and Standards",
                            "Information Security",
                            "Access Control Management",
                            "Workflow Automation",
                            "Version Control",
                            "Audit and Compliance"
                        ],
                        skills: ["Information Management", "Security", "Compliance"],
                        difficulty: "Advanced",
                        certification: "CDE Management Expert"
                    },
                    {
                        id: "team-leadership-017",
                        title: "BIM Team Leadership",
                        description: "Leading and managing BIM teams effectively",
                        duration: "12 hours",
                        modules: [
                            "Leadership Principles",
                            "Team Building",
                            "Conflict Resolution",
                            "Performance Management",
                            "Training and Development",
                            "Motivation Techniques"
                        ],
                        skills: ["Leadership", "Team Management", "Conflict Resolution"],
                        difficulty: "Intermediate",
                        certification: "BIM Team Leader"
                    }
                ]
            },
            {
                phase: 3,
                title: "Advanced Technology",
                duration: "35 hours",
                courses: [
                    {
                        id: "automation-018",
                        title: "BIM Automation and Scripting",
                        description: "Automating repetitive tasks and custom solutions",
                        duration: "20 hours",
                        modules: [
                            "Automation Principles",
                            "Dynamo Scripting",
                            "API Integration",
                            "Custom Tools Development",
                            "Process Optimization",
                            "Deployment Strategies"
                        ],
                        skills: ["Automation", "Scripting", "Process Optimization"],
                        difficulty: "Advanced",
                        certification: "BIM Automation Specialist"
                    },
                    {
                        id: "advanced-analysis-019",
                        title: "Advanced Model Analysis",
                        description: "Complex analysis and simulation workflows",
                        duration: "15 hours",
                        modules: [
                            "Energy Analysis",
                            "Structural Analysis Integration",
                            "CFD Simulation",
                            "Lighting Analysis",
                            "Cost Analysis",
                            "Sustainability Assessment"
                        ],
                        skills: ["Analysis", "Simulation", "Sustainability"],
                        difficulty: "Advanced",
                        certification: "BIM Analysis Expert"
                    }
                ]
            },
            {
                phase: 4,
                title: "Project Delivery",
                duration: "30 hours",
                courses: [
                    {
                        id: "project-delivery-020",
                        title: "Integrated Project Delivery",
                        description: "Managing complete BIM project lifecycle",
                        duration: "18 hours",
                        modules: [
                            "IPD Principles",
                            "Lean Construction",
                            "Collaborative Contracts",
                            "Risk Sharing Models",
                            "Performance Metrics",
                            "Continuous Improvement"
                        ],
                        skills: ["Project Delivery", "Lean Construction", "Performance Management"],
                        difficulty: "Advanced",
                        certification: "IPD Specialist"
                    },
                    {
                        id: "handover-closeout-021",
                        title: "Project Handover and Closeout",
                        description: "Effective project completion and knowledge transfer",
                        duration: "12 hours",
                        modules: [
                            "Handover Requirements",
                            "As-Built Documentation",
                            "Data Migration",
                            "Training Delivery",
                            "Lessons Learned",
                            "Archive Management"
                        ],
                        skills: ["Project Closeout", "Knowledge Transfer", "Documentation"],
                        difficulty: "Intermediate",
                        certification: "Project Handover Specialist"
                    }
                ]
            }
        ],

        assessments: [
            {
                type: "Phase Assessment",
                frequency: "After each phase",
                passingScore: 80,
                retakePolicy: "Unlimited with 48-hour waiting period"
            },
            {
                type: "Practical Project",
                description: "Lead a coordination project with real stakeholders",
                duration: "4 weeks",
                passingScore: 85
            },
            {
                type: "Final Certification Exam",
                duration: "3 hours",
                passingScore: 85,
                prerequisites: "Complete all phases and practical project"
            }
        ],

        careerProgression: {
            nextLevel: "BIM Manager",
            requirements: [
                "Complete all BIM Coordinator courses with 85% average",
                "Successfully complete practical project",
                "Pass final certification exam",
                "12 months coordination experience",
                "Lead at least 2 major coordination projects",
                "Demonstrate team leadership capabilities"
            ],
            timeframe: "12-18 months"
        }
    },

    "BIM Manager": {
        title: "BIM Manager Learning Path",
        description: "Strategic leadership, organizational implementation, and enterprise-wide BIM management",
        color: "#9C27B0",
        icon: "fas fa-crown",
        totalHours: 180,
        prerequisites: ["BIM Coordinator Certification"],
        learningOutcome: "Drive organizational BIM strategy, implement enterprise standards, and lead digital transformation",

        phases: [
            {
                phase: 1,
                title: "Strategic Leadership",
                duration: "50 hours",
                courses: [
                    {
                        id: "bim-strategy-022",
                        title: "BIM Strategy Development",
                        description: "Creating organizational BIM implementation strategies",
                        duration: "20 hours",
                        modules: [
                            "Strategic Planning Frameworks",
                            "Organizational Assessment",
                            "Technology Roadmapping",
                            "Change Management",
                            "ROI Analysis",
                            "Implementation Roadmap"
                        ],
                        skills: ["Strategic Planning", "Change Management", "ROI Analysis"],
                        difficulty: "Advanced",
                        certification: "BIM Strategy Expert"
                    },
                    {
                        id: "organizational-change-023",
                        title: "Organizational Change Management",
                        description: "Leading digital transformation in construction organizations",
                        duration: "18 hours",
                        modules: [
                            "Change Management Theory",
                            "Stakeholder Analysis",
                            "Communication Strategy",
                            "Training Program Development",
                            "Resistance Management",
                            "Cultural Transformation"
                        ],
                        skills: ["Change Management", "Leadership", "Communication"],
                        difficulty: "Advanced",
                        certification: "Change Management Leader"
                    },
                    {
                        id: "executive-leadership-024",
                        title: "Executive Leadership in BIM",
                        description: "C-level leadership and strategic decision making",
                        duration: "12 hours",
                        modules: [
                            "Executive Communication",
                            "Board Presentations",
                            "Financial Planning",
                            "Risk Management",
                            "Innovation Leadership",
                            "Industry Networking"
                        ],
                        skills: ["Executive Leadership", "Strategic Communication", "Financial Planning"],
                        difficulty: "Expert",
                        certification: "BIM Executive Leader"
                    }
                ]
            },
            {
                phase: 2,
                title: "Enterprise Implementation",
                duration: "55 hours",
                courses: [
                    {
                        id: "enterprise-standards-025",
                        title: "Enterprise BIM Standards",
                        description: "Developing organization-wide BIM standards and protocols",
                        duration: "22 hours",
                        modules: [
                            "Standards Development Process",
                            "Technology Standards",
                            "Process Standardization",
                            "Quality Frameworks",
                            "Compliance Management",
                            "Continuous Improvement"
                        ],
                        skills: ["Standards Development", "Quality Management", "Process Design"],
                        difficulty: "Expert",
                        certification: "Enterprise Standards Expert"
                    },
                    {
                        id: "technology-management-026",
                        title: "BIM Technology Management",
                        description: "Managing enterprise BIM technology infrastructure",
                        duration: "18 hours",
                        modules: [
                            "Technology Architecture",
                            "Software Licensing",
                            "Infrastructure Planning",
                            "Security Management",
                            "Integration Strategies",
                            "Vendor Management"
                        ],
                        skills: ["Technology Management", "Infrastructure Planning", "Vendor Relations"],
                        difficulty: "Advanced",
                        certification: "BIM Technology Manager"
                    },
                    {
                        id: "performance-measurement-027",
                        title: "BIM Performance Measurement",
                        description: "Developing KPIs and measuring BIM implementation success",
                        duration: "15 hours",
                        modules: [
                            "KPI Development",
                            "Performance Metrics",
                            "Data Analytics",
                            "Benchmarking",
                            "Reporting Systems",
                            "Continuous Monitoring"
                        ],
                        skills: ["Performance Management", "Analytics", "Reporting"],
                        difficulty: "Advanced",
                        certification: "BIM Performance Analyst"
                    }
                ]
            },
            {
                phase: 3,
                title: "Industry Leadership",
                duration: "45 hours",
                courses: [
                    {
                        id: "industry-standards-028",
                        title: "Industry Standards Development",
                        description: "Contributing to industry-wide BIM standards and best practices",
                        duration: "20 hours",
                        modules: [
                            "Standards Organizations",
                            "ISO Standards Development",
                            "Industry Collaboration",
                            "Research and Development",
                            "Publication and Dissemination",
                            "International Cooperation"
                        ],
                        skills: ["Industry Leadership", "Standards Development", "Research"],
                        difficulty: "Expert",
                        certification: "Industry Standards Leader"
                    },
                    {
                        id: "innovation-management-029",
                        title: "BIM Innovation Management",
                        description: "Leading innovation and emerging technology adoption",
                        duration: "15 hours",
                        modules: [
                            "Innovation Frameworks",
                            "Emerging Technologies",
                            "R&D Management",
                            "Pilot Program Development",
                            "Technology Evaluation",
                            "Innovation Culture"
                        ],
                        skills: ["Innovation Management", "Technology Evaluation", "R&D Leadership"],
                        difficulty: "Expert",
                        certification: "BIM Innovation Leader"
                    },
                    {
                        id: "thought-leadership-030",
                        title: "Industry Thought Leadership",
                        description: "Establishing expertise and influencing industry direction",
                        duration: "10 hours",
                        modules: [
                            "Content Creation",
                            "Speaking and Presentations",
                            "Research Publication",
                            "Media Relations",
                            "Professional Networking",
                            "Mentorship Programs"
                        ],
                        skills: ["Thought Leadership", "Public Speaking", "Professional Networking"],
                        difficulty: "Expert",
                        certification: "BIM Thought Leader"
                    }
                ]
            },
            {
                phase: 4,
                title: "Digital Transformation",
                duration: "30 hours",
                courses: [
                    {
                        id: "digital-strategy-031",
                        title: "Digital Transformation Strategy",
                        description: "Leading comprehensive digital transformation initiatives",
                        duration: "18 hours",
                        modules: [
                            "Digital Strategy Frameworks",
                            "Technology Integration",
                            "Data Strategy",
                            "Cybersecurity",
                            "Digital Culture",
                            "Future-Proofing"
                        ],
                        skills: ["Digital Strategy", "Technology Integration", "Cybersecurity"],
                        difficulty: "Expert",
                        certification: "Digital Transformation Leader"
                    },
                    {
                        id: "sustainability-leadership-032",
                        title: "Sustainable BIM Leadership",
                        description: "Integrating sustainability into BIM strategy and operations",
                        duration: "12 hours",
                        modules: [
                            "Sustainability Frameworks",
                            "Green BIM Strategies",
                            "Environmental Impact Assessment",
                            "Sustainable Design Integration",
                            "Carbon Footprint Analysis",
                            "Circular Economy Principles"
                        ],
                        skills: ["Sustainability Leadership", "Environmental Analysis", "Green Building"],
                        difficulty: "Advanced",
                        certification: "Sustainable BIM Leader"
                    }
                ]
            }
        ],

        assessments: [
            {
                type: "Phase Assessment",
                frequency: "After each phase",
                passingScore: 85,
                retakePolicy: "Unlimited with 72-hour waiting period"
            },
            {
                type: "Strategic Project",
                description: "Develop and present comprehensive BIM strategy for a real organization",
                duration: "8 weeks",
                passingScore: 90
            },
            {
                type: "Industry Contribution",
                description: "Contribute to industry standards or publish thought leadership content",
                timeline: "Ongoing throughout program"
            },
            {
                type: "Final Certification Exam",
                duration: "4 hours",
                passingScore: 90,
                prerequisites: "Complete all phases, strategic project, and industry contribution"
            }
        ],

        careerProgression: {
            nextLevel: "Industry Expert / Consultant",
            requirements: [
                "Complete all BIM Manager courses with 90% average",
                "Successfully complete strategic project with excellent rating",
                "Make significant industry contribution",
                "Pass final certification exam",
                "24+ months management experience",
                "Lead organizational transformation initiative",
                "Demonstrated industry recognition"
            ],
            timeframe: "18-24 months"
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = enhancedLearningPaths;
} else {
    window.enhancedLearningPaths = enhancedLearningPaths;
}