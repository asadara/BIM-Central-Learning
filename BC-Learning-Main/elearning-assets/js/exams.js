document.addEventListener('DOMContentLoaded', function () {
    hydrateExamStateFromHistory();
    loadAvailableExams();
    setupEventListeners();
    initializeProctoring();
});

const examData = [
    {
        id: 'bim-mindset-theory-exam',
        title: 'BIM Mindset Theory Exam',
        category: 'bim-mindset',
        level: 'beginner',
        requiredLevel: 'BIM Modeller',
        duration: 30,
        questionCount: 10,
        passingScore: 80,
        prerequisites: ['bim-mindset-quiz', 'bim-mindset-practice'],
        description: 'Ujian teori non-software tentang BIM sebagai sistem manajemen informasi, status, versi, otoritas, dan keputusan.',
        syllabus: [
            'BIM sebagai manajemen informasi',
            'Status dan versi informasi',
            'Sumber informasi resmi',
            'Risiko salah pakai informasi',
            'Single source of truth'
        ],
        attempts: 0,
        maxAttempts: 3,
        retakePeriod: 7,
        lastAttempt: null,
        certification: {
            title: 'BIM Mindset Theory',
            issuer: 'BC Learning Academy',
            validFor: 24
        }
    },
    {
        id: 'bim-governance-theory-exam',
        title: 'BIM Governance Theory Exam',
        category: 'bim-governance',
        level: 'intermediate',
        requiredLevel: 'BIM Coordinator',
        duration: 35,
        questionCount: 10,
        passingScore: 80,
        prerequisites: ['bim-governance-quiz', 'bim-governance-practice'],
        description: 'Ujian teori non-software tentang authority, responsibility, decision gate, quality gate, dan audit trail.',
        syllabus: [
            'Responsibility dan authority',
            'Decision gate',
            'Quality gate',
            'Kontrol status dan versi',
            'Audit trail dan risiko keputusan'
        ],
        attempts: 0,
        maxAttempts: 3,
        retakePeriod: 7,
        lastAttempt: null,
        certification: {
            title: 'BIM Governance Theory',
            issuer: 'BC Learning Academy',
            validFor: 24
        }
    },
    {
        id: 'bim-delivery-workflow-theory-exam',
        title: 'BIM Delivery Workflow Theory Exam',
        category: 'delivery-workflow',
        level: 'intermediate',
        requiredLevel: 'BIM Coordinator',
        duration: 35,
        questionCount: 10,
        passingScore: 80,
        prerequisites: ['bim-delivery-workflow-quiz', 'delivery-workflow-practice'],
        description: 'Ujian teori non-software tentang alur delivery informasi BIM dari kebutuhan hingga penggunaan di proyek.',
        syllabus: [
            'Kebutuhan informasi',
            'Produksi model terarah',
            'Koordinasi lintas disiplin',
            'Validasi fit-for-purpose',
            'Rilis dan penggunaan informasi'
        ],
        attempts: 0,
        maxAttempts: 3,
        retakePeriod: 7,
        lastAttempt: null,
        certification: {
            title: 'BIM Delivery Workflow Theory',
            issuer: 'BC Learning Academy',
            validFor: 24
        }
    },
    {
        id: 'autocad-certification',
        title: 'AutoCAD Certified User Exam',
        category: 'autocad',
        level: 'beginner',
        requiredLevel: 'BIM Modeller',
        duration: 90,
        questionCount: 30,
        passingScore: 75,
        prerequisites: ['autocad-basics-course', 'autocad-practice-80'],
        description: 'Official AutoCAD certification exam covering 2D drafting, editing, and basic 3D modeling.',
        syllabus: [
            'Drawing and editing commands',
            'Layers and object properties',
            'Dimensioning and annotation',
            'Plotting and layouts',
            'Basic 3D modeling'
        ],
        attempts: 0,
        maxAttempts: 3,
        retakePeriod: 7,
        lastAttempt: null,
        certification: {
            title: 'AutoCAD Certified User',
            issuer: 'BC Learning Academy',
            validFor: 24
        }
    },
    {
        id: 'revit-architecture-exam',
        title: 'Revit Architecture Professional Exam',
        category: 'revit',
        level: 'intermediate',
        requiredLevel: 'BIM Coordinator',
        duration: 120,
        questionCount: 40,
        passingScore: 80,
        prerequisites: ['revit-basics-course', 'revit-advanced-course', 'bim-coordination-course'],
        description: 'Advanced Revit Architecture exam for BIM coordination professionals.',
        syllabus: [
            'Advanced family creation',
            'Project coordination workflows',
            'Clash detection and resolution',
            'Construction documentation',
            'BIM standards and protocols'
        ],
        attempts: 0,
        maxAttempts: 2,
        retakePeriod: 14,
        lastAttempt: null,
        certification: {
            title: 'Revit Architecture Professional',
            issuer: 'BC Learning Academy',
            validFor: 36
        }
    },
    {
        id: 'bim-manager-certification',
        title: 'BIM Manager Certification Exam',
        category: 'general',
        level: 'advanced',
        requiredLevel: 'BIM Manager',
        duration: 180,
        questionCount: 50,
        passingScore: 85,
        prerequisites: ['bim-strategy-course', 'project-management-course', 'leadership-training'],
        description: 'Comprehensive BIM management certification for senior professionals.',
        syllabus: [
            'BIM implementation strategy',
            'Team leadership and training',
            'Quality assurance processes',
            'Technology evaluation',
            'Client relationship management',
            'ROI analysis and reporting'
        ],
        attempts: 0,
        maxAttempts: 2,
        retakePeriod: 30,
        lastAttempt: null,
        certification: {
            title: 'Certified BIM Manager',
            issuer: 'BC Learning Academy',
            validFor: 60
        }
    }
];

