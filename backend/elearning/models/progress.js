// Model: Progress User
module.exports = {
    userId: String,
    moduleId: String,
    phase: String, // 'belajar' | 'latihan' | 'ujian' | 'selesai'
    quizScore: Number,
    passed: Boolean,
    certificateId: String // jika sudah lulus
};
