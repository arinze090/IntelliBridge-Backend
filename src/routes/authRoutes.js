const express = require('express');
const router = express.Router();
const { signup, login, forgotPassword, resetPassword, resendVerificationEmail, verifyEmail, deactivateAccount, updateProfile } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

// Define auth routes
router.post('/signup', signup);
router.post('/login', login);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword', resetPassword);

// Email Verification routes
router.post('/resend-verification', resendVerificationEmail);
router.post('/verify-email', verifyEmail);

// User account management
router.put('/profile', protect, updateProfile);
router.post('/deactivate', protect, deactivateAccount);

module.exports = router;
