const express = require('express');
const router = express.Router();
const { signup, login, forgotPassword, resetPassword, resendVerificationEmail, verifyEmail } = require('../controllers/authController');

// Define auth routes
router.post('/signup', signup);
router.post('/login', login);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword', resetPassword);

// Email Verification routes
router.post('/resend-verification', resendVerificationEmail);
router.post('/verify-email', verifyEmail);

module.exports = router;
