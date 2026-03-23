const mongoose = require('mongoose');

// Represents a single book in a user's personal digital library.
// Each document = one book the user has paid for.
const userBookSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true,
    index: true,
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
  purchasedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  amountPaid: {
    type: Number,
    required: true,
  },
  // Allows admins to revoke access without deleting the record (preserves audit trail)
  accessGranted: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Prevent a user from being granted the same book twice
userBookSchema.index({ user: 1, book: 1 }, { unique: true });

const UserBook = mongoose.model('UserBook', userBookSchema);
module.exports = UserBook;
