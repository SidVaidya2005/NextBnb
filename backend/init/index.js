const mongoose = require('mongoose');
const initData = require('./data');
const Listing = require('../models/Listing');
const env = require('../config/env');
const logger = require('../utils/logger');

async function main() {
  await mongoose.connect(env.MONGO_URI);
  await Listing.deleteMany({});
  // Flatten seed image objects (`{ filename, url }`) to plain URL strings
  // since the Listing schema stores image as a single String.
  const normalized = initData.data.map((doc) => ({
    ...doc,
    image: typeof doc.image === 'object' && doc.image ? doc.image.url : doc.image,
  }));
  await Listing.insertMany(normalized);
  logger.info('data was initialized');
  await mongoose.disconnect();
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
