const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateUserAdminStatus,
  updateUserSuspendStatus,
} = require('../controllers/adminController');
const { protect, admin } = require('../middlewares/authMiddleware');

// All routes here require authentication + admin privileges
router.get('/', protect, admin, getAllUsers);
router.get('/:id', protect, admin, getUserById);
router.put('/:id/admin', protect, admin, updateUserAdminStatus);
router.put('/:id/suspend', protect, admin, updateUserSuspendStatus);

module.exports = router;