const examQuestions = {
    'bim-mindset-theory-exam': [
        {
            id: 'mindset-exam-001',
            question: 'Apa definisi BIM yang paling tepat untuk konteks pengambilan keputusan proyek?',
            type: 'multiple-choice',
            options: [
                'Metode membuat model 3D yang lebih realistis',
                'Sistem untuk mengelola informasi proyek agar keputusan memakai data yang sah dan terlacak',
                'Software pengganti koordinasi proyek',
                'Cara mempercepat gambar kerja tanpa proses approval'
            ],
            correct: 1,
            category: 'bim-mindset',
            difficulty: 'easy',
            explanation: 'BIM menekankan pengelolaan informasi proyek, termasuk status, versi, otoritas, dan jejak keputusan.'
        },
        {
            id: 'mindset-exam-002',
            question: 'Informasi yang belum memiliki status approved sebaiknya diperlakukan sebagai...',
            type: 'multiple-choice',
            options: [
                'Informasi final jika sudah terlihat lengkap',
                'Referensi kerja terbatas yang belum menjadi dasar keputusan resmi',
                'Informasi yang otomatis boleh dipakai site',
                'Informasi yang tidak perlu dicek lagi'
            ],
            correct: 1,
            category: 'bim-mindset',
            difficulty: 'easy',
            explanation: 'Status approved atau published menunjukkan informasi sudah mendapat otorisasi penggunaan.'
        },
        {
            id: 'mindset-exam-003',
            question: 'Apa risiko utama dari budaya kerja yang mengandalkan file kiriman chat sebagai sumber keputusan?',
            type: 'multiple-choice',
            options: [
                'File menjadi terlalu kecil',
                'Status, versi, dan otoritas informasi tidak jelas',
                'Model tidak bisa dibuka',
                'Semua review menjadi otomatis'
            ],
            correct: 1,
            category: 'bim-mindset',
            difficulty: 'medium',
            explanation: 'Pengiriman informal tidak menjamin kontrol versi, status, atau approval.'
        },
        {
            id: 'mindset-exam-004',
            question: 'Single source of truth paling tepat dipahami sebagai...',
            type: 'multiple-choice',
            options: [
                'Satu file model untuk semua kebutuhan',
                'Satu sumber rujukan resmi untuk status, versi, dan jejak informasi',
                'Satu modeller yang menjadi sumber semua data',
                'Satu software wajib untuk seluruh proyek'
            ],
            correct: 1,
            category: 'bim-mindset',
            difficulty: 'medium',
            explanation: 'Single source of truth adalah mekanisme rujukan resmi, bukan selalu satu file atau satu orang.'
        },
        {
            id: 'mindset-exam-005',
            question: 'Indikator kuat bahwa BIM sudah dipahami sebagai mindset adalah...',
            type: 'multiple-choice',
            options: [
                'Semua orang bisa membuat family kompleks',
                'Tim konsisten bertanya status, versi, otoritas, dan tujuan informasi sebelum memakai data',
                'Rendering proyek semakin banyak',
                'Semua koordinasi dilakukan tanpa catatan'
            ],
            correct: 1,
            category: 'bim-mindset',
            difficulty: 'medium',
            explanation: 'Mindset BIM terlihat dari disiplin memakai informasi yang sah dan terlacak.'
        },
        {
            id: 'mindset-exam-006',
            question: 'Mengapa BIM tidak boleh dipahami hanya sebagai 3D?',
            type: 'multiple-choice',
            options: [
                'Karena 3D tidak pernah berguna',
                'Karena 3D adalah wadah, sedangkan nilai utamanya ada pada informasi dan proses penggunaannya',
                'Karena BIM hanya untuk dokumen 2D',
                'Karena semua proyek harus tanpa model'
            ],
            correct: 1,
            category: 'bim-mindset',
            difficulty: 'easy',
            explanation: 'Model 3D adalah salah satu media informasi. Nilai BIM muncul saat informasi dikelola dan dipakai dengan benar.'
        },
        {
            id: 'mindset-exam-007',
            question: 'Keputusan procurement sebaiknya memakai informasi yang...',
            type: 'multiple-choice',
            options: [
                'Paling cepat diterima',
                'Sudah dirilis resmi, jelas versi, status, dan tujuan penggunaannya',
                'Paling detail secara visual',
                'Paling sering dibagikan di grup'
            ],
            correct: 1,
            category: 'bim-mindset',
            difficulty: 'medium',
            explanation: 'Procurement berdampak biaya dan waktu, sehingga harus berbasis informasi resmi.'
        },
        {
            id: 'mindset-exam-008',
            question: 'Jika informasi terlihat lengkap tetapi tidak jelas sumber resminya, tindakan terbaik adalah...',
            type: 'multiple-choice',
            options: [
                'Langsung dipakai agar tidak terlambat',
                'Meminta klarifikasi sumber, status, versi, dan otoritas sebelum dipakai',
                'Mengubah sendiri status file',
                'Membuat salinan baru lalu dipakai'
            ],
            correct: 1,
            category: 'bim-mindset',
            difficulty: 'medium',
            explanation: 'Kelengkapan visual tidak menggantikan validasi sumber dan status informasi.'
        },
        {
            id: 'mindset-exam-009',
            question: 'Apa yang paling dilindungi oleh disiplin informasi BIM?',
            type: 'multiple-choice',
            options: [
                'Tampilan model',
                'Keputusan proyek dari risiko salah informasi',
                'Jumlah software',
                'Kecepatan membuat render'
            ],
            correct: 1,
            category: 'bim-mindset',
            difficulty: 'easy',
            explanation: 'Disiplin informasi BIM menurunkan risiko keputusan salah akibat data yang tidak sah atau tidak mutakhir.'
        },
        {
            id: 'mindset-exam-010',
            question: 'Dalam budaya BIM yang sehat, pertanyaan pertama sebelum memakai data adalah...',
            type: 'multiple-choice',
            options: [
                'Apakah file ini bagus untuk presentasi?',
                'Apakah informasi ini boleh dipakai untuk tujuan keputusan saat ini?',
                'Apakah model ini paling detail?',
                'Apakah file ini dibuat dengan software terbaru?'
            ],
            correct: 1,
            category: 'bim-mindset',
            difficulty: 'easy',
            explanation: 'Kelayakan penggunaan informasi harus dikaitkan dengan tujuan keputusan, status, dan otoritas rilis.'
        }
    ],
    'bim-governance-theory-exam': [
        {
            id: 'governance-exam-001',
            question: 'BIM Governance paling tepat berfungsi untuk...',
            type: 'multiple-choice',
            options: [
                'Mengatur warna model',
                'Menjaga keputusan proyek berbasis informasi sah, berotoritas, dan terlacak',
                'Menghapus kebutuhan review',
                'Membuat semua orang memakai software yang sama'
            ],
            correct: 1,
            category: 'bim-governance',
            difficulty: 'easy',
            explanation: 'Governance mengatur bagaimana informasi dibuat, dicek, disetujui, dirilis, dan dipakai.'
        },
        {
            id: 'governance-exam-002',
            question: 'Authority dalam manajemen informasi berarti...',
            type: 'multiple-choice',
            options: [
                'Pihak yang paling cepat membuat file',
                'Pihak yang berwenang mengesahkan atau mengizinkan penggunaan informasi',
                'Pihak yang memiliki komputer paling kuat',
                'Pihak yang selalu melakukan modelling'
            ],
            correct: 1,
            category: 'bim-governance',
            difficulty: 'easy',
            explanation: 'Authority terkait hak pengesahan atau izin penggunaan, bukan sekadar pembuat informasi.'
        },
        {
            id: 'governance-exam-003',
            question: 'Decision gate sebaiknya ditempatkan pada titik ketika...',
            type: 'multiple-choice',
            options: [
                'Tim butuh keputusan untuk lanjut ke tahap berikutnya',
                'File sudah terlalu banyak',
                'Software perlu diperbarui',
                'Meeting sudah selesai'
            ],
            correct: 0,
            category: 'bim-governance',
            difficulty: 'medium',
            explanation: 'Decision gate memastikan informasi cukup layak sebelum keputusan tahap berikutnya diambil.'
        },
        {
            id: 'governance-exam-004',
            question: 'Quality gate yang baik menilai informasi berdasarkan...',
            type: 'multiple-choice',
            options: [
                'Kesesuaian terhadap tujuan, standar, kelengkapan, status, dan traceability',
                'Jumlah objek 3D',
                'Kualitas rendering',
                'Ukuran file'
            ],
            correct: 0,
            category: 'bim-governance',
            difficulty: 'medium',
            explanation: 'Quality gate menilai fit-for-purpose dan kelayakan penggunaan.'
        },
        {
            id: 'governance-exam-005',
            question: 'Risiko terbesar jika responsibility dan authority tidak dibedakan adalah...',
            type: 'multiple-choice',
            options: [
                'File menjadi terlalu rapi',
                'Informasi dapat dipakai tanpa pengesahan yang tepat',
                'Model menjadi tidak berwarna',
                'Software tidak bisa sinkron'
            ],
            correct: 1,
            category: 'bim-governance',
            difficulty: 'medium',
            explanation: 'Pembuat informasi belum tentu berwenang merilisnya sebagai dasar keputusan.'
        },
        {
            id: 'governance-exam-006',
            question: 'Audit trail dibutuhkan agar proyek dapat...',
            type: 'multiple-choice',
            options: [
                'Melihat siapa mengubah apa, kapan, mengapa, dan dengan status apa',
                'Menyembunyikan perubahan',
                'Menghapus semua versi lama tanpa catatan',
                'Mengurangi kebutuhan approval'
            ],
            correct: 0,
            category: 'bim-governance',
            difficulty: 'easy',
            explanation: 'Audit trail membuat perubahan dan keputusan dapat ditelusuri.'
        },
        {
            id: 'governance-exam-007',
            question: 'Jika status file berbeda antara folder kerja dan folder published, yang harus dipakai untuk keputusan adalah...',
            type: 'multiple-choice',
            options: [
                'Folder kerja karena paling baru diedit',
                'Sumber published/resmi sesuai status dan tujuan rilis',
                'File yang paling kecil',
                'File yang paling mudah dibuka'
            ],
            correct: 1,
            category: 'bim-governance',
            difficulty: 'medium',
            explanation: 'Folder published atau sumber resmi adalah rujukan untuk penggunaan informasi yang sudah disahkan.'
        },
        {
            id: 'governance-exam-008',
            question: 'Governance yang baik membantu tim site karena...',
            type: 'multiple-choice',
            options: [
                'Site tidak perlu membaca dokumen',
                'Site tahu informasi mana yang boleh dipakai dan mana yang masih koordinasi',
                'Semua perubahan dapat dilakukan langsung di lapangan',
                'Semua model otomatis benar'
            ],
            correct: 1,
            category: 'bim-governance',
            difficulty: 'easy',
            explanation: 'Kejelasan status membantu site menghindari instruksi berbasis informasi yang belum sah.'
        },
        {
            id: 'governance-exam-009',
            question: 'Ketika ada konflik informasi lintas disiplin, governance mengharuskan...',
            type: 'multiple-choice',
            options: [
                'Memilih informasi dari disiplin yang paling dominan',
                'Mencatat konflik, menentukan pemilik aksi, melakukan review, dan merilis keputusan resmi',
                'Menghapus salah satu model',
                'Menunggu sampai proyek selesai'
            ],
            correct: 1,
            category: 'bim-governance',
            difficulty: 'medium',
            explanation: 'Konflik harus diselesaikan melalui proses yang jelas dan terdokumentasi.'
        },
        {
            id: 'governance-exam-010',
            question: 'Kontrol versi dalam BIM Governance penting karena...',
            type: 'multiple-choice',
            options: [
                'Mencegah penggunaan informasi lama untuk keputusan baru',
                'Membuat nama file lebih panjang',
                'Mengurangi kebutuhan komunikasi',
                'Mengganti koordinasi teknis'
            ],
            correct: 0,
            category: 'bim-governance',
            difficulty: 'easy',
            explanation: 'Kontrol versi mencegah keputusan memakai informasi yang sudah diganti atau belum disahkan.'
        }
    ],
    'bim-delivery-workflow-theory-exam': [
        {
            id: 'workflow-exam-001',
            question: 'BIM Delivery Workflow dimulai dari...',
            type: 'multiple-choice',
            options: [
                'Membuat model secepat mungkin',
                'Menentukan kebutuhan informasi dan tujuan penggunaannya',
                'Melakukan render',
                'Menggabungkan semua file'
            ],
            correct: 1,
            category: 'delivery-workflow',
            difficulty: 'easy',
            explanation: 'Delivery workflow harus dimulai dari kebutuhan informasi agar produksi terarah.'
        },
        {
            id: 'workflow-exam-002',
            question: 'Produksi informasi yang baik adalah produksi yang...',
            type: 'multiple-choice',
            options: [
                'Paling detail tanpa batas',
                'Sesuai kebutuhan, standar, milestone, dan level informasi yang diminta',
                'Selalu memakai semua fitur software',
                'Tidak perlu divalidasi'
            ],
            correct: 1,
            category: 'delivery-workflow',
            difficulty: 'easy',
            explanation: 'Produksi harus menjawab kebutuhan delivery, bukan sekadar membuat model detail.'
        },
        {
            id: 'workflow-exam-003',
            question: 'Koordinasi lintas disiplin bertujuan untuk...',
            type: 'multiple-choice',
            options: [
                'Mencari pihak yang salah',
                'Menyelaraskan informasi dan menyelesaikan konflik sebelum rilis atau keputusan',
                'Membuat semua file menjadi satu',
                'Menghapus semua komentar'
            ],
            correct: 1,
            category: 'delivery-workflow',
            difficulty: 'easy',
            explanation: 'Koordinasi menyelesaikan konflik informasi dan memastikan input siap untuk tahap berikutnya.'
        },
        {
            id: 'workflow-exam-004',
            question: 'Validasi fit-for-purpose berarti informasi dicek berdasarkan...',
            type: 'multiple-choice',
            options: [
                'Apakah informasi layak untuk tujuan penggunaan tertentu',
                'Apakah model terlihat menarik',
                'Apakah ukuran file kecil',
                'Apakah semua objek memiliki material'
            ],
            correct: 0,
            category: 'delivery-workflow',
            difficulty: 'medium',
            explanation: 'Validasi selalu dikaitkan dengan tujuan penggunaan informasi.'
        },
        {
            id: 'workflow-exam-005',
            question: 'Rilis informasi menandakan bahwa...',
            type: 'multiple-choice',
            options: [
                'Model sudah selesai selamanya',
                'Informasi sudah diberi status dan izin penggunaan sesuai tujuan rilis',
                'Semua masalah proyek sudah selesai',
                'Tidak perlu ada audit trail'
            ],
            correct: 1,
            category: 'delivery-workflow',
            difficulty: 'medium',
            explanation: 'Rilis memberikan konteks penggunaan: untuk review, koordinasi, procurement, konstruksi, atau record.'
        },
        {
            id: 'workflow-exam-006',
            question: 'Apa akibat umum jika kebutuhan informasi tidak didefinisikan di awal?',
            type: 'multiple-choice',
            options: [
                'Output dapat lengkap secara visual tetapi tidak menjawab keputusan proyek',
                'Semua keputusan menjadi lebih cepat',
                'Koordinasi tidak diperlukan',
                'Quality gate otomatis lulus'
            ],
            correct: 0,
            category: 'delivery-workflow',
            difficulty: 'medium',
            explanation: 'Tanpa kebutuhan, output mudah salah sasaran walaupun terlihat detail.'
        },
        {
            id: 'workflow-exam-007',
            question: 'Delivery workflow yang baik menghubungkan...',
            type: 'multiple-choice',
            options: [
                'Kebutuhan, produksi, koordinasi, validasi, rilis, dan penggunaan informasi',
                'Software, hardware, dan rendering',
                'Model, warna, dan animasi',
                'Folder pribadi setiap modeller'
            ],
            correct: 0,
            category: 'delivery-workflow',
            difficulty: 'easy',
            explanation: 'Workflow adalah alur end-to-end informasi, bukan daftar software.'
        },
        {
            id: 'workflow-exam-008',
            question: 'Dalam tahap koordinasi, isu sebaiknya diprioritaskan berdasarkan...',
            type: 'multiple-choice',
            options: [
                'Urutan siapa yang menemukan',
                'Dampak terhadap keputusan, konstruksi, biaya, waktu, dan keselamatan',
                'Warna clash',
                'Ukuran file model'
            ],
            correct: 1,
            category: 'delivery-workflow',
            difficulty: 'medium',
            explanation: 'Tidak semua isu bernilai sama. Prioritas harus mengikuti dampak proyek.'
        },
        {
            id: 'workflow-exam-009',
            question: 'Informasi as-built atau record sebaiknya berbeda dari informasi koordinasi karena...',
            type: 'multiple-choice',
            options: [
                'Tujuan penggunaan dan status rilisnya berbeda',
                'Harus selalu dibuat dengan software lain',
                'Tidak perlu validasi',
                'Tidak perlu riwayat perubahan'
            ],
            correct: 0,
            category: 'delivery-workflow',
            difficulty: 'medium',
            explanation: 'Setiap jenis delivery punya tujuan, standar, dan status penggunaan yang berbeda.'
        },
        {
            id: 'workflow-exam-010',
            question: 'Jika workflow dilompati dari produksi langsung ke penggunaan lapangan, risiko terbesar adalah...',
            type: 'multiple-choice',
            options: [
                'Informasi belum terkoordinasi, belum tervalidasi, atau belum sah untuk dipakai',
                'File menjadi terlalu kecil',
                'Rendering tidak tersedia',
                'Software berjalan lebih cepat'
            ],
            correct: 0,
            category: 'delivery-workflow',
            difficulty: 'medium',
            explanation: 'Tanpa koordinasi, validasi, dan rilis resmi, penggunaan lapangan berisiko memakai informasi yang belum layak.'
        }
    ],
    'autocad-certification': [
        {
            id: 1,
            question: 'What is the primary purpose of layers in AutoCAD?',
            type: 'multiple-choice',
            options: [
                'To organize drawing objects by function or appearance',
                'To create 3D objects',
                'To add text annotations',
                'To set printing parameters'
            ],
            correct: 0,
            category: 'layers',
            difficulty: 'easy',
            explanation: 'Layers organize drawing objects logically by function, discipline, visibility, or appearance.'
        },
        {
            id: 2,
            question: 'Which command creates a parallel copy of an object at a specified distance?',
            type: 'multiple-choice',
            options: ['COPY', 'MOVE', 'OFFSET', 'MIRROR'],
            correct: 2,
            category: 'editing',
            difficulty: 'easy',
            explanation: 'OFFSET creates a parallel copy at a defined distance from the source object.'
        },
        {
            id: 3,
            question: 'What is the keyboard shortcut for the CIRCLE command?',
            type: 'multiple-choice',
            options: ['CI', 'C', 'CIR', 'CIRCLE'],
            correct: 1,
            category: 'commands',
            difficulty: 'easy',
            explanation: 'The standard shortcut for the CIRCLE command is C.'
        }
    ]
};

