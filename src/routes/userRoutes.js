const express = require('express');
const router = express.Router();
const { updateUserAdminStatus } = require('../controllers/adminController');
const { protect, admin } = require('../middlewares/authMiddleware');

// Define admin routes
router.put('/:id/admin', protect, admin, updateUserAdminStatus);

module.exports = router;
