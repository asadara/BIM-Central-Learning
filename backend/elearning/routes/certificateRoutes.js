const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');

router.get('/:userId', certificateController.getUserCertificates);
router.post('/issue', certificateController.issueCertificate);

module.exports = router;