let currentExam = null;
let currentExamQuestions = [];
let currentQuestionIndex = 0;
let examAnswers = [];
let examStartTime = null;
let examTimer = null;
let currentModalExamId = null;
let isExamReviewMode = false;
let proctoringListenersAttached = false;
let markedForReview = new Set();
let proctoring = {
    cameraActive: false,
    microphoneActive: false,
    violations: []
};

function shuffleArray(array) {
    const shuffled = [...array];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
}

function safeParse(value, fallback) {
    if (value === null || typeof value === 'undefined' || value === '') {
        return fallback;
    }

    try {
        const parsed = JSON.parse(value);
        return parsed === null ? fallback : parsed;
    } catch (error) {
        return fallback;
    }
}

function getAuthToken() {
    return localStorage.getItem('token') || '';
}

function getAuthenticatedUser() {
    return safeParse(localStorage.getItem('user'), null);
}

function getUserData() {
    return getAuthenticatedUser() || safeParse(localStorage.getItem('userData'), null);
}

function getRequestedExamId() {
    return new URLSearchParams(window.location.search).get('targetExam');
}

function getReadinessDashboard() {
    if (window.LearningReadiness && typeof window.LearningReadiness.getReadinessDashboard === 'function') {
        return window.LearningReadiness.getReadinessDashboard();
    }

    return {
        userLevel: getUserData()?.level || 'BIM Modeller',
        exams: [],
        practiceHistory: [],
        overallReadiness: 0,
        readyCount: 0,
        almostReadyCount: 0,
        nextExam: null
    };
}

