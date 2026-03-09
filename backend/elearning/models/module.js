// Model: Modul Pembelajaran
module.exports = {
    id: String, // unique id
    title: String,
    description: String,
    media: [
        // { type: 'video'|'pdf'|'doc', url: String }
    ],
    quizzes: [String], // quiz ids
    order: Number // urutan modul
};
