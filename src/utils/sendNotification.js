const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
try {
  if (!admin.apps.length) {
    let serviceAccount;
    
    // Check if the credential is provided as an environment variable (for Vercel)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      // Fallback to local file for development
      serviceAccount = require(path.join(__dirname, '../../legacybridge-4cce0-firebase-adminsdk-fbsvc-cc7f86c24a.json'));
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (error) {
  console.error('Firebase Admin Initialization Error:', error);
}

/**
 * Sends a push notification using Firebase Cloud Messaging (FCM).
 *
 * @param {Object} options
 * @param {Array<string>|string} options.tokens - A single FCM token or an array of tokens.
 * @param {string} options.title - Notification title.
 * @param {string} options.body - Notification body.
 * @param {Object} [options.data] - Optional extra data payload.
 */
const sendNotification = async (options) => {
  const { tokens, title, body, data } = options;

  if (!tokens || (Array.isArray(tokens) && tokens.length === 0)) {
    console.log('No FCM tokens provided. Skipping notification.');
    return null;
  }

  const payload = {
    notification: {
      title,
      body,
    },
    data: data || {}, // data must be an object with string values
  };

  // Convert all data object values to string, because FCM data payload only accepts string values
  if (payload.data) {
    for (const key in payload.data) {
      if (typeof payload.data[key] !== 'string') {
        payload.data[key] = String(payload.data[key]);
      }
    }
  }

  try {
    if (Array.isArray(tokens)) {
      // Send to multiple devices (Firebase limit is 500 per call)
      const tokenChunks = [];
      const CHUNK_SIZE = 500;
      for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
        tokenChunks.push(tokens.slice(i, i + CHUNK_SIZE));
      }

      let totalSuccess = 0;
      let totalFailure = 0;

      for (const chunk of tokenChunks) {
        const message = { ...payload, tokens: chunk };
        const response = await admin.messaging().sendEachForMulticast(message);
        totalSuccess += response.successCount;
        totalFailure += response.failureCount;
      }

      console.log(`${totalSuccess} messages were sent successfully`);
      if (totalFailure > 0) {
        console.error(`${totalFailure} messages failed to send.`);
      }
      return { successCount: totalSuccess, failureCount: totalFailure };
    } else {
      // Send to a single device
      const message = { ...payload, token: tokens };
      const response = await admin.messaging().send(message);
      console.log('Successfully sent message:', response);
      return response;
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw new Error(`Notification delivery failed: ${error.message}`);
  }
};

module.exports = sendNotification;
