const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  bookImage: {
    type: String,
    required: [true, 'Please provide an image URL for the book']
  },
  bookImageId: {
    type: String,
    required: [true, 'Please provide the Cloudinary public ID (bookImageId) for the book image']
  },
  bookUrl: {
    type: String,
    required: [true, 'Please provide the URL/link to the book file or resource']
  },
  bookFormat: {
    type: String,
    required: [true, 'Please provide the format of the book (e.g., PDF, EPUB, Physical)']
  },
  appleProductId: {
    type: String
  },
  isbn: {
    type: String
  },
  tags: {
    type: [String],
    default: []
  },
  bookTitle: {
    type: String,
    required: [true, 'Please provide the book title'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Please provide the price of the book'],
    min: [0, 'Price cannot be negative']
  },
  description: {
    type: String,
    required: [true, 'Please provide a description of the book']
  },
  author: {
    type: String,
    required: [true, 'Please provide the author name']
  },
  aboutAuthor: {
    type: String,
    required: [true, 'Please provide information about the author']
  },
  authorProfile: {
    type: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      fullname: String,
      username: String,
      profilePicture: String
    },
    default: null
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const Book = mongoose.model('Book', bookSchema);

module.exports = Book;
