const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateUserAdminStatus,
  updateUserAuthorStatus,
  updateUserSuspendStatus,
  deleteUser,
  searchAuthors,
  getAllAuthors,
  getAuthorById
} = require('../controllers/adminController');
const { protect, admin } = require('../middlewares/authMiddleware');

// All routes here require authentication + admin privileges
router.get('/authors/search', protect, admin, searchAuthors);
router.get('/authors/:id', protect, admin, getAuthorById);
router.get('/authors', protect, admin, getAllAuthors);
router.get('/', protect, admin, getAllUsers);
router.get('/:id', protect, admin, getUserById);
router.put('/:id/admin', protect, admin, updateUserAdminStatus);
router.put('/:id/author', protect, admin, updateUserAuthorStatus);
router.put('/:id/suspend', protect, admin, updateUserSuspendStatus);
router.delete('/:id', deleteUser);

module.exports = router;