function getExamHistory() {
    if (window.LearningReadiness && typeof window.LearningReadiness.getExamHistory === 'function') {
        return window.LearningReadiness.getExamHistory();
    }

    const history = safeParse(localStorage.getItem('examHistory'), []);
    return Array.isArray(history) ? history : [];
}

function getExamBlueprint(examId) {
    return window.LearningReadiness?.EXAM_BLUEPRINTS?.[examId] || null;
}

function getLocalPracticeHistory() {
    const userData = safeParse(localStorage.getItem('userData'), {});
    return Array.isArray(userData.practiceHistory) ? userData.practiceHistory : [];
}

function getPracticeCategoriesForAttempt(attempt) {
    if (Array.isArray(attempt?.categories) && attempt.categories.length) {
        return attempt.categories;
    }

    if (typeof attempt?.category === 'string' && attempt.category) {
        return [attempt.category];
    }

    if (typeof attempt?.sourceCategory === 'string' && attempt.sourceCategory) {
        return [attempt.sourceCategory];
    }

    return [];
}

function hasPracticeAttempt(category, minScore = 0) {
    return getLocalPracticeHistory().some((attempt) => {
        const categories = getPracticeCategoriesForAttempt(attempt);
        return categories.includes(category) && Number(attempt.score || 0) >= minScore;
    });
}

function hasCompletedLearningMarker(matchers) {
    const matcherList = Array.isArray(matchers) ? matchers : [matchers];

    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index) || '';
        if (!key.startsWith('bcl_completed_') && !key.startsWith('bcl_video_completed_') && !key.startsWith('bcl_page_completed_')) {
            continue;
        }

        const value = String(localStorage.getItem(key) || '');
        const haystack = `${key} ${value}`.toLowerCase();

        if (matcherList.some((matcher) => haystack.includes(String(matcher || '').toLowerCase()))) {
            return true;
        }
    }

    return false;
}

function hydrateExamStateFromHistory() {
    const history = getExamHistory();

    examData.forEach(exam => {
        const attempts = history.filter(entry => entry.examId === exam.id);
        const lastAttempt = attempts.length ? attempts[attempts.length - 1] : null;

        exam.attempts = attempts.length;
        exam.lastAttempt = lastAttempt ? (lastAttempt.attemptedAt || lastAttempt.savedAt || null) : null;
        exam.lastScore = lastAttempt ? Number(lastAttempt.percentage || 0) : null;
        exam.passCount = attempts.filter(entry => entry.passed).length;
    });
}

function getExamAttemptStats(examId) {
    const attempts = getExamHistory().filter(entry => entry.examId === examId);
    if (!attempts.length) {
        return {
            attempts: 0,
            passRate: 0,
            averageScore: 0,
            lastScore: null,
            lastAttemptAt: null
        };
    }

    const averageScore = Math.round(
        attempts.reduce((sum, entry) => sum + Number(entry.percentage || 0), 0) / attempts.length
    );

    return {
        attempts: attempts.length,
        passRate: Math.round((attempts.filter(entry => entry.passed).length / attempts.length) * 100),
        averageScore,
        lastScore: Number(attempts[attempts.length - 1].percentage || 0),
        lastAttemptAt: attempts[attempts.length - 1].attemptedAt || attempts[attempts.length - 1].savedAt || null
    };
}

function normalizeEnhancedQuestion(question, index, exam) {
    if (Array.isArray(question.options) && question.options.length >= 2) {
        return {
            id: question.id || `${exam.id}-sample-${index + 1}`,
            question: question.question || question.scenario || `Sample question ${index + 1}`,
            type: 'multiple-choice',
            options: question.options,
            correct: typeof question.correctAnswer === 'number'
                ? question.correctAnswer
                : typeof question.correct === 'number'
                    ? question.correct
                    : 0,
            category: question.category || exam.category || 'general',
            difficulty: question.difficulty || 'intermediate',
            explanation: question.explanation || 'This item is aligned to the exam blueprint sample content.'
        };
    }

    return null;
}

function buildSyllabusFallbackQuestions(exam) {
    const syllabus = Array.isArray(exam.syllabus) && exam.syllabus.length
        ? exam.syllabus
        : ['Core concepts', 'Workflow fundamentals', 'Quality assurance', 'Documentation'];

    return syllabus.map((topic, index) => {
        const distractors = syllabus.filter(item => item !== topic).slice(0, 3);
        while (distractors.length < 3) {
            distractors.push(`Unrelated topic ${distractors.length + 1}`);
        }

        const options = shuffleArray([topic, ...distractors]);
        return {
            id: `${exam.id}-syllabus-${index + 1}`,
            question: `Which topic is explicitly included in the ${exam.title} syllabus?`,
            type: 'multiple-choice',
            options,
            correct: options.findIndex(option => option === topic),
            category: exam.category || 'general',
            difficulty: 'intermediate',
            explanation: `${topic} is listed directly in the published syllabus for this exam.`
        };
    });
}

function getExamQuestionPool(exam) {
    const directQuestions = examQuestions[exam.id];
    if (Array.isArray(directQuestions) && directQuestions.length) {
        return directQuestions;
    }

    const sampleQuestions = (window.enhancedExamDatabase?.[exam.requiredLevel]?.certificationExams || [])
        .flatMap(item => item.sampleQuestions || [])
        .map((question, index) => normalizeEnhancedQuestion(question, index, exam))
        .filter(Boolean);

    if (sampleQuestions.length) {
        return sampleQuestions;
    }

    return buildSyllabusFallbackQuestions(exam);
}

function buildRuntimeQuestionSet(exam) {
    const pool = getExamQuestionPool(exam);
    if (!pool.length) {
        return [];
    }

    const runtimeQuestions = [];
    while (runtimeQuestions.length < exam.questionCount) {
        const chunk = shuffleArray(pool).map((question, index) => ({
            ...question,
            runtimeId: `${question.id}-${runtimeQuestions.length + index + 1}`
        }));
        runtimeQuestions.push(...chunk);
    }

    return runtimeQuestions.slice(0, exam.questionCount);
}

