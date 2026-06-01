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
  getAuthorById,
  submitAuthorRequest,
  getAuthorRequests,
  rejectAuthorRequest
} = require('../controllers/adminController');
const { protect, admin } = require('../middlewares/authMiddleware');

// User-facing request routes
router.post('/author-request', protect, submitAuthorRequest);

// All routes below require authentication + admin privileges
router.get('/author-requests', protect, admin, getAuthorRequests);
router.put('/author-requests/:id/reject', protect, admin, rejectAuthorRequest);
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
