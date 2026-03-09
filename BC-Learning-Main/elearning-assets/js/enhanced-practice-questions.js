// Enhanced Practice Questions Database - Phase 2 Content
// Level-specific practice questions with detailed explanations

const enhancedPracticeQuestions = {
    "BIM Modeller": {
        categories: {
            "bim-fundamentals": {
                title: "BIM Fundamentals",
                description: "Basic BIM concepts and principles",
                difficulty: "Beginner",
                questions: [
                    {
                        id: "bim-fund-001",
                        question: "What does BIM stand for and what is its primary purpose?",
                        type: "multiple-choice",
                        options: [
                            "Building Information Management - for facility management",
                            "Building Information Modeling - for creating intelligent 3D models",
                            "Basic Infrastructure Modeling - for infrastructure projects",
                            "Building Integration Method - for system integration"
                        ],
                        correctAnswer: 1,
                        explanation: "BIM stands for Building Information Modeling. It's a process involving the generation and management of digital representations of physical and functional characteristics of places. BIM goes beyond 3D modeling to include time (4D), cost (5D), and other dimensions of information.",
                        learningObjective: "Understand the fundamental definition and purpose of BIM",
                        relatedTopics: ["BIM Definition", "Digital Modeling", "Information Management"],
                        difficulty: "Beginner",
                        timeToComplete: 45,
                        references: ["ISO 19650", "BIM Handbook 3rd Edition"],
                        imageUrl: "/elearning-assets/images/questions/SOAL BASIC, INTERMEDIATE, ADVANCE PERMODELAN.docx_1766118198621_08fl459cm.png"
                    },
                    {
                        id: "bim-fund-002",
                        question: "Which of the following best describes the difference between BIM Level 2 and Level 3?",
                        type: "multiple-choice",
                        options: [
                            "Level 2 uses 2D CAD, Level 3 uses 3D modeling",
                            "Level 2 involves collaborative 3D modeling with file sharing, Level 3 uses a single shared model",
                            "Level 2 includes cost information, Level 3 includes scheduling",
                            "There is no significant difference between Level 2 and 3"
                        ],
                        correctAnswer: 1,
                        explanation: "BIM Level 2 involves collaborative working using 3D CAD models where each discipline creates their own model and shares information through common file formats like IFC. BIM Level 3 (not yet fully implemented industry-wide) would involve all disciplines working on a single, shared model in a cloud-based environment.",
                        learningObjective: "Differentiate between BIM maturity levels",
                        relatedTopics: ["BIM Levels", "Collaboration", "Model Sharing"],
                        difficulty: "Intermediate",
                        timeToComplete: 60,
                        references: ["UK BIM Framework", "PAS 1192 Series"],
                        imageUrl: "/elearning-assets/images/questions/SOAL BASIC, INTERMEDIATE, ADVANCE PERMODELAN.docx_1766118198623_gdkcoyhew.png"
                    },
                    {
                        id: "bim-fund-003",
                        question: "What is the primary purpose of the IFC (Industry Foundation Classes) format?",
                        type: "multiple-choice",
                        options: [
                            "To compress file sizes for faster transfer",
                            "To enable interoperability between different BIM software",
                            "To store rendering and visualization data",
                            "To backup project files automatically"
                        ],
                        correctAnswer: 1,
                        explanation: "IFC is an open, neutral data format developed by buildingSMART to facilitate interoperability between different BIM software applications. It allows models created in one software to be shared and used in another, maintaining the geometric and semantic information.",
                        learningObjective: "Understand the purpose and importance of IFC format",
                        relatedTopics: ["Interoperability", "Data Exchange", "buildingSMART"],
                        difficulty: "Beginner",
                        timeToComplete: 45,
                        references: ["buildingSMART IFC Specification", "ISO 16739"],
                        imageUrl: "/elearning-assets/images/questions/SOAL BASIC, INTERMEDIATE, ADVANCE PERMODELAN.docx_1766118198624_apeum3dom.png"
                    }
                ]
            },
            "revit-modeling": {
                title: "Revit Modeling",
                description: "Practical Revit modeling skills and techniques",
                difficulty: "Intermediate",
                questions: [
                    {
                        id: "revit-mod-001",
                        question: "When creating a custom wall type in Revit, which parameter controls the total thickness?",
                        type: "multiple-choice",
                        options: [
                            "Width parameter in the family",
                            "The sum of all layer thicknesses in the wall structure",
                            "The Thickness parameter in Type Properties",
                            "The Core Boundary layers only"
                        ],
                        correctAnswer: 1,
                        explanation: "In Revit, the total wall thickness is determined by the sum of all individual layer thicknesses defined in the wall structure. Each layer (finish, core, etc.) has its own thickness value, and the total is calculated automatically.",
                        learningObjective: "Understand wall type structure and thickness calculation",
                        relatedTopics: ["Wall Types", "Layer Structure", "Building Elements"],
                        difficulty: "Intermediate",
                        timeToComplete: 60,
                        practicalTip: "Always verify total thickness matches design requirements when editing wall structures",
                        imageUrl: "/elearning-assets/images/questions/SOAL BASIC, INTERMEDIATE, ADVANCE PERMODELAN.docx_1766118198625_b3r6tqw7u.png"
                    },
                    {
                        id: "revit-mod-002",
                        question: "What is the correct workflow for creating a parametric family in Revit?",
                        type: "multiple-choice",
                        options: [
                            "Start with a generic model template, add geometry, then parameters",
                            "Choose appropriate family template, create reference planes, add parameters, build geometry, test flexibility",
                            "Import CAD file, convert to Revit geometry, add parameters",
                            "Copy existing family, modify geometry, save with new name"
                        ],
                        correctAnswer: 1,
                        explanation: "The correct workflow ensures the family behaves predictably: 1) Choose the right template for the category, 2) Create reference planes for dimensional control, 3) Add parameters for flexibility, 4) Build geometry constrained to reference planes, 5) Test parameter changes to ensure proper behavior.",
                        learningObjective: "Master the family creation workflow",
                        relatedTopics: ["Family Creation", "Parametric Design", "Reference Planes"],
                        difficulty: "Advanced",
                        timeToComplete: 120,
                        practicalTip: "Always test family flexibility by changing parameter values before using in projects",
                        imageUrl: "/elearning-assets/images/questions/SOAL BASIC, INTERMEDIATE, ADVANCE PERMODELAN.docx_1766118198626_aat19zz1x.png"
                    }
                ]
            },
            "quality-control": {
                title: "Quality Control",
                description: "Model checking and validation procedures",
                difficulty: "Intermediate",
                questions: [
                    {
                        id: "qc-001",
                        question: "Which of the following should be checked during a basic model quality review?",
                        type: "multiple-choice",
                        options: [
                            "Only geometric accuracy and dimensions",
                            "Model performance and file size only",
                            "Geometric accuracy, information completeness, naming conventions, and model performance",
                            "Just naming conventions and layer organization"
                        ],
                        correctAnswer: 2,
                        explanation: "A comprehensive quality review should cover: geometric accuracy (dimensions, alignments), information completeness (required properties and data), naming conventions (consistent with standards), and model performance (file size, loading times, graphics performance).",
                        learningObjective: "Understand comprehensive quality control procedures",
                        relatedTopics: ["Quality Assurance", "Model Validation", "Standards Compliance"],
                        difficulty: "Intermediate",
                        timeToComplete: 75,
                        practicalTip: "Develop a quality checklist specific to your organization's standards",
                        imageUrl: "/elearning-assets/images/questions/SOAL BASIC, INTERMEDIATE, ADVANCE PERMODELAN.docx_1766118198627_p0v8kdx25.png"
                    }
                ]
            },
            "revit-fundamentals": {
                title: "Revit Fundamentals",
                description: "Basic Revit interface, navigation, and core concepts",
                difficulty: "Beginner",
                questions: [
                    {
                        id: "revit-fund-001",
                        question: "Elemen diatas berfungsi untuk menampilkan komponen pada tampak",
                        type: "multiple-choice",
                        options: ["Atas", "Samping", "Perspektif", "3D"],
                        correctAnswer: 3,
                        explanation: "The 3D view in Revit displays building components in three-dimensional space, allowing you to see the complete model from any angle.",
                        learningObjective: "Understand basic Revit view types",
                        relatedTopics: ["Revit Interface", "View Navigation", "3D Visualization"],
                        difficulty: "Beginner",
                        timeToComplete: 45,
                        imageUrl: "/elearning-assets/images/questions/SOAL POST TEST SESI 1&2 REVIT BASIC BRIDGE.docx_1766114864682_h4vqjyu3g.png"
                    },
                    {
                        id: "revit-fund-002",
                        question: "Bagaimana cara membuat ref plane?",
                        type: "multiple-choice",
                        options: [
                            "tabs architecture/structural → work plane panel",
                            "tabs insert→  work plane panel",
                            "tabs annotate→ detail",
                            "tabs view→ create"
                        ],
                        correctAnswer: 0,
                        explanation: "Reference planes are created using the Work Plane panel in the Architecture or Structure tab. They provide a surface for sketching and positioning elements.",
                        learningObjective: "Learn to create reference planes for modeling",
                        relatedTopics: ["Reference Planes", "Work Planes", "Modeling Tools"],
                        difficulty: "Beginner",
                        timeToComplete: 60
                    },
                    {
                        id: "revit-fund-003",
                        question: "File ekstensi standar untuk menyimpan proyek Revit adalah …",
                        type: "multiple-choice",
                        options: [".dwg", ".rvt", ".ifc", ".rfa"],
                        correctAnswer: 1,
                        explanation: "Revit project files use the .rvt extension. This is the native format for Autodesk Revit projects.",
                        learningObjective: "Understand Revit file formats",
                        relatedTopics: ["File Management", "Project Files", "Revit Formats"],
                        difficulty: "Beginner",
                        timeToComplete: 30
                    },
                    {
                        id: "revit-fund-004",
                        question: "Untuk memasukkan material pada sebuah elemen kita dapat menggunakan",
                        type: "multiple-choice",
                        options: ["Project browser", "View control bar", "Properties", "Option bar"],
                        correctAnswer: 2,
                        explanation: "Materials are assigned to elements through the Properties palette. This allows you to control the visual and physical properties of building components.",
                        learningObjective: "Learn material assignment in Revit",
                        relatedTopics: ["Materials", "Element Properties", "Visualization"],
                        difficulty: "Beginner",
                        timeToComplete: 45
                    },
                    {
                        id: "revit-fund-005",
                        question: "Dialog diatas berfungsi untuk mengatur",
                        type: "multiple-choice",
                        options: ["Ketebalan elemen", "Material penyusun elemen", "Warna dasar elemen", "Bentuk elemen"],
                        correctAnswer: 1,
                        explanation: "The dialog shown is used to configure the materials that make up an element, such as wall layers, their thickness, and material composition.",
                        learningObjective: "Understand material composition dialogs in Revit",
                        relatedTopics: ["Material Layers", "Element Structure", "Wall Types"],
                        difficulty: "Beginner",
                        timeToComplete: 60
                    },
                    {
                        id: "revit-fund-006",
                        question: "Fungsi tools diatas adalah",
                        type: "multiple-choice",
                        options: ["Memindahkan sebuah elemen", "Mengubah arah sebuah elemen", "Memperbanyak sebuah elemen", "Mengubah ukuran sebuah elemen"],
                        correctAnswer: 1,
                        explanation: "The rotate tool is used to change the orientation or direction of building elements in Revit.",
                        learningObjective: "Learn basic transformation tools in Revit",
                        relatedTopics: ["Transform Tools", "Element Modification", "Modeling Basics"],
                        difficulty: "Beginner",
                        timeToComplete: 45
                    },
                    {
                        id: "revit-fund-007",
                        question: "Untuk memutar objek/elemen, dapat menggunakan tools",
                        type: "multiple-choice",
                        options: ["Copy", "Move", "Rotate", "Scale"],
                        correctAnswer: 2,
                        explanation: "The Rotate tool is specifically used to change the rotational orientation of objects and elements in Revit.",
                        learningObjective: "Master rotation operations in Revit",
                        relatedTopics: ["Rotation Tools", "Element Orientation", "Transform Operations"],
                        difficulty: "Beginner",
                        timeToComplete: 45
                    },
                    {
                        id: "revit-fund-008",
                        question: "Untuk membuat grid kolom struktur di Revit, perintah yang dipakai adalah …",
                        type: "multiple-choice",
                        options: ["Datum Grid", "Reference Plane", "Level", "Section Line"],
                        correctAnswer: 0,
                        explanation: "Datum Grid is the command used to create structural column grids in Revit, providing the framework for positioning structural elements.",
                        learningObjective: "Learn grid creation for structural layouts",
                        relatedTopics: ["Structural Grids", "Datum Elements", "Building Layout"],
                        difficulty: "Beginner",
                        timeToComplete: 60
                    },
                    {
                        id: "revit-fund-009",
                        question: "Dalam Revit, perbedaan utama antara Type Parameter dan Instance Parameter adalah…",
                        type: "multiple-choice",
                        options: [
                            "Type Parameter hanya berlaku pada satu elemen yang dipilih, Instance Parameter berlaku untuk semua tipe elemen",
                            "Type Parameter berlaku untuk semua elemen dengan tipe yang sama, Instance Parameter berlaku untuk elemen individual",
                            "Instance Parameter hanya bisa digunakan untuk dimensi, Type Parameter hanya untuk material",
                            "Instance Parameter otomatis tersimpan ke dalam family default, Type Parameter tidak"
                        ],
                        correctAnswer: 1,
                        explanation: "Type Parameters apply to all elements of the same type/family, while Instance Parameters are unique to individual element instances.",
                        learningObjective: "Understand parameter types in Revit families",
                        relatedTopics: ["Parameters", "Family Types", "Element Properties"],
                        difficulty: "Beginner",
                        timeToComplete: 75
                    },
                    {
                        id: "revit-fund-010",
                        question: "Untuk memunculkan library/family lainnya pada dialog properties diatas dapat dipilih",
                        type: "multiple-choice",
                        options: ["Duplicate", "Load", "Rename", "Preview"],
                        correctAnswer: 1,
                        explanation: "The Load button allows you to load additional families into your Revit project from external libraries.",
                        learningObjective: "Learn to load families in Revit projects",
                        relatedTopics: ["Family Libraries", "Project Management", "Component Loading"],
                        difficulty: "Beginner",
                        timeToComplete: 45
                    },
                    {
                        id: "revit-fund-011",
                        question: "Tools pada tabs modify yang berfungsi untuk menyalin dan memindahkan elemen adalah",
                        type: "multiple-choice",
                        options: ["Copy", "Trim", "Array", "Split element"],
                        correctAnswer: 0,
                        explanation: "The Copy tool in the Modify tab allows you to duplicate and reposition elements in your Revit model.",
                        learningObjective: "Master basic modification tools in Revit",
                        relatedTopics: ["Modify Tools", "Element Manipulation", "Modeling Workflow"],
                        difficulty: "Beginner",
                        timeToComplete: 45
                    },
                    {
                        id: "revit-fund-012",
                        question: "Tools pada panel geometry yang berfungsi untuk membuat gabungan antara 2 atau lebih elemen host adalah",
                        type: "multiple-choice",
                        options: ["Cope", "Cut", "Join", "Split face"],
                        correctAnswer: 2,
                        explanation: "The Join tool combines multiple host elements (like walls or floors) into a single unified element.",
                        learningObjective: "Learn geometry modification tools",
                        relatedTopics: ["Geometry Tools", "Element Joining", "Model Cleanup"],
                        difficulty: "Beginner",
                        timeToComplete: 60
                    },
                    {
                        id: "revit-fund-013",
                        question: "Untuk membuat 3D shape dengan luas/bentuk permukaan yang berbeda pada kedua sisinya dapat menggunakan",
                        type: "multiple-choice",
                        options: ["Extrusion", "Void form", "Revolve", "Blend"],
                        correctAnswer: 3,
                        explanation: "The Blend tool creates 3D shapes where the top and bottom profiles have different shapes and/or sizes.",
                        learningObjective: "Understand 3D modeling tools in Revit",
                        relatedTopics: ["3D Modeling", "Form Creation", "Geometric Shapes"],
                        difficulty: "Beginner",
                        timeToComplete: 75
                    },
                    {
                        id: "revit-fund-014",
                        question: "Tools pada tabs modify yang berfungsi untuk memisahkan elemen garis menjadi dua bagian adalah",
                        type: "multiple-choice",
                        options: ["Copy", "Trim", "Array", "Split element"],
                        correctAnswer: 3,
                        explanation: "Split Element divides a line-based element (like walls or lines) into two separate segments.",
                        learningObjective: "Learn element splitting and modification",
                        relatedTopics: ["Element Splitting", "Model Editing", "Detailing"],
                        difficulty: "Beginner",
                        timeToComplete: 50
                    },
                    {
                        id: "revit-fund-015",
                        question: "Perintah Align pada Revit digunakan untuk…",
                        type: "multiple-choice",
                        options: ["Menghapus objek", "Menyelaraskan posisi objek terhadap referensi tertentu", "Mengubah tinggi Level", "Membuat grid bangunan"],
                        correctAnswer: 1,
                        explanation: "The Align tool positions objects precisely relative to reference lines, grids, or other elements.",
                        learningObjective: "Master alignment and positioning tools",
                        relatedTopics: ["Alignment Tools", "Precision Modeling", "Element Positioning"],
                        difficulty: "Beginner",
                        timeToComplete: 55
                    },
                    {
                        id: "revit-fund-016",
                        question: "Jenis view yang digunakan untuk menggambar denah adalah …",
                        type: "multiple-choice",
                        options: ["3D View", "Floor Plan", "Section", "Elevation"],
                        correctAnswer: 1,
                        explanation: "Floor Plan views show the horizontal layout of building elements at each level.",
                        learningObjective: "Understand different view types in Revit",
                        relatedTopics: ["View Types", "Floor Plans", "Documentation"],
                        difficulty: "Beginner",
                        timeToComplete: 40
                    },
                    {
                        id: "revit-fund-017",
                        question: "Saat membuat plat pondasi bertulang, kategori yang digunakan adalah…",
                        type: "multiple-choice",
                        options: ["Structural Slab Foundation", "Floor", "Roof", "Mass"],
                        correctAnswer: 0,
                        explanation: "Structural Slab Foundation is the specific category for creating reinforced concrete foundation slabs.",
                        learningObjective: "Learn foundation element categories",
                        relatedTopics: ["Foundation Types", "Structural Elements", "Building Systems"],
                        difficulty: "Beginner",
                        timeToComplete: 50
                    },
                    {
                        id: "revit-fund-018",
                        question: "Anda ingin mengekspor model Revit ke format IFC untuk dibuka di software lain. Menu yang digunakan adalah…",
                        type: "multiple-choice",
                        options: ["File → Export → CAD Formats", "File → Export → IFC", "File → Save As → IFC", "Manage → IFC Options"],
                        correctAnswer: 1,
                        explanation: "File → Export → IFC is the menu path to export Revit models to Industry Foundation Classes format.",
                        learningObjective: "Learn IFC export procedures",
                        relatedTopics: ["IFC Export", "Interoperability", "Model Exchange"],
                        difficulty: "Beginner",
                        timeToComplete: 45
                    },
                    {
                        id: "revit-fund-019",
                        question: "Anda ingin memiringkan satu sisi atap datar agar air mengalir ke talang. Langkah yang tepat adalah…",
                        type: "multiple-choice",
                        options: [
                            "Mengubah slope pada Roof Properties",
                            "Menambahkan Slope Arrow di edit footprint atap",
                            "Menggunakan Modify → Rotate",
                            "Mengubah Level atap"
                        ],
                        correctAnswer: 1,
                        explanation: "Adding a Slope Arrow in the roof footprint edit mode creates pitched sections for drainage.",
                        learningObjective: "Learn roof slope creation techniques",
                        relatedTopics: ["Roof Design", "Slope Creation", "Drainage Systems"],
                        difficulty: "Beginner",
                        timeToComplete: 70
                    },
                    {
                        id: "revit-fund-020",
                        question: "Untuk mengatur tinggi dinding agar sesuai dengan level lantai, digunakan parameter …",
                        type: "multiple-choice",
                        options: ["Top Constraint", "Base Offset", "Level Head", "Elevation Tag"],
                        correctAnswer: 0,
                        explanation: "Top Constraint parameter controls the upper height limit of walls relative to levels or other references.",
                        learningObjective: "Understand wall height parameters",
                        relatedTopics: ["Wall Parameters", "Level Constraints", "Building Heights"],
                        difficulty: "Beginner",
                        timeToComplete: 55
                    },
                    {
                        id: "revit-fund-021",
                        question: "Revit merupakan salah satu program gambar arsitektural yang merupakan produk dari",
                        type: "multiple-choice",
                        options: ["Google", "AutoCAD", "Autodesk", "MAP"],
                        correctAnswer: 2,
                        explanation: "Autodesk Revit is a BIM software developed by Autodesk, a leading company in design and engineering software.",
                        learningObjective: "Identify Revit as an Autodesk product",
                        relatedTopics: ["Software Vendors", "BIM Tools", "Autodesk Products"],
                        difficulty: "Beginner",
                        timeToComplete: 30
                    },
                    {
                        id: "revit-fund-022",
                        question: "Berikut ini merupakan cara yang tepat untuk membuka aplikasi Autodesk Revit adalah",
                        type: "multiple-choice",
                        options: [
                            "Setelah menginstall aplikasi Revit, klik 1 kali icon aplikasi Revit.",
                            "Setelah menginstall aplikasi Revit, klik 2 kali icon Worksharing Monitor for Autodesk Revit 2018.",
                            "Setelah menginstall aplikasi Revit, klik 2 kali icon aplikasi Revit.",
                            "Setelah menginstall aplikasi Revit, klik 2 kali icon Worksharing Monitor for Autodesk Revit 2018."
                        ],
                        correctAnswer: 2,
                        explanation: "To open Revit, double-click the Revit application icon after installation.",
                        learningObjective: "Learn basic application startup procedures",
                        relatedTopics: ["Software Installation", "Application Launch", "User Interface"],
                        difficulty: "Beginner",
                        timeToComplete: 35
                    },
                    {
                        id: "revit-fund-023",
                        question: "Ctrl + N adalah langkah cepat untuk",
                        type: "multiple-choice",
                        options: ["Membuat project baru", "Mengatur project unit", "Mengatur navigasi", "Menyimpan project"],
                        correctAnswer: 0,
                        explanation: "Ctrl + N is the keyboard shortcut to create a new project in Revit.",
                        learningObjective: "Master essential keyboard shortcuts",
                        relatedTopics: ["Keyboard Shortcuts", "Project Management", "Workflow Efficiency"],
                        difficulty: "Beginner",
                        timeToComplete: 40
                    },
                    {
                        id: "revit-fund-024",
                        question: "Ctrl + S adalah langkah cepat untuk",
                        type: "multiple-choice",
                        options: ["Membuat project baru", "Mengatur project unit", "Mengatur navigasi", "Menyimpan project"],
                        correctAnswer: 3,
                        explanation: "Ctrl + S is the universal keyboard shortcut for saving files in most applications, including Revit.",
                        learningObjective: "Learn file management shortcuts",
                        relatedTopics: ["File Operations", "Data Safety", "Workflow Efficiency"],
                        difficulty: "Beginner",
                        timeToComplete: 35
                    },
                    {
                        id: "revit-fund-025",
                        question: "Format extension dari file Autodesk Revit yang disimpan adalah",
                        type: "multiple-choice",
                        options: [".dwg", ".rvt", ".ifc", ".rfa"],
                        correctAnswer: 1,
                        explanation: "Revit project files use the .rvt extension.",
                        learningObjective: "Understand Revit file formats",
                        relatedTopics: ["File Extensions", "Project Files", "Data Storage"],
                        difficulty: "Beginner",
                        timeToComplete: 30
                    },
                    {
                        id: "revit-fund-026",
                        question: "Berikut ini yang merupakan default template file Autodesk Revit yang digunakan membuat project baru, kecuali",
                        type: "multiple-choice",
                        options: ["Architectural Template", "Structural Template", "Mechanical Template", "MEP Template"],
                        correctAnswer: 2,
                        explanation: "The default templates are Architectural, Structural, and Construction templates. MEP Template is not a default template.",
                        learningObjective: "Identify standard Revit project templates",
                        relatedTopics: ["Project Templates", "Workflow Setup", "Discipline-Specific Tools"],
                        difficulty: "Beginner",
                        timeToComplete: 45
                    },
                    {
                        id: "revit-fund-027",
                        question: "Pada interface Revit, elemen yang berfungsi untuk menampilkan tampilan 3D bangunan adalah",
                        type: "multiple-choice",
                        options: ["a. Membuat tampilan 3D", "b. Membuat tampilan elevasi", "c. Membuat tampilan sebagian", "d. Membuat tampilan 2D"],
                        correctAnswer: 0,
                        explanation: "The 3D view icon creates a three-dimensional view of the building model.",
                        learningObjective: "Navigate between different view types",
                        relatedTopics: ["View Navigation", "3D Visualization", "Model Review"],
                        difficulty: "Beginner",
                        timeToComplete: 40
                    },
                    {
                        id: "revit-fund-028",
                        question: "Fungsi dari icon diatas adalah",
                        type: "multiple-choice",
                        options: ["Menampilkan gambar 2D", "Menampilkan tampak bangunan", "Menampilkan atap bangunan", "Menampilkan tampak potongan"],
                        correctAnswer: 3,
                        explanation: "This icon creates section views that show vertical cuts through the building.",
                        learningObjective: "Understand section view creation",
                        relatedTopics: ["Section Views", "Building Documentation", "Detail Drawings"],
                        difficulty: "Beginner",
                        timeToComplete: 50
                    },
                    {
                        id: "revit-fund-029",
                        question: "Elemen diatas disebut sebagai",
                        type: "multiple-choice",
                        options: ["Option bar", "Status bar", "View control bar", "Quick access toolbar"],
                        correctAnswer: 2,
                        explanation: "The View Control Bar contains controls for visual style, scale, shadows, and other view properties.",
                        learningObjective: "Identify interface elements",
                        relatedTopics: ["User Interface", "View Controls", "Display Options"],
                        difficulty: "Beginner",
                        timeToComplete: 40
                    },
                    {
                        id: "revit-fund-030",
                        question: "Berikut ini tabs yang terdapat pada user interface Autodesk Revit, kecuali",
                        type: "multiple-choice",
                        options: ["Insert", "View", "Design", "Add-Ins"],
                        correctAnswer: 2,
                        explanation: "The main tabs in Revit are Architecture, Structure, Systems, Insert, Annotate, Manage, and View. Design is not a standard tab.",
                        learningObjective: "Navigate Revit ribbon interface",
                        relatedTopics: ["Ribbon Interface", "Tool Organization", "Workflow Tabs"],
                        difficulty: "Beginner",
                        timeToComplete: 45
                    }
                ]
            }
        }
    },

    "BIM Coordinator": {
        categories: {
            "clash-detection": {
                title: "Clash Detection",
                description: "Advanced clash detection and resolution strategies",
                difficulty: "Advanced",
                questions: [
                    {
                        id: "clash-001",
                        question: "What is the most effective strategy for prioritizing clash resolution in a complex project?",
                        type: "multiple-choice",
                        options: [
                            "Resolve all hard clashes first, then soft clashes",
                            "Prioritize by discipline: structural, then MEP, then architectural",
                            "Focus on critical path elements and major systems first",
                            "Resolve in order of clash detection date"
                        ],
                        correctAnswer: 2,
                        explanation: "The most effective strategy prioritizes clashes based on their impact on project critical path and major building systems. This ensures that conflicts affecting project schedule and essential functionality are resolved first, minimizing downstream impacts.",
                        learningObjective: "Develop strategic thinking for clash resolution prioritization",
                        relatedTopics: ["Project Management", "Critical Path", "Risk Assessment"],
                        difficulty: "Advanced",
                        timeToComplete: 90,
                        scenario: "50-story office building with complex MEP systems",
                        practicalTip: "Create a clash priority matrix based on system importance and schedule impact"
                    },
                    {
                        id: "clash-002",
                        question: "In Navisworks, what is the difference between 'Hard' and 'Soft' clashes?",
                        type: "multiple-choice",
                        options: [
                            "Hard clashes are between structural elements, soft clashes are between MEP",
                            "Hard clashes involve physical interference, soft clashes involve clearance violations",
                            "Hard clashes are automatically detected, soft clashes require manual review",
                            "Hard clashes are more serious, soft clashes can be ignored"
                        ],
                        correctAnswer: 1,
                        explanation: "Hard clashes represent actual physical interference where two objects occupy the same space. Soft clashes (or clearance clashes) occur when objects are closer than the specified clearance distance but don't physically intersect. Both types require resolution but through different strategies.",
                        learningObjective: "Distinguish between types of clashes and their resolution approaches",
                        relatedTopics: ["Navisworks", "Clearance Requirements", "Building Codes"],
                        difficulty: "Intermediate",
                        timeToComplete: 60,
                        practicalTip: "Set up separate clash tests for hard and soft clashes to manage resolution workflows"
                    }
                ]
            },
            "project-coordination": {
                title: "Project Coordination",
                description: "Managing multidisciplinary BIM coordination",
                difficulty: "Advanced",
                questions: [
                    {
                        id: "coord-001",
                        question: "What information should be included in a BIM Execution Plan (BEP) for effective project coordination?",
                        type: "multiple-choice",
                        options: [
                            "Only software standards and file naming conventions",
                            "Project goals, roles/responsibilities, processes, technology, and deliverables",
                            "Just meeting schedules and contact information",
                            "Model sharing procedures only"
                        ],
                        correctAnswer: 1,
                        explanation: "A comprehensive BEP should include: project BIM goals and uses, team roles and responsibilities, modeling processes and procedures, technology requirements and standards, deliverable requirements and formats, collaboration procedures, and quality control measures.",
                        learningObjective: "Understand components of effective BIM execution planning",
                        relatedTopics: ["BIM Execution Plan", "Project Planning", "Stakeholder Management"],
                        difficulty: "Advanced",
                        timeToComplete: 120,
                        practicalTip: "Customize BEP templates for different project types and sizes"
                    }
                ]
            },
            "federated-models": {
                title: "Federated Model Management",
                description: "Managing combined models from multiple disciplines",
                difficulty: "Advanced",
                questions: [
                    {
                        id: "fed-001",
                        question: "When should federated models be updated during a coordination cycle?",
                        type: "multiple-choice",
                        options: [
                            "Daily, to ensure latest information",
                            "Weekly, following a standard schedule",
                            "At specific milestones aligned with coordination meetings",
                            "Only when major design changes occur"
                        ],
                        correctAnswer: 2,
                        explanation: "Federated model updates should align with coordination meetings and project milestones to ensure all disciplines review coordinated information together. This prevents confusion from multiple versions and ensures coordinated decision-making.",
                        learningObjective: "Understand timing and coordination of model federation",
                        relatedTopics: ["Model Coordination", "Project Scheduling", "Version Control"],
                        difficulty: "Advanced",
                        timeToComplete: 75,
                        practicalTip: "Establish clear deadlines for model submissions before federation"
                    }
                ]
            },
            "intermediate-modeling": {
                title: "Intermediate Modeling Techniques",
                description: "Advanced modeling workflows and structural elements",
                difficulty: "Intermediate",
                questions: [
                    {
                        id: "int-mod-001",
                        question: "Anda ingin membuat kolom beton dari Level 1 sampai Level 3. Urutan langkah yang benar adalah…",
                        type: "multiple-choice",
                        options: [
                            "Architecture → Column, Pilih Structural Column, Pilih tipe kolom yang sesuai, Atur Base Level dan Top Level",
                            "Structure → Column, Pilih Structural Column, Atur Base Level: Level 1, Top Level: Level 3, Klik di lokasi grid",
                            "Insert → Load Family → Pilih kolom beton",
                            "Annotate → Tag Column"
                        ],
                        correctAnswer: 1,
                        explanation: "The correct workflow for creating a structural column spanning multiple levels is: Structure tab → Column → Structural Column → Set Base Level and Top Level → Place at grid intersection.",
                        learningObjective: "Master multi-story column creation workflow",
                        relatedTopics: ["Structural Columns", "Multi-Level Elements", "Building Structure"],
                        difficulty: "Intermediate",
                        timeToComplete: 90
                    },
                    {
                        id: "int-mod-002",
                        question: "Untuk membuat pelat lantai beton bertulang di Level 2 dengan tebal 150 mm. Perintah yang digunakan adalah…",
                        type: "multiple-choice",
                        options: [
                            "Roof by Footprint",
                            "Floor → Structural Floor → Edit Type → Duplicate → Atur tebal 150 mm",
                            "Create → Extrusion",
                            "Massing & Site → Floor Mass"
                        ],
                        correctAnswer: 1,
                        explanation: "To create a 150mm thick reinforced concrete floor slab at Level 2, use the Floor command, select Structural Floor, duplicate the type, and set the thickness to 150mm.",
                        learningObjective: "Create structural floor slabs with specific thicknesses",
                        relatedTopics: ["Structural Floors", "Floor Types", "Slab Construction"],
                        difficulty: "Intermediate",
                        timeToComplete: 75
                    },
                    {
                        id: "int-mod-003",
                        question: "Untuk membuat pondasi telapak di bawah kolom yang sudah ada, urutan yang benar adalah…",
                        type: "multiple-choice",
                        options: [
                            "Structure → Foundation → Isolated, Pilih tipe footing yang sesuai ukuran, Klik pada kolom",
                            "Structure → Wall Foundation, Pilih tipe footing, Klik pada kolom",
                            "Insert → Load Family pondasi, Model In-Place",
                            "Structure → Slab Foundation, Pilih ukuran, Sketch area"
                        ],
                        correctAnswer: 0,
                        explanation: "To create isolated footings under existing columns: Structure tab → Foundation → Isolated → Select appropriate footing type → Click on the column to place it.",
                        learningObjective: "Place isolated footings under structural columns",
                        relatedTopics: ["Foundation Design", "Isolated Footings", "Structural Connections"],
                        difficulty: "Intermediate",
                        timeToComplete: 80
                    }
                ]
            }
        }
    },

    "BIM Manager": {
        categories: {
            "strategic-implementation": {
                title: "Strategic Implementation",
                description: "Organizational BIM strategy and implementation",
                difficulty: "Expert",
                questions: [
                    {
                        id: "strat-001",
                        question: "What is the most critical factor for successful organizational BIM implementation?",
                        type: "multiple-choice",
                        options: [
                            "Having the latest software and hardware",
                            "Leadership commitment and change management",
                            "Hiring experienced BIM specialists",
                            "Following industry best practices exactly"
                        ],
                        correctAnswer: 1,
                        explanation: "While technology and expertise are important, leadership commitment and effective change management are the most critical factors. BIM implementation requires significant organizational change, process modifications, and cultural shifts that require strong leadership support and systematic change management.",
                        learningObjective: "Identify critical success factors for BIM implementation",
                        relatedTopics: ["Change Management", "Leadership", "Organizational Development"],
                        difficulty: "Expert",
                        timeToComplete: 120,
                        caseStudy: "Multi-office architectural firm BIM transformation",
                        practicalTip: "Secure executive sponsorship before beginning any major BIM initiative"
                    },
                    {
                        id: "strat-002",
                        question: "How should ROI for BIM implementation be measured and communicated to executives?",
                        type: "essay",
                        prompt: "Describe a comprehensive approach to measuring and communicating BIM ROI to executive stakeholders, including specific metrics and timeline considerations.",
                        rubric: {
                            "Quantitative Metrics": "Identifies measurable financial benefits (cost savings, revenue increases)",
                            "Qualitative Benefits": "Recognizes intangible benefits (quality improvements, client satisfaction)",
                            "Timeline Considerations": "Understands short-term costs vs. long-term benefits",
                            "Communication Strategy": "Proposes effective executive communication approach",
                            "Implementation Planning": "Shows understanding of measurement implementation"
                        },
                        learningObjective: "Develop business case and measurement strategies for BIM",
                        relatedTopics: ["ROI Analysis", "Executive Communication", "Performance Measurement"],
                        difficulty: "Expert",
                        timeToComplete: 180,
                        resources: ["BIM ROI Templates", "Industry Benchmarking Data"]
                    }
                ]
            },
            "enterprise-standards": {
                title: "Enterprise Standards",
                description: "Developing organization-wide BIM standards",
                difficulty: "Expert",
                questions: [
                    {
                        id: "ent-001",
                        question: "What approach should be taken when developing BIM standards for a multi-office, international organization?",
                        type: "multiple-choice",
                        options: [
                            "Apply the same standards globally without modification",
                            "Let each office develop their own standards independently",
                            "Create core global standards with local adaptations for regulations and practices",
                            "Adopt the standards of the largest office organization-wide"
                        ],
                        correctAnswer: 2,
                        explanation: "The most effective approach balances consistency with local requirements. Core global standards ensure interoperability and knowledge sharing, while local adaptations accommodate different building codes, practices, and regulatory requirements in each region.",
                        learningObjective: "Balance global consistency with local requirements in standards development",
                        relatedTopics: ["Global Standards", "Local Adaptation", "Regulatory Compliance"],
                        difficulty: "Expert",
                        timeToComplete: 120,
                        scenario: "International engineering firm with offices in US, Europe, and Asia"
                    }
                ]
            },
            "technology-leadership": {
                title: "Technology Leadership",
                description: "Leading technology adoption and innovation",
                difficulty: "Expert",
                questions: [
                    {
                        id: "tech-001",
                        question: "How should emerging technologies (AI, IoT, Digital Twins) be evaluated for integration into existing BIM workflows?",
                        type: "essay",
                        prompt: "Develop a framework for evaluating and integrating emerging technologies into established BIM workflows, considering both opportunities and risks.",
                        rubric: {
                            "Evaluation Criteria": "Establishes clear criteria for technology assessment",
                            "Risk Assessment": "Identifies and addresses potential risks",
                            "Integration Strategy": "Proposes practical integration approach",
                            "Change Management": "Considers organizational impact and adoption",
                            "Future Proofing": "Ensures scalability and flexibility"
                        },
                        learningObjective: "Develop strategic technology evaluation and adoption frameworks",
                        relatedTopics: ["Technology Innovation", "Risk Management", "Strategic Planning"],
                        difficulty: "Expert",
                        timeToComplete: 240,
                        resources: ["Technology Trend Reports", "Innovation Frameworks"]
                    }
                ]
            },
            "advanced-modeling": {
                title: "Advanced Modeling & Documentation",
                description: "Expert-level modeling techniques and construction documentation",
                difficulty: "Advanced",
                questions: [
                    {
                        id: "adv-mod-001",
                        question: "Anda ingin mengekspor model Revit ke format IFC untuk dibuka di software lain. Menu yang digunakan adalah…",
                        type: "multiple-choice",
                        options: [
                            "File → Export → CAD Formats",
                            "File → Export → IFC",
                            "File → Save As → IFC",
                            "Manage → IFC Options"
                        ],
                        correctAnswer: 1,
                        explanation: "To export a Revit model to IFC format for use in other BIM software: File → Export → IFC. This creates an open-standard file that can be imported by various BIM applications.",
                        learningObjective: "Master IFC export workflows for interoperability",
                        relatedTopics: ["IFC Export", "Model Exchange", "Interoperability"],
                        difficulty: "Advanced",
                        timeToComplete: 90
                    },
                    {
                        id: "adv-mod-002",
                        question: "Untuk menghitung volume beton yang digunakan dalam pelat lantai, Anda sebaiknya membuat:",
                        type: "multiple-choice",
                        options: [
                            "Door Schedule",
                            "Floor Schedule",
                            "Material Takeoff – Floors",
                            "Generic Model Schedule"
                        ],
                        correctAnswer: 2,
                        explanation: "Material Takeoff schedules are specifically designed to calculate quantities of materials like concrete volume in floor slabs. They provide accurate measurements for cost estimation and material ordering.",
                        learningObjective: "Create material takeoffs for quantity calculations",
                        relatedTopics: ["Material Takeoff", "Quantity Surveying", "Cost Estimation"],
                        difficulty: "Advanced",
                        timeToComplete: 120
                    },
                    {
                        id: "adv-mod-003",
                        question: "Anda ingin membuat layout gambar kerja lengkap (denah, potongan, jadwal material) untuk dicetak. Tool apa yang Anda gunakan?",
                        type: "multiple-choice",
                        options: [
                            "View Template",
                            "Titleblock",
                            "Sheet",
                            "Annotation Symbol"
                        ],
                        correctAnswer: 2,
                        explanation: "Sheets are used to create complete drawing sets containing floor plans, sections, elevations, and schedules for printing and documentation. They organize all views and annotations into formatted drawing sheets.",
                        learningObjective: "Create comprehensive construction document sets",
                        relatedTopics: ["Construction Documents", "Drawing Sets", "Sheet Organization"],
                        difficulty: "Advanced",
                        timeToComplete: 150
                    }
                ]
            }
        }
    }
};

// Adaptive difficulty system
const adaptiveDifficultySystem = {
    adjustDifficulty: function (userPerformance, currentLevel) {
        const avgScore = userPerformance.reduce((a, b) => a + b, 0) / userPerformance.length;

        if (avgScore >= 90) {
            return this.increaseDifficulty(currentLevel);
        } else if (avgScore < 70) {
            return this.decreaseDifficulty(currentLevel);
        }
        return currentLevel;
    },

    increaseDifficulty: function (currentLevel) {
        const levels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
        const currentIndex = levels.indexOf(currentLevel);
        return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : currentLevel;
    },

    decreaseDifficulty: function (currentLevel) {
        const levels = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
        const currentIndex = levels.indexOf(currentLevel);
        return currentIndex > 0 ? levels[currentIndex - 1] : currentLevel;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { enhancedPracticeQuestions, adaptiveDifficultySystem };
} else {
    window.enhancedPracticeQuestions = enhancedPracticeQuestions;
    window.adaptiveDifficultySystem = adaptiveDifficultySystem;
}
