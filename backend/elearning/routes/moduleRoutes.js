const express = require('express');
const router = express.Router();
const moduleController = require('../controllers/moduleController');

router.get('/learning-paths', moduleController.getLearningPaths);
router.get('/learning-paths/:id', moduleController.getLearningPathById);
router.get('/', moduleController.getModules);
router.get('/:id', moduleController.getModuleById);

module.exports = router;
