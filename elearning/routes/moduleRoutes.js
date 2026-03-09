const express = require('express');
const router = express.Router();

// Placeholder module routes
router.get('/', (req, res) => {
    res.json({ modules: [], message: 'Modules endpoint - placeholder' });
});

module.exports = router;