function formatCategoryLabel(category) {
    return String(category || 'general')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatDate(value) {
    if (!value) {
        return 'No attempts yet';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'No attempts yet';
    }

    return new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
}

function checkPrerequisiteCompleted(prerequisite, userData) {
    const completed = Array.isArray(userData?.completedPrerequisites)
        ? userData.completedPrerequisites
        : [];

    if (completed.includes(prerequisite)) {
        return true;
    }

    const prerequisiteRules = {
        'bim-mindset-quiz': () => hasPracticeAttempt('bim-mindset', 70),
        'bim-mindset-practice': () => hasPracticeAttempt('bim-mindset', 70),
        'bim-governance-quiz': () => hasPracticeAttempt('bim-governance', 70),
        'bim-governance-practice': () => hasPracticeAttempt('bim-governance', 70),
        'bim-delivery-workflow-quiz': () => hasPracticeAttempt('delivery-workflow', 70),
        'delivery-workflow-practice': () => hasPracticeAttempt('delivery-workflow', 70),
        'autocad-basics-course': () => hasCompletedLearningMarker(['autocad', 'acad']),
        'autocad-practice-80': () => hasPracticeAttempt('autocad', 80),
        'revit-basics-course': () => hasCompletedLearningMarker('revit'),
        'revit-advanced-course': () => hasPracticeAttempt('revit-modeling', 70) || hasPracticeAttempt('intermediate-modeling', 70),
        'bim-coordination-course': () => hasPracticeAttempt('clash-detection', 70) || hasPracticeAttempt('project-coordination', 70),
        'bim-strategy-course': () => hasPracticeAttempt('bim-fundamentals', 70),
        'project-management-course': () => hasPracticeAttempt('project-coordination', 70),
        'leadership-training': () => hasPracticeAttempt('advanced-modeling', 70)
    };

    if (typeof prerequisiteRules[prerequisite] === 'function') {
        return prerequisiteRules[prerequisite]();
    }

    return false;
}

function checkExamEligibility(exam, userData) {
    const userLevel = userData?.level || 'BIM Modeller';
    const levelOrder = ['BIM Modeller', 'BIM Coordinator', 'BIM Manager'];
    const requiredLevelIndex = levelOrder.indexOf(exam.requiredLevel);
    const userLevelIndex = levelOrder.indexOf(userLevel);

    if (userLevelIndex < requiredLevelIndex) {
        return { eligible: false, reason: 'level', required: exam.requiredLevel };
    }

    if (exam.attempts >= exam.maxAttempts) {
        return { eligible: false, reason: 'attempts', maxAttempts: exam.maxAttempts };
    }

    if (exam.lastAttempt) {
        const daysSinceAttempt = Math.floor((Date.now() - new Date(exam.lastAttempt)) / (1000 * 60 * 60 * 24));
        if (daysSinceAttempt < exam.retakePeriod) {
            return {
                eligible: false,
                reason: 'retake',
                daysRemaining: exam.retakePeriod - daysSinceAttempt
            };
        }
    }

    const missingPrerequisites = exam.prerequisites.filter(prerequisite => !checkPrerequisiteCompleted(prerequisite, userData));
    if (missingPrerequisites.length > 0) {
        return {
            eligible: false,
            reason: 'prerequisites',
            missing: missingPrerequisites
        };
    }

    return { eligible: true };
}

function buildExamViewModel(exam, userData, dashboard, requestedExamId) {
    const readiness = dashboard.exams.find(item => item.examId === exam.id) || {
        examId: exam.id,
        shortTitle: exam.title,
        status: 'locked',
        readinessScore: 0,
        accuracy: 0,
        attempts: 0,
        coverage: 0,
        recommendation: 'Complete more practice to generate readiness data.',
        recommendedPracticeMode: 'skill-drills',
        targetCategories: []
    };
    const baseEligibility = checkExamEligibility(exam, userData);
    const attemptStats = getExamAttemptStats(exam.id);

    let section = 'locked';
    if (baseEligibility.eligible && readiness.status === 'ready') {
        section = 'ready';
    } else if (baseEligibility.eligible) {
        section = 'almost-ready';
    }

    return {
        exam,
        readiness,
        baseEligibility,
        attemptStats,
        section,
        spotlight: exam.id === requestedExamId,
        practiceHref: `practice.html?targetExam=${exam.id}&view=${readiness.recommendedPracticeMode || 'skill-drills'}`
    };
}

function createExamCardMarkup(model) {
    const { exam, readiness, baseEligibility, attemptStats, section, spotlight, practiceHref } = model;
    const readinessLabel = section === 'almost-ready' ? 'Almost Ready' : section === 'ready' ? 'Ready' : 'Locked';
    let actionsMarkup = '';

    if (section === 'ready') {
        actionsMarkup = `
            <button class="exam-primary-btn" type="button" onclick="prepareExam('${exam.id}')">
                <i class="fas fa-play-circle"></i> Take Exam
            </button>
            <a class="exam-link-btn" href="${practiceHref}">
                <i class="fas fa-route"></i> Open Practice Path
            </a>
        `;
    } else if (baseEligibility.eligible) {
        actionsMarkup = `
            <a class="exam-primary-btn" href="${practiceHref}">
                <i class="fas fa-chart-line"></i> Continue Preparation
            </a>
            <button class="exam-secondary-btn" type="button" onclick="showPrerequisites('${exam.id}', 'readiness')">
                <i class="fas fa-lock"></i> View Requirements
            </button>
        `;
    } else {
        actionsMarkup = `
            <button class="exam-secondary-btn" type="button" onclick="showPrerequisites('${exam.id}', '${baseEligibility.reason || 'readiness'}')">
                <i class="fas fa-lock"></i> View Blockers
            </button>
            <a class="exam-link-btn" href="${practiceHref}">
                <i class="fas fa-wrench"></i> Open Preparation Path
            </a>
        `;
    }

    return `
        <div class="exam-path-card ${spotlight ? 'spotlight' : ''}">
            <div class="exam-panel-title">
                <h4>${exam.title}</h4>
                <span class="exam-status-pill ${section}">${readinessLabel}</span>
            </div>
            <p>${exam.description}</p>
            <div class="exam-detail-row">
                <span>Readiness Score</span>
                <strong>${readiness.readinessScore}%</strong>
            </div>
            <div class="exam-detail-row">
                <span>Measured Accuracy</span>
                <strong>${readiness.accuracy}%</strong>
            </div>
            <div class="exam-detail-row">
                <span>Coverage</span>
                <strong>${readiness.coverage}%</strong>
            </div>
            <div class="exam-detail-row">
                <span>Exam Attempts</span>
                <strong>${attemptStats.attempts}/${exam.maxAttempts}</strong>
            </div>
            <div class="exam-detail-row">
                <span>Last Exam Score</span>
                <strong>${attemptStats.lastScore === null ? '-' : `${attemptStats.lastScore}%`}</strong>
            </div>
            <div class="exam-detail-row">
                <span>Percobaan Terakhir</span>
                <strong>${formatDate(attemptStats.lastAttemptAt)}</strong>
            </div>
            <p>${baseEligibility.eligible ? readiness.recommendation : getIneligibilityMessage(baseEligibility)}</p>
            <ul class="exam-topic-list">
                ${exam.syllabus.slice(0, 4).map(topic => `<li>${topic}</li>`).join('')}
            </ul>
            <div class="exam-card-actions">
                ${actionsMarkup}
            </div>
        </div>
    `;
}

function renderExamHero(dashboard, models, requestedExamId) {
    const heroTitle = document.getElementById('exam-hero-title');
    const heroCopy = document.getElementById('exam-hero-copy');
    const heroActions = document.getElementById('exam-hero-actions');
    const heroSummary = document.getElementById('exam-hero-summary');
    const focusedModel = models.find(model => model.exam.id === requestedExamId) || null;

    if (heroTitle && heroCopy) {
        if (focusedModel) {
            heroTitle.textContent = `Jalur ujian untuk ${focusedModel.exam.title}`;
            heroCopy.textContent = `${focusedModel.readiness.recommendation} Gunakan jalur persiapan jika Anda masih membutuhkan cakupan, konsistensi, atau akurasi yang lebih baik sebelum mengikuti ujian formal.`;
        } else {
            heroTitle.textContent = 'Masuk ke sertifikasi hanya saat jalurnya sudah terukur';
            heroCopy.textContent = 'Gunakan akurasi latihan, cakupan materi, dan konsistensi Anda untuk menentukan ujian mana yang siap diambil sekarang, mana yang masih perlu persiapan, dan langkah berikutnya.';
        }
    }

    if (heroActions) {
        const linkedExam = focusedModel || models.find(model => model.section === 'ready') || models[0];
        heroActions.innerHTML = linkedExam ? `
            <a class="exam-link-btn" href="${linkedExam.practiceHref}">
                <i class="fas fa-route"></i> Buka Jalur Latihan
            </a>
            <button class="exam-primary-btn" type="button" onclick="showExamPath('${linkedExam.exam.id}')">
                <i class="fas fa-bullseye"></i> Fokus ke Ujian Ini
            </button>
        ` : '';
    }

    if (heroSummary) {
        const examHistory = getExamHistory();
        heroSummary.innerHTML = `
            <span class="exam-mini-label">Kesiapan Keseluruhan</span>
            <div class="exam-score">${dashboard.overallReadiness}%</div>
            <h3>${dashboard.nextExam ? dashboard.nextExam.shortTitle : 'Belum ada target ujian'}</h3>
            <p>${dashboard.nextExam ? dashboard.nextExam.recommendation : 'Selesaikan beberapa latihan untuk membentuk baseline kesiapan.'}</p>
            <div class="exam-summary-grid">
                <div>
                    <div class="exam-mini-label">Siap Sekarang</div>
                    <div class="exam-score" style="font-size:2.4rem;">${dashboard.readyCount}</div>
                </div>
                <div>
                    <div class="exam-mini-label">Percobaan Tersimpan</div>
                    <div class="exam-score" style="font-size:2.4rem;">${examHistory.length}</div>
                </div>
            </div>
        `;
    }
}

function renderExamOverview(dashboard) {
    const history = getExamHistory();
    const averageExamScore = history.length
        ? Math.round(history.reduce((sum, entry) => sum + Number(entry.percentage || 0), 0) / history.length)
        : 0;
    const metrics = [
        {
            label: 'Ujian Siap',
            value: dashboard.readyCount,
            caption: 'Jalur ujian yang sudah memenuhi kesiapan dan syarat operasional.'
        },
        {
            label: 'Hampir Siap',
            value: dashboard.almostReadyCount,
            caption: 'Progres sudah kuat, tetapi masih kurang pada ambang terukur.'
        },
        {
            label: 'Percobaan Latihan',
            value: dashboard.practiceHistory.length,
            caption: 'Percobaan latihan yang berkontribusi pada perhitungan kesiapan.'
        },
        {
            label: 'Rata-rata Nilai Ujian',
            value: `${averageExamScore}%`,
            caption: 'Diambil dari riwayat ujian lokal pada perangkat ini.'
        }
    ];

    const container = document.getElementById('exam-overview-metrics');
    if (!container) {
        return;
    }

    container.innerHTML = metrics.map(metric => `
        <div class="exam-metric-card">
            <div class="exam-mini-label">${metric.label}</div>
            <div class="exam-score" style="font-size:2.8rem;">${metric.value}</div>
            <div class="exam-metric-caption">${metric.caption}</div>
        </div>
    `).join('');
}

function renderExamSections(models) {
    const readyContainer = document.getElementById('exam-ready-container');
    const almostReadyContainer = document.getElementById('exam-almost-ready-container');
    const lockedContainer = document.getElementById('exam-locked-container');

    if (!readyContainer || !almostReadyContainer || !lockedContainer) {
        return;
    }

    const renderGroup = (container, items, emptyTitle, emptyCopy) => {
        container.innerHTML = items.length
            ? items.map(createExamCardMarkup).join('')
            : `
                <div class="exam-empty-card">
                    <h4>${emptyTitle}</h4>
                    <p>${emptyCopy}</p>
                </div>
            `;
    };

    renderGroup(
        readyContainer,
        models.filter(model => model.section === 'ready'),
        'Belum ada ujian yang benar-benar siap',
        'Terus bangun performa lewat latihan sampai salah satu jalur lolos syarat kesiapan dan aturan operasional.'
    );
    renderGroup(
        almostReadyContainer,
        models.filter(model => model.section === 'almost-ready'),
        'Belum ada ujian di zona persiapan',
        'Saat sebuah ujian sudah memenuhi syarat dasar tetapi belum siap penuh, ujian itu akan tampil di sini dengan jalur latihan langsung.'
    );
    renderGroup(
        lockedContainer,
        models.filter(model => model.section === 'locked'),
        'Tidak ada jalur yang terkunci',
        'Jika sebuah ujian terblokir oleh level, jeda ulang, atau prasyarat, ujian itu akan ditampilkan di sini.'
    );
}

function renderExamHistory() {
    const history = [...getExamHistory()].slice(-6).reverse();
    const container = document.getElementById('exam-history-container');

    if (!container) {
        return;
    }

    container.innerHTML = history.length
        ? history.map(entry => `
            <div class="exam-history-card">
                <h4>${entry.title || entry.examId}</h4>
                <p>${entry.passed ? 'Percobaan ujian lulus' : 'Percobaan ujian masih perlu peningkatan'}</p>
                <div class="exam-history-row">
                    <span>Nilai</span>
                    <strong>${entry.percentage}%</strong>
                </div>
                <div class="exam-history-row">
                    <span>Waktu</span>
                    <strong>${Math.round(Number(entry.timeTaken || 0) / 60)} min</strong>
                </div>
                <div class="exam-history-row">
                    <span>Hasil</span>
                    <strong>${entry.passed ? 'Lulus' : 'Belum Lulus'}</strong>
                </div>
                <div class="exam-history-row">
                    <span>Dikerjakan Pada</span>
                    <strong>${formatDate(entry.attemptedAt || entry.savedAt)}</strong>
                </div>
            </div>
        `).join('')
        : `
            <div class="exam-empty-card">
                <h4>Belum ada percobaan ujian</h4>
                <p>Riwayat ujian akan tampil di sini setelah percobaan formal pertama selesai.</p>
            </div>
        `;
}

function loadAvailableExams() {
    const userData = getUserData();
    const dashboard = getReadinessDashboard();
    const requestedExamId = getRequestedExamId();
    const models = examData
        .map(exam => buildExamViewModel(exam, userData, dashboard, requestedExamId))
        .sort((left, right) => {
            if (left.spotlight) return -1;
            if (right.spotlight) return 1;
            return right.readiness.readinessScore - left.readiness.readinessScore;
        });

    renderExamHero(dashboard, models, requestedExamId);
    renderExamOverview(dashboard);
    renderExamSections(models);
    renderExamHistory();
}

function getIneligibilityMessage(eligibility) {
    switch (eligibility.reason) {
        case 'level':
            return `Memerlukan level ${eligibility.required}.`;
        case 'attempts':
            return 'Batas maksimal percobaan telah tercapai.';
        case 'retake':
            return `Ujian ulang tersedia dalam ${eligibility.daysRemaining} hari.`;
        case 'prerequisites':
            return 'Item persiapan yang diwajibkan belum lengkap.';
        default:
            return 'Jalur ujian ini belum tersedia.';
    }
}

function formatPrerequisite(prerequisite) {
    const formatMap = {
        'autocad-basics-course': 'AutoCAD Basics Course',
        'autocad-practice-80': 'AutoCAD Practice with 80% minimum',
        'revit-basics-course': 'Revit Basics Course',
        'revit-advanced-course': 'Revit Advanced Course',
        'bim-coordination-course': 'BIM Coordination Course',
        'bim-strategy-course': 'BIM Strategy Course',
        'project-management-course': 'Project Management Course',
        'leadership-training': 'Leadership Training'
    };

    return formatMap[prerequisite] || prerequisite;
}

function openPracticePath(examId, view) {
    window.location.href = `practice.html?targetExam=${examId}&view=${view || 'skill-drills'}`;
}

function showExamPath(examId) {
    const url = new URL(window.location.href);
    url.searchParams.set('targetExam', examId);
    window.location.href = url.toString();
}

function showPrerequisites(examId, reason) {
    currentModalExamId = examId;
    const exam = examData.find(item => item.id === examId);
    const modal = document.getElementById('prerequisites-modal');
    const list = document.getElementById('prerequisites-list');
    const dashboard = getReadinessDashboard();
    const readiness = dashboard.exams.find(item => item.examId === examId);
    const eligibility = exam ? checkExamEligibility(exam, getUserData()) : { eligible: false, reason };
    const blockers = [];

    if (!exam || !modal || !list) {
        return;
    }

    if (eligibility.reason === 'prerequisites' && Array.isArray(eligibility.missing)) {
        blockers.push(...eligibility.missing.map(item => `Selesaikan ${formatPrerequisite(item)}.`));
    } else if (eligibility.reason === 'level') {
        blockers.push(`Level saat ini masih di bawah ${eligibility.required}.`);
    } else if (eligibility.reason === 'attempts') {
        blockers.push(`Anda telah mencapai batas maksimal ${eligibility.maxAttempts} percobaan.`);
    } else if (eligibility.reason === 'retake') {
        blockers.push(`Tunggu ${eligibility.daysRemaining} hari lagi sebelum mengulang ujian ini.`);
    }

    if (readiness) {
        if (readiness.coverage < 100 && Array.isArray(readiness.missingCategories) && readiness.missingCategories.length) {
            blockers.push(`Lengkapi cakupan latihan pada ${readiness.missingCategories.join(', ')}.`);
        }
        if (readiness.accuracy < readiness.minAccuracy) {
            blockers.push(`Tingkatkan akurasi terukur setidaknya ke ${readiness.minAccuracy}%.`);
        }
        if (readiness.attempts < readiness.minAttempts) {
            blockers.push(`Selesaikan ${readiness.minAttempts - readiness.attempts} percobaan terukur lagi.`);
        }
        if (!blockers.length) {
            blockers.push(readiness.recommendation);
        }
    }

    list.innerHTML = blockers.map(item => `<li><i class="fas fa-angle-right"></i> ${item}</li>`).join('');
    modal.style.display = 'flex';
}

function prepareExam(examId) {
    const exam = examData.find(item => item.id === examId);
    const dashboard = getReadinessDashboard();
    const readiness = dashboard.exams.find(item => item.examId === examId);
    const eligibility = exam ? checkExamEligibility(exam, getUserData()) : { eligible: false, reason: 'readiness' };

    if (!exam) {
        return;
    }

    if (!eligibility.eligible) {
        showPrerequisites(examId, eligibility.reason);
        return;
    }

    if (readiness && readiness.status !== 'ready') {
        showPrerequisites(examId, 'readiness');
        return;
    }

    currentExam = exam;
    isExamReviewMode = false;
    markedForReview = new Set();

    const modal = document.getElementById('exam-prep-modal');
    const details = document.getElementById('exam-details');
    const questionPool = getExamQuestionPool(exam);

    document.getElementById('exam-title-header').textContent = exam.title;
    details.innerHTML = `
        <div class="exam-overview">
            <h4>${exam.title}</h4>
            <div class="exam-specs">
                <div class="spec">
                    <i class="fas fa-clock"></i>
                    <span>Durasi: ${exam.duration} menit</span>
                </div>
                <div class="spec">
                    <i class="fas fa-question-circle"></i>
                    <span>Soal: ${exam.questionCount}</span>
                </div>
                <div class="spec">
                    <i class="fas fa-target"></i>
                    <span>Nilai Lulus: ${exam.passingScore}%</span>
                </div>
                <div class="spec">
                    <i class="fas fa-database"></i>
                    <span>Bank Soal: ${questionPool.length} item</span>
                </div>
            </div>
            <div class="exam-rules">
                <h5>Aturan Ujian:</h5>
                <ul>
                    <li>Pemantauan kamera dan mikrofon wajib diaktifkan</li>
                    <li>Mode layar penuh wajib digunakan</li>
                    <li>Tidak diperbolehkan menggunakan sumber eksternal</li>
                    <li>Perpindahan tab browser akan terdeteksi</li>
                    <li>Batas waktu diterapkan secara ketat</li>
                </ul>
            </div>
            ${readiness ? `<p><strong>Kesiapan:</strong> ${readiness.recommendation}</p>` : ''}
        </div>
    `;

    document.querySelectorAll('.checklist-item input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    document.getElementById('start-exam').disabled = true;
    modal.style.display = 'flex';
}

function startExam() {
    if (!currentExam) {
        return;
    }

    currentExamQuestions = buildRuntimeQuestionSet(currentExam);
    if (!currentExamQuestions.length) {
        alert('Bank soal untuk ujian ini belum tersedia.');
        return;
    }

    document.getElementById('exam-prep-modal').style.display = 'none';
    document.getElementById('exam-interface').style.display = 'block';

    examStartTime = Date.now();
    currentQuestionIndex = 0;
    examAnswers = new Array(currentExamQuestions.length).fill(null);
    isExamReviewMode = false;
    markedForReview = new Set();

    startExamTimer();
    requestFullscreen();
    startProctoring();
    loadExamQuestions();
    displayQuestion();
}

function startExamTimer() {
    const timerElement = document.getElementById('time-remaining');
    let timeLeft = currentExam.duration * 60;

    examTimer = setInterval(() => {
        timeLeft -= 1;

        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (timeLeft <= 300) {
            timerElement.style.color = '#EF4444';
        } else if (timeLeft <= 600) {
            timerElement.style.color = '#F59E0B';
        }

        if (timeLeft <= 0) {
            clearInterval(examTimer);
            submitExam(true);
        }
    }, 1000);
}

function loadExamQuestions() {
    const grid = document.getElementById('question-grid');
    grid.innerHTML = '';

    for (let index = 0; index < currentExamQuestions.length; index += 1) {
        const button = document.createElement('button');
        button.className = 'question-nav-btn';
        button.textContent = index + 1;
        button.onclick = () => navigateToQuestion(index);
        button.id = `nav-btn-${index}`;
        grid.appendChild(button);
    }
}

function displayQuestion() {
    const question = currentExamQuestions[currentQuestionIndex];
    if (!question) {
        return;
    }

    document.getElementById('question-number').textContent = `Soal ${currentQuestionIndex + 1}`;
    document.getElementById('question-text').textContent = question.question;
    document.getElementById('question-progress').textContent = `${currentQuestionIndex + 1} / ${currentExamQuestions.length}`;

    const optionsContainer = document.getElementById('question-options');
    optionsContainer.innerHTML = '';

    question.options.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        const isSelected = examAnswers[currentQuestionIndex] === index;
        const isCorrect = index === question.correct;
        const isWrongSelection = isExamReviewMode && isSelected && !isCorrect;

        optionDiv.className = 'option';
        if (isExamReviewMode && isCorrect) {
            optionDiv.classList.add('correct');
        } else if (isWrongSelection) {
            optionDiv.classList.add('wrong');
        } else if (isSelected) {
            optionDiv.classList.add('selected');
        }

        optionDiv.innerHTML = `
            <input type="radio" id="option-${index}" name="exam-option" value="${index}" ${isSelected ? 'checked' : ''} ${isExamReviewMode ? 'disabled' : ''}>
            <label for="option-${index}">${option}</label>
        `;

        if (!isExamReviewMode) {
            optionDiv.addEventListener('click', () => {
                optionDiv.querySelector('input').checked = true;
                examAnswers[currentQuestionIndex] = index;
                updateQuestionNavigation();
            });
        }

        optionsContainer.appendChild(optionDiv);
    });

    document.getElementById('prev-question').disabled = currentQuestionIndex === 0;
    document.getElementById('mark-review').style.display = isExamReviewMode ? 'none' : 'inline-block';

    if (currentQuestionIndex === currentExamQuestions.length - 1 || isExamReviewMode) {
        document.getElementById('next-question').style.display = isExamReviewMode && currentQuestionIndex < currentExamQuestions.length - 1
            ? 'inline-block'
            : currentQuestionIndex === currentExamQuestions.length - 1 ? 'none' : 'inline-block';
        document.getElementById('submit-exam').style.display = isExamReviewMode ? 'none' : (currentQuestionIndex === currentExamQuestions.length - 1 ? 'inline-block' : 'none');
    } else {
        document.getElementById('next-question').style.display = 'inline-block';
        document.getElementById('submit-exam').style.display = 'none';
    }

    updateQuestionNavigation();
}

