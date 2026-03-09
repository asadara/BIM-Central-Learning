const fs = require('fs');
const path = require('path');

const progressPath = path.join(__dirname, '../data/progress.json');

exports.getUserProgress = (req, res) => {
    const userId = req.params.userId;
    const progress = JSON.parse(fs.readFileSync(progressPath));
    const userProgress = progress.filter(p => p.userId === userId);
    res.json(userProgress);
};

exports.updateUserProgress = (req, res) => {
    const { userId, moduleId, phase, quizScore, passed, certificateId } = req.body;
    let progress = JSON.parse(fs.readFileSync(progressPath));
    let entry = progress.find(p => p.userId === userId && p.moduleId === moduleId);
    if (entry) {
        entry.phase = phase;
        entry.quizScore = quizScore;
        entry.passed = passed;
        entry.certificateId = certificateId;
    } else {
        entry = { userId, moduleId, phase, quizScore, passed, certificateId };
        progress.push(entry);
    }
    fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
    res.json(entry);
};
