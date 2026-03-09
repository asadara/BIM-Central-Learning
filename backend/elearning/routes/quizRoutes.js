const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');

router.get('/:id', quizController.getQuizById);
router.post('/submit', quizController.submitQuiz);

// New routes for quiz tracking and statistics
router.get('/user/:userId/stats', quizController.getUserQuizStats);
router.get('/user/:userId/history', quizController.getUserQuizHistory);

module.exports = router;
