const User = require('../models/User');
const sendNotification = require('../utils/sendNotification');

// @desc    Process inactive users and send them a "we miss you" notification
// @route   GET /api/cron/inactive-users
// @access  Public (Protected by VERCEL_CRON_SECRET if available)
const processInactiveUsers = async (req, res) => {
  // Vercel sends an authorization header for cron jobs
  const authHeader = req.headers.authorization;
  if (process.env.VERCEL_CRON_SECRET && authHeader !== `Bearer ${process.env.VERCEL_CRON_SECRET}`) {
    return res.status(401).json({ message: 'Unauthorized cron request' });
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find users inactive for more than 7 days, who have FCM tokens, and haven't been notified yet
    const inactiveUsers = await User.find({
      lastActiveAt: { $lt: sevenDaysAgo },
      inactiveNotificationSent: false,
      fcmTokens: { $exists: true, $not: { $size: 0 } }
    }).select('+fcmTokens');

    let notifiedCount = 0;

    for (const user of inactiveUsers) {
      if (user.fcmTokens && user.fcmTokens.length > 0) {
        try {
          await sendNotification({
            tokens: user.fcmTokens,
            title: 'We miss you.',
            body: 'Your library is still waiting for you',
            data: { type: 'inactivity' }
          });
          
          user.inactiveNotificationSent = true;
          await user.save({ validateBeforeSave: false });
          notifiedCount++;
        } catch (err) {
          console.error(`Failed to notify user ${user._id}:`, err);
        }
      }
    }

    res.status(200).json({ message: `Successfully processed ${notifiedCount} inactive users.` });
  } catch (error) {
    console.error('Error processing inactive users cron:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  processInactiveUsers
};
