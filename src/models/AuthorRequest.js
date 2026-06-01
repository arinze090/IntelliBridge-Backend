const mongoose = require('mongoose');

const authorRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  },
  reason: {
    type: String,
  },
  portfolioUrl: {
    type: String,
  },
  adminNotes: {
    type: String,
  }
}, {
  timestamps: true,
});

const AuthorRequest = mongoose.model('AuthorRequest', authorRequestSchema);
module.exports = AuthorRequest;
