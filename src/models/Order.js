const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true,
  },
  // Snapshot of book data at time of purchase (preserves history)
  title: { type: String, required: true },
  author: { type: String, required: true },
  bookImage: { type: String },
  bookFormat: { type: String },
  isbn: { type: String },
  price: { type: Number, required: true },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  items: {
    type: [orderItemSchema],
    validate: {
      validator: (v) => Array.isArray(v) && v.length > 0,
      message: 'An order must contain at least one item',
    },
  },
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Total amount cannot be negative'],
  },
  currency: {
    type: String,
    default: 'NGN',
  },
  // Payment gateway used for this order
  paymentMethod: {
    type: String,
    enum: ['paystack', 'applepay'],
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
    index: true,
  },
  // Generic payment reference (e.g. Paystack reference, Flutterwave txRef, etc.)
  transactionReference: {
    type: String,
    required: true,
    index: true,
  },
  // Raw payment gateway response stored as a JSON string
  paymentData: {
    type: String,
  },
  paidAt: {
    type: Date,
  },
}, {
  timestamps: true, // createdAt + updatedAt — important for analytics
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