function updateQuestionNavigation() {
    for (let index = 0; index < currentExamQuestions.length; index += 1) {
        const button = document.getElementById(`nav-btn-${index}`);
        if (!button) {
            continue;
        }

        button.className = 'question-nav-btn';

        if (index === currentQuestionIndex) {
            button.classList.add('current');
        }

        if (examAnswers[index] !== null) {
            button.classList.add('answered');
        }

        if (markedForReview.has(index)) {
            button.classList.add('marked');
        }
    }
}

function navigateToQuestion(index) {
    if (index >= 0 && index < currentExamQuestions.length) {
        currentQuestionIndex = index;
        displayQuestion();
    }
}

function toggleMarkForReview() {
    if (markedForReview.has(currentQuestionIndex)) {
        markedForReview.delete(currentQuestionIndex);
    } else {
        markedForReview.add(currentQuestionIndex);
    }

    updateQuestionNavigation();
}

function calculateExamResults() {
    let correctCount = 0;
    const categoryPerformance = {};

    examAnswers.forEach((answer, index) => {
        const question = currentExamQuestions[index];
        if (!question) {
            return;
        }

        const category = question.category || 'general';
        if (!categoryPerformance[category]) {
            categoryPerformance[category] = { correct: 0, total: 0 };
        }

        categoryPerformance[category].total += 1;
        if (answer === question.correct) {
            correctCount += 1;
            categoryPerformance[category].correct += 1;
        }
    });

    const percentage = Math.round((correctCount / currentExamQuestions.length) * 100);
    const passed = percentage >= currentExam.passingScore;
    const timeTaken = Date.now() - examStartTime;

    return {
        correct: correctCount,
        total: currentExamQuestions.length,
        percentage,
        passed,
        timeTaken,
        categoryPerformance,
        violations: proctoring.violations
    };
}

