const mongoose = require('mongoose');

const connectDB = async (retries = 3, delay = 2000) => {
  while (retries > 0) {
    try {
      console.log(`Attempting to connect to MongoDB... (${retries} retries left)`);
      const conn = await mongoose.connect(process.env.MONGO_URI);
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      console.error(`Error connecting to MongoDB: ${error.message}`);
      retries -= 1;
      if (retries === 0) {
        console.error('All retries exhausted.');
        throw error; // Throw error instead of exiting process
      }
      console.log(`Waiting ${delay / 1000} seconds before retrying...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
};

module.exports = connectDB;
