// const app = require('./app');
// const connectDB = require('./config/db');
// const mongoose = require('mongoose');
// require('dotenv').config();

// const PORT = process.env.PORT || 4000;

// // Function to start the server after DB connection
// const startServer = async () => {
//   try {
//     // Connect to database first
//     await connectDB();
    
//     // Start listening only after successful connection
//     const server = app.listen(PORT, () => {
//       console.log(`Server is successfully running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
//     });

//     // Graceful Shutdown Logic
//     const shutdown = async (signal) => {
//       console.log(`\n${signal} signal received. Shutting down gracefully...`);
      
//       server.close(async () => {
//         console.log('HTTP server closed.');
//         try {
//           await mongoose.connection.close(false);
//           console.log('MongoDB connection closed.');
//           process.exit(0);
//         } catch (err) {
//           console.error('Error during MongoDB disconnection:', err);
//           process.exit(1);
//         }
//       });

//       // Force shutdown if it takes too long
//       setTimeout(() => {
//         console.error('Could not close connections in time, forcefully shutting down');
//         process.exit(1);
//       }, 10000);
//     };

//     process.on('SIGINT', () => shutdown('SIGINT'));
//     process.on('SIGTERM', () => shutdown('SIGTERM'));

//   } catch (error) {
//     console.error('Failed to start server:', error);
//     process.exit(1);
//   }
// };

// startServer();

const app = require('./app');

module.exports = app;