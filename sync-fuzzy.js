const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('./src/models/User');

// Load env vars
dotenv.config({ path: path.join(__dirname, '.env') });

const syncIndexes = async () => {
  try {
    console.log('Connecting to MongoDB...', process.env.MONGO_URI ? 'URI Found' : 'No URI');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    console.log('Fetching all users...');
    const users = await User.find({});
    console.log(`Found ${users.length} users. Re-saving to build fuzzy indexes...`);

    let count = 0;
    for (const user of users) {
      // Force the hook to run by explicitly marking as modified, or just manually setting it here
      user.markModified('fullname');
      await user.save({ validateBeforeSave: false });
      count++;
    }

    console.log(`Successfully built indexes for ${count} users.`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

syncIndexes();
