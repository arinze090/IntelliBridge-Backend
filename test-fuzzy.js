const mongoose = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/legacy-bridge').then(async () => {
  const users = await User.find({ isAuthor: true }).lean();
  console.log('Authors:', users);
  mongoose.disconnect();
});
