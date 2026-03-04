const User = require('../models/User');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password -verifyEmailOtp -verifyEmailExpire -resetPasswordOtp -resetPasswordExpire');
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get a single user by ID
// @route   GET /api/users/:id
// @access  Private/Admin
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -verifyEmailOtp -verifyEmailExpire -resetPasswordOtp -resetPasswordExpire');
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update user admin status
// @route   PUT /api/users/:id/admin
// @access  Private/Admin
const updateUserAdminStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (user) {
      user.isAdmin = req.body.isAdmin !== undefined ? req.body.isAdmin : user.isAdmin;

      const updatedUser = await user.save({ validateBeforeSave: false });

      res.json({
        _id: updatedUser._id,
        fullname: updatedUser.fullname,
        email: updatedUser.email,
        isAdmin: updatedUser.isAdmin,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Suspend or unsuspend a user
// @route   PUT /api/users/:id/suspend
// @access  Private/Admin
const updateUserSuspendStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent suspending another admin
    if (user.isAdmin) {
      return res.status(400).json({ message: 'Cannot suspend an admin user' });
    }

    const suspend = req.body.isSuspended;
    if (typeof suspend !== 'boolean') {
      return res.status(400).json({ message: 'Please provide isSuspended as a boolean value' });
    }

    user.isSuspended = suspend;
    await user.save({ validateBeforeSave: false });

    res.json({
      _id: user._id,
      fullname: user.fullname,
      email: user.email,
      isSuspended: user.isSuspended,
      message: suspend ? 'User account has been suspended' : 'User account has been reactivated',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUserAdminStatus,
  updateUserSuspendStatus,
};
