import axios from 'axios';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Mongoose Models Setup
const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/legacy-bridge');
};

const runTest = async () => {
  await connectDB();
  const db = mongoose.connection;
  
  // Directly grab Mongoose Collections
  const Category = db.collection('categories');
  const Book = db.collection('books');
  const User = db.collection('users');
  const UserBook = db.collection('userbooks');

  // Insert mock data
  const categoryId = new mongoose.Types.ObjectId();
  await Category.insertOne({
    _id: categoryId,
    name: "API Test Category",
    description: "Testing API",
    createdAt: new Date(),
    updatedAt: new Date(),
    isDeleted: false
  });

  const bookId = new mongoose.Types.ObjectId();
  await Book.insertOne({
    _id: bookId,
    bookTitle: "API Test Book",
    author: "Api Script",
    aboutAuthor: "This is the about author metadata that we want to see!",
    description: "Book created by API test script",
    price: 9.99,
    bookImage: "http://example.com/api.jpg",
    bookImageId: "api_img",
    bookUrl: "http://example.com/api.epub",
    bookFormat: "EPUB",
    category: categoryId,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const userId = new mongoose.Types.ObjectId();
  await User.insertOne({
    _id: userId,
    fullname: "Api Tester",
    email: "apitester@example.com",
    username: "apitester",
    password: "Password123!",
    isAdmin: false,
    isSuspended: false,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const userBookId = new mongoose.Types.ObjectId();
  await UserBook.insertOne({
    _id: userBookId,
    user: userId,
    book: bookId,
    purchasedAt: new Date(),
    amountPaid: 9.99,
    accessGranted: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const token = jwt.sign({ id: userId.toString() }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });

  console.log("Mock data inserted successfully, token generated.");
  
  try {
    const res = await axios.get('http://localhost:4000/api/orders/my-library', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("\n[API RESPONSE - MY LIBRARY]:\n");
    console.log(JSON.stringify(res.data, null, 2));

  } catch (error) {
    console.error("API Call Failed:", error.response?.data || error.message);
  }

  // Cleanup
  await Category.deleteOne({ _id: categoryId });
  await Book.deleteOne({ _id: bookId });
  await User.deleteOne({ _id: userId });
  await UserBook.deleteOne({ _id: userBookId });
  
  console.log("\nCleanup done.");
  process.exit(0);
};

runTest();