function submitExam(autoSubmit = false) {
    if (!autoSubmit) {
        const unanswered = examAnswers.filter(answer => answer === null).length;
        if (unanswered > 0) {
            const confirmSubmit = window.confirm(`Masih ada ${unanswered} soal yang belum dijawab. Yakin ingin mengumpulkan?`);
            if (!confirmSubmit) {
                return;
            }
        }
    }

    if (examTimer) {
        clearInterval(examTimer);
        examTimer = null;
    }

    stopProctoring();
    exitFullscreen();

    const results = calculateExamResults();
    document.getElementById('exam-interface').style.display = 'none';

    showExamResults(results);
    updateExamAttempt(results);
    syncExamAttemptToServer(results);
}

function showExamResults(results) {
    const modal = document.getElementById('exam-results-modal');

    document.getElementById('final-score-percentage').textContent = `${results.percentage}%`;
    document.getElementById('total-questions').textContent = results.total;
    document.getElementById('correct-answers').textContent = results.correct;
    document.getElementById('wrong-answers').textContent = results.total - results.correct;

    const minutes = Math.floor(results.timeTaken / 60000);
    const seconds = Math.floor((results.timeTaken % 60000) / 1000);
    document.getElementById('time-taken').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    const statusElement = document.getElementById('pass-fail-status');
    const messageElement = document.getElementById('score-message');
    const scoreCircle = document.getElementById('final-score-circle');
    const downloadBtn = document.getElementById('download-certificate');

    if (results.passed) {
        statusElement.textContent = 'LULUS';
        statusElement.className = 'pass';
        messageElement.textContent = 'Selamat! Anda berhasil lulus ujian.';
        scoreCircle.className = 'score-circle pass';
        downloadBtn.style.display = 'inline-block';
    } else {
        statusElement.textContent = 'BELUM LULUS';
        statusElement.className = 'fail';
        messageElement.textContent = `Anda membutuhkan ${currentExam.passingScore}% untuk lulus. Terus belajar dan coba lagi.`;
        scoreCircle.className = 'score-circle fail';
        downloadBtn.style.display = 'none';
    }

    const breakdownContainer = document.getElementById('category-breakdown');
    breakdownContainer.innerHTML = '<h4>Performa per Kategori:</h4>';

    Object.entries(results.categoryPerformance).forEach(([category, performance]) => {
        const percentage = Math.round((performance.correct / performance.total) * 100);
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category-result';
        categoryDiv.innerHTML = `
            <span class="category-name">${formatCategoryLabel(category)}:</span>
            <span class="category-score">${performance.correct}/${performance.total} (${percentage}%)</span>
            <div class="category-bar">
                <div class="category-progress" style="width: ${percentage}%"></div>
            </div>
        `;
        breakdownContainer.appendChild(categoryDiv);
    });

    modal.style.display = 'flex';
}

