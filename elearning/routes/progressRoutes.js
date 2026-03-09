const express = require('express');
const router = express.Router();

// Placeholder progress routes
router.get('/', (req, res) => {
    res.json({ progress: [], message: 'Progress endpoint - placeholder' });
});

module.exports = router;
