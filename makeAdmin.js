const mongoose = require('mongoose');
const User = require('./src/models/User');
require('dotenv').config();

const makeAdmin = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOneAndUpdate({ email: 'sarah@sky.net' }, { isAdmin: true }, { new: true });
  console.log('User updated to admin:', user ? user.email : 'Not found');
  process.exit(0);
};

makeAdmin();
