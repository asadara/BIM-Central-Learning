const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { requireAuthenticated } = require('../../utils/auth');

router.get('/:id', quizController.getQuizById);
router.post('/submit', requireAuthenticated, quizController.submitQuiz);

// New routes for quiz tracking and statistics
router.get('/user/:userId/stats', requireAuthenticated, quizController.getUserQuizStats);
router.get('/user/:userId/history', requireAuthenticated, quizController.getUserQuizHistory);

module.exports = router;
