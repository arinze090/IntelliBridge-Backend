const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullname: {
    type: String,
    required: [true, 'Please provide your full name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please provide an email address'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email address'
    ]
  },
  username: {
    type: String,
    required: [true, 'Please provide a username'],
    unique: true,
    trim: true
  },
  profilePicture: {
    type: String
  },
  profilePictureId: {
    type: String
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [8, 'Password must be at least 8 characters long'],
    validate: {
      validator: function(v) {
        // Must contain at least one uppercase, one lowercase, one number, and one special character
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/.test(v);
      },
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    },
    select: false // Do not return password by default
  },
  isAdmin: {
    type: Boolean,
    required: true,
    default: false
  },
  isAuthor: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isSuspended: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  source: {
    type: String,
    enum: ['WEB', 'IOS', 'ANDROID', 'UNKNOWN'],
    default: 'UNKNOWN'
  },
  verifyEmailOtp: String,
  verifyEmailExpire: Date,
  resetPasswordOtp: String,
  resetPasswordExpire: Date,
  fcmTokens: {
    type: [String],
    default: [],
    select: false
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  inactiveNotificationSent: {
    type: Boolean,
    default: false
  },
  searchKeywords: {
    type: [String],
    default: [],
    select: false
  }
}, {
  timestamps: true
});

// Helper to generate n-grams for fuzzy search
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

// Encrypt password using bcrypt before saving and generate n-grams
userSchema.pre('save', async function() {
  // Generate n-grams for fuzzy searching
  if (this.isModified('fullname') || this.isModified('username')) {
    const nameGrams = generateNGrams(this.fullname);
    const usernameGrams = generateNGrams(this.username);
    // Combine and remove duplicates
    this.searchKeywords = [...new Set([...nameGrams, ...usernameGrams])];
  }

  // Handle password hashing
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
