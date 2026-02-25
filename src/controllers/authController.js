const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '14d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
const signup = async (req, res) => {
  try {
    const { fullname, email, username, password } = req.body;

    // Check for missing fields
    if (!fullname || !email || !username || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Check if user exists
    const userExists = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (userExists) {
      return res.status(400).json({ message: 'User with that email or username already exists' });
    }

    // Create user
    const user = await User.create({
      fullname,
      email,
      username,
      password,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        fullname: user.fullname,
        email: user.email,
        username: user.username,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, username, password } = req.body;

    // Support logging in with either email or username
    if ((!email && !username) || !password) {
      return res.status(400).json({ message: 'Please provide an email/username and password' });
    }

    // Find the user by either email or username
    const user = await User.findOne({
      $or: [{ email }, { username }]
    }).select('+password'); // Explicitly include password for verification

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        fullname: user.fullname,
        email: user.email,
        username: user.username,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Forgot Password - Send OTP
// @route   POST /api/auth/forgotpassword
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Please provide an email address' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'There is no user with that email' });
    }

    // Generate random 6-digit OTP
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash the OTP and save to database (for security)
    user.resetPasswordOtp = crypto.createHash('sha256').update(resetCode).digest('hex');
    // Set expire time to 10 minutes
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    // Send email via Brevo
    try {
      await sendEmail({
        to: user.email,
        name: user.fullname,
        subject: 'Password Reset OTP - Legacy Bridge Publishing',
        template: 'forgotPassword',
        resetCode: resetCode, 
      });

      res.status(200).json({ message: 'OTP sent to email' });
    } catch (err) {
      user.resetPasswordOtp = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(500).json({ message: 'Email could not be sent' });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Reset Password
// @route   PUT /api/auth/resetpassword
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Please provide email, OTP and new password' });
    }

    // Get hashed version of the submitted OTP
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    const user = await User.findOne({
      email,
      resetPasswordOtp: hashedOtp,
      resetPasswordExpire: { $gt: Date.now() } // Check if OTP has not expired
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid OTP or OTP has expired' });
    }

    // Set the new password
    user.password = newPassword;
    
    // Clear the OTP fields
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpire = undefined;

    await user.save(); // validation runs to ensure new password is strong

    // Generate new token and login user automatically upon reset
    res.status(200).json({
      message: 'Password reset successfully',
      _id: user._id,
      fullname: user.fullname,
      email: user.email,
      username: user.username,
      token: generateToken(user._id),
    });

  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  signup,
  login,
  forgotPassword,
  resetPassword,
};
