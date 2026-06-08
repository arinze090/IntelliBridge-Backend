const express = require('express');
const router = express.Router();
const { processInactiveUsers } = require('../controllers/cronController');

// Define cron routes
// This route will be hit by Vercel Cron
router.get('/inactive-users', processInactiveUsers);

module.exports = router;
