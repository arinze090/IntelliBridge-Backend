const express = require('express');
const router = express.Router();
const {
  checkout,
  getMyOrders,
  getMyLibrary,
  getAllOrders,
  getOrderById,
} = require('../controllers/orderController');
const { protect, admin } = require('../middlewares/authMiddleware');

// User routes
router.post('/checkout', protect, checkout);
router.get('/my-orders', protect, getMyOrders);
router.get('/my-library', protect, getMyLibrary);

// Admin routes
router.get('/', protect, admin, getAllOrders);
router.get('/:id', protect, admin, getOrderById);

module.exports = router;
