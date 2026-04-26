const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

// Load env variables
require('dotenv').config();
const connectDB = require('./config/db');

let isConnected = false;

const connectOnce = async () => {
  if (isConnected) return;
  await connectDB();
  isConnected = true;
};

const app = express();

// Middlewares
app.use(express.json());
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));


if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Database connection middleware (MUST be before routes)
app.use(async (req, res, next) => {
  try {
    await connectOnce();
    next();
  } catch (err) {
    console.error('DB connection failed:', err);
    res.status(500).json({ message: 'Database connection error' });
  }
});

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const bookRoutes = require('./routes/bookRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const orderRoutes = require('./routes/orderRoutes');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);

// Serve documentation
app.get(['/', '/docs', '/docs/'], (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = app;
