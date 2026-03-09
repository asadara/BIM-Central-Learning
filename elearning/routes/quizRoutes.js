const express = require('express');
const router = express.Router();

// Placeholder quiz routes
router.get('/', (req, res) => {
    res.json({ quizzes: [], message: 'Quiz endpoint - placeholder' });
});

module.exports = router;
