const express = require('express');
const router = express.Router();
const moduleController = require('../controllers/moduleController');

router.get('/', moduleController.getModules);
router.get('/:id', moduleController.getModuleById);

module.exports = router;