function reviewExamAttempt() {
    if (!currentExamQuestions.length) {
        return;
    }

    document.getElementById('exam-results-modal').style.display = 'none';
    document.getElementById('exam-interface').style.display = 'block';
    isExamReviewMode = true;
    currentQuestionIndex = 0;
    displayQuestion();
}

function updateExamAttempt(results) {
    const exam = examData.find(item => item.id === currentExam.id);
    const attemptedAt = new Date().toISOString();

    if (exam) {
        exam.attempts += 1;
        exam.lastAttempt = attemptedAt;
        exam.lastScore = results.percentage;
    }

    if (window.LearningReadiness && typeof window.LearningReadiness.saveExamAttempt === 'function') {
        window.LearningReadiness.saveExamAttempt({
            examId: currentExam.id,
            title: currentExam.title,
            category: currentExam.category,
            percentage: results.percentage,
            passed: results.passed,
            timeTaken: Math.round(results.timeTaken / 1000),
            attemptedAt
        });
    }

    hydrateExamStateFromHistory();
    loadAvailableExams();
}

async function syncExamAttemptToServer(results) {
    try {
        const authUser = getAuthenticatedUser() || {};
        const token = getAuthToken();
        const readiness = getReadinessDashboard().exams.find(item => item.examId === currentExam.id);
        const headers = {
            'Content-Type': 'application/json'
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const payload = {
            quizId: currentExam.id,
            quizName: currentExam.title,
            quizCategory: currentExam.category || 'exam',
            sourceType: 'exam',
            score: results.correct,
            totalQuestions: results.total,
            percentage: results.percentage,
            passed: results.passed,
            answers: examAnswers,
            timeTaken: Math.round(results.timeTaken / 1000),
            issueCertificate: results.passed && readiness?.status === 'ready',
            certificateTitle: currentExam?.certification?.title || `${currentExam.title} Certificate`,
            userId: authUser.id || authUser.userId || authUser.email || authUser.username || authUser.name || null,
            userName: authUser.name || authUser.username || null,
            userEmail: authUser.email || null,
            currentLevel: authUser.level || authUser.bimLevel || null,
            metadata: {
                violations: Array.isArray(results.violations) ? results.violations.length : 0,
                requiredLevel: currentExam.requiredLevel || null,
                readinessStatus: readiness?.status || 'unknown',
                readinessScore: readiness?.readinessScore ?? null
            }
        };

        const response = await fetch('/api/elearning/quiz/submit', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const text = await response.text();
            console.warn('Exam result sync failed:', response.status, text);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.warn('Exam result sync skipped:', error.message);
        return null;
    }
}

function initializeProctoring() {
    monitorForViolations();
}

function startProctoring() {
    proctoring.cameraActive = true;
    proctoring.microphoneActive = true;
    proctoring.violations = [];
    document.getElementById('camera-status').style.color = '#22C55E';
}

function stopProctoring() {
    proctoring.cameraActive = false;
    proctoring.microphoneActive = false;
    document.getElementById('camera-status').style.color = '#9CA3AF';
}

function monitorForViolations() {
    if (proctoringListenersAttached) {
        return;
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && proctoring.cameraActive) {
            proctoring.violations.push({
                type: 'tab_switch',
                timestamp: Date.now(),
                description: 'User switched browser tab'
            });
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && proctoring.cameraActive) {
            proctoring.violations.push({
                type: 'fullscreen_exit',
                timestamp: Date.now(),
                description: 'User exited fullscreen mode'
            });
        }
    });

    proctoringListenersAttached = true;
}

function requestFullscreen() {
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
    }
}

function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    }
}

function setupEventListeners() {
    document.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', event => {
            event.target.closest('.modal').style.display = 'none';
        });
    });

    const checkboxes = document.querySelectorAll('.checklist-item input[type="checkbox"]');
    const startButton = document.getElementById('start-exam');

    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const allChecked = Array.from(checkboxes).every(item => item.checked);
            startButton.disabled = !allChecked;
        });
    });

    document.getElementById('prev-question')?.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex -= 1;
            displayQuestion();
        }
    });

    document.getElementById('next-question')?.addEventListener('click', () => {
        if (currentQuestionIndex < currentExamQuestions.length - 1) {
            currentQuestionIndex += 1;
            displayQuestion();
        }
    });

    document.getElementById('mark-review')?.addEventListener('click', toggleMarkForReview);
    document.getElementById('start-exam')?.addEventListener('click', startExam);
    document.getElementById('submit-exam')?.addEventListener('click', () => submitExam(false));
    document.getElementById('cancel-exam')?.addEventListener('click', () => {
        document.getElementById('exam-prep-modal').style.display = 'none';
    });
    document.getElementById('back-to-exams')?.addEventListener('click', () => {
        document.getElementById('exam-results-modal').style.display = 'none';
        document.getElementById('exam-interface').style.display = 'none';
        isExamReviewMode = false;
        loadAvailableExams();
    });
    document.getElementById('view-review')?.addEventListener('click', reviewExamAttempt);
    document.getElementById('view-requirements')?.addEventListener('click', () => {
        const examId = currentModalExamId;
        if (!examId) {
            return;
        }

        const readiness = getReadinessDashboard().exams.find(item => item.examId === examId);
        openPracticePath(examId, readiness?.recommendedPracticeMode || 'skill-drills');
    });
}
