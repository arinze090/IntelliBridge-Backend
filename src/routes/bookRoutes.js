const express = require('express');
const router = express.Router();
const {
  createBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook
} = require('../controllers/bookController');
const { protect, admin } = require('../middlewares/authMiddleware');

// Define book routes
// Notice we use an optional protect middleware for getBooks to conditionally allow admins to see deleted
// But to keep it simple, public gets regular list. We can parse token if present without forcing it.

// Custom middleware to optionally populate req.user if token exists (for admin checks on public routes)
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const optionalAuth = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      // ignore error, just don't populate req.user
    }
  }
  next();
};

router.route('/')
  .get(optionalAuth, getBooks)
  .post(protect, admin, createBook);

router.route('/:id')
  .get(optionalAuth, getBookById)
  .put(protect, admin, updateBook)
  .delete(protect, admin, deleteBook);

module.exports = router;
