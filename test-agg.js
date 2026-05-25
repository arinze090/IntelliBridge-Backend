const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('./src/models/User');

dotenv.config({ path: path.join(__dirname, '.env') });

const generateNGrams = (text) => {
  if (!text) return [];
  const minGram = 2;
  const maxGram = 15;
  const str = text.toLowerCase();
  const nGrams = [];
  for (let i = 0; i < str.length; i++) {
    for (let j = minGram; j <= maxGram && i + j <= str.length; j++) {
      nGrams.push(str.substring(i, i + j));
    }
  }
  return nGrams;
};

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const query = "vitor";
  const queryGrams = generateNGrams(query);

  const pipeline = [
    { $match: { isAuthor: true } },
    {
      $addFields: {
        matchScore: {
          $size: {
            $setIntersection: [{ $ifNull: ["$searchKeywords", []] }, queryGrams]
          }
        }
      }
    },
    { $match: { matchScore: { $gt: 1 } } },
    { $sort: { matchScore: -1 } },
    { $limit: 10 },
    { $project: { _id: 1, fullname: 1, matchScore: 1 } }
  ];

  const authors = await User.aggregate(pipeline);
  console.log('Authors found for "vitor":', authors);
  mongoose.disconnect();
});
