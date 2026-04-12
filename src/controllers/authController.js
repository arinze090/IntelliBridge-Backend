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
      // Generate random 6-digit OTP
      const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

      user.verifyEmailOtp = crypto.createHash('sha256').update(verifyCode).digest('hex');
      user.verifyEmailExpire = Date.now() + 6 * 60 * 60 * 1000; // 6 hours
      await user.save({ validateBeforeSave: false });

      try {
        await sendEmail({
          to: user.email,
          name: user.fullname,
          subject: 'Verify your email - Legacy Bridge Publishing',
          template: 'verifyEmail',
          verifyCode: verifyCode, 
        });

        res.status(201).json({
          message: 'User registered successfully. Please verify your email with the OTP sent to you.',
          _id: user._id,
          fullname: user.fullname,
          email: user.email,
          username: user.username,
          profilePicture: user.profilePicture,
          profilePictureId: user.profilePictureId,
        });
      } catch (err) {
        console.error(err);
        user.verifyEmailOtp = undefined;
        user.verifyEmailExpire = undefined;
        await user.save({ validateBeforeSave: false });
        // Still return 201 because user was created even if email failed
        res.status(201).json({ 
          message: 'User registered successfully, but verification email could not be sent.',
          _id: user._id,
          fullname: user.fullname,
          email: user.email,
          username: user.username,
          profilePicture: user.profilePicture,
          profilePictureId: user.profilePictureId,
        });
      }
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

    if (user && user.isSuspended) {
      return res.status(403).json({ message: 'Your account has been suspended. Please contact the technical team for assistance.' });
    }

    if (user && user.isDeleted) {
      return res.status(403).json({ message: 'Your account has been deactivated.' });
    }

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        fullname: user.fullname,
        email: user.email,
        username: user.username,
        profilePicture: user.profilePicture,
        profilePictureId: user.profilePictureId,
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
    // Set expire time to 6 hours
    user.resetPasswordExpire = Date.now() + 6 * 60 * 60 * 1000;

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
      profilePicture: user.profilePicture,
      profilePictureId: user.profilePictureId,
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

// @desc    Resend Verification Email
// @route   POST /api/auth/resend-verification
// @access  Public
const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Please provide an email address' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'There is no user with that email' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    // Generate random 6-digit OTP
    const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

    user.verifyEmailOtp = crypto.createHash('sha256').update(verifyCode).digest('hex');
    user.verifyEmailExpire = Date.now() + 6 * 60 * 60 * 1000; // 6 hours

    await user.save({ validateBeforeSave: false });

    // Send email via Brevo
    try {
      await sendEmail({
        to: user.email,
        name: user.fullname,
        subject: 'Verify your email - Legacy Bridge Publishing',
        template: 'verifyEmail',
        verifyCode: verifyCode, 
      });

      res.status(200).json({ message: 'Verification OTP sent to email' });
    } catch (err) {
      user.verifyEmailOtp = undefined;
      user.verifyEmailExpire = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(500).json({ message: 'Email could not be sent' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Verify Email
// @route   POST /api/auth/verify-email
// @access  Public
const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Please provide email and OTP' });
    }

    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    const user = await User.findOne({
      email,
      verifyEmailOtp: hashedOtp,
      verifyEmailExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid OTP or OTP has expired' });
    }

    user.isVerified = true;
    user.verifyEmailOtp = undefined;
    user.verifyEmailExpire = undefined;

    await user.save({ validateBeforeSave: false });

    res.status(200).json({ message: 'Email verified successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Deactivate User Account
// @route   POST /api/auth/deactivate
// @access  Public
const deactivateAccount = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide both email and password to confirm deactivation' });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isDeleted) {
      return res.status(400).json({ message: 'Account is already deactivated' });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    user.isDeleted = true;
    
    const appendStr = `deleted_${Date.now()}_`;
    const emailParts = user.email.split('@');
    user.email = `${appendStr}${emailParts[0]}@${emailParts[1]}`;
    user.username = `${appendStr}${user.username}`;
    
    await user.save({ validateBeforeSave: false });

    res.status(200).json({ message: 'Account has been deactivated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update User Profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { username, profilePicture, profilePictureId } = req.body;

    // If they are changing their username, check for uniqueness
    if (username && username !== user.username) {
      const usernameExists = await User.findOne({ username });
      if (usernameExists) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
      user.username = username;
    }

    if (profilePicture !== undefined) {
      user.profilePicture = profilePicture;
    }

    if (profilePictureId !== undefined) {
      user.profilePictureId = profilePictureId;
    }

    await user.save();

    res.json({
      _id: user._id,
      fullname: user.fullname,
      email: user.email,
      username: user.username,
      profilePicture: user.profilePicture,
      profilePictureId: user.profilePictureId,
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
  resendVerificationEmail,
  verifyEmail,
  deactivateAccount,
  updateProfile
};
