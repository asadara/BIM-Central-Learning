const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');
const { requireAuthenticated, requireAdmin } = require('../../utils/auth');

router.get('/:userId', requireAuthenticated, certificateController.getUserCertificates);
router.post('/issue', requireAdmin, certificateController.issueCertificate);

module.exports = router;
