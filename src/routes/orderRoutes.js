const express = require('express');
const router = express.Router();
const {
  checkout,
  getMyOrders,
  getMyLibrary,
  getAllOrders,
  getOrderById,
  verifyDisputedPayment,
  rectifyDisputedOrder,
  getAuthorOrders,
} = require('../controllers/orderController');
const { protect, admin, author } = require('../middlewares/authMiddleware');

// User routes
router.post('/checkout', protect, checkout);
router.get('/my-orders', protect, getMyOrders);
router.get('/my-library', protect, getMyLibrary);

// Author routes
router.get('/author-orders', protect, author, getAuthorOrders);

// Admin routes
router.get('/', protect, admin, getAllOrders);
router.get('/verify-dispute/:reference', protect, admin, verifyDisputedPayment);
router.post('/rectify-dispute', protect, admin, rectifyDisputedOrder);
router.get('/:id', protect, admin, getOrderById);

module.exports = router;
