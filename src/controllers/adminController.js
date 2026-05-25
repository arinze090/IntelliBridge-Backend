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

// @desc    Update user author status
// @route   PUT /api/users/:id/author
// @access  Private/Admin
const updateUserAuthorStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (user) {
      user.isAuthor = req.body.isAuthor !== undefined ? req.body.isAuthor : user.isAuthor;

      const updatedUser = await user.save({ validateBeforeSave: false });

      res.json({
        _id: updatedUser._id,
        fullname: updatedUser.fullname,
        email: updatedUser.email,
        isAuthor: updatedUser.isAuthor,
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

// @desc    Delete a user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.deleteOne({ _id: user._id });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Search authors
// @route   GET /api/users/authors/search?q=query
// @access  Private/Admin
const searchAuthors = async (req, res) => {
  try {
    const query = req.query.q;

    // If no search query is provided, just return a default list of authors
    if (!query) {
      const authors = await User.find({ isAuthor: true })
        .select('_id fullname username profilePicture email')
        .limit(20);
      return res.json(authors);
    }

    const searchTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    
    if (searchTokens.length === 0) {
      return res.json([]);
    }

    // Helper to generate n-grams from the query
    const generateNGrams = (text) => {
      if (!text) return [];
      const minGram = 2;
      const maxGram = 15;
      const str = text.toLowerCase();
      const nGrams = [];
      for (let i = 0; i < str.length; i++) {
        for (let j = minGram; j <= maxGram && i + j <= str.length; j++) {
          nGrams.push(str.substring(i, i + j));
        }
      }
      return nGrams;
    };

    // Generate ngrams for all search tokens
    let queryGrams = [];
    searchTokens.forEach(token => {
      queryGrams = queryGrams.concat(generateNGrams(token));
    });

    // Use aggregation to score how many n-grams match the user's searchKeywords array
    const pipeline = [
      { $match: { isAuthor: true } },
      {
        $addFields: {
          matchScore: {
            $size: {
              $setIntersection: [{ $ifNull: ["$searchKeywords", []] }, queryGrams]
            }
          }
        }
      },
      { $match: { matchScore: { $gt: 0 } } },
      { $sort: { matchScore: -1 } },
      { $limit: 20 },
      { $project: { _id: 1, fullname: 1, username: 1, profilePicture: 1, email: 1, matchScore: 1 } }
    ];

    const authors = await User.aggregate(pipeline);

    res.json(authors);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUserAdminStatus,
  updateUserAuthorStatus,
  updateUserSuspendStatus,
  deleteUser,
  searchAuthors,
};
