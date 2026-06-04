const mongoose = require("mongoose");
const initData = require("./data");
const Listing = require("../models/Listing");
const User = require("../models/User");
const env = require("../config/env");
const logger = require("../utils/logger");

// Pick the user that seeded listings should belong to. Prefer SEED_OWNER_EMAIL
// when set; otherwise fall back to the earliest-created user so re-seeds keep a
// stable owner. Returns null (and warns) when no matching user exists.
async function resolveOwnerId() {
  if (env.SEED_OWNER_EMAIL) {
    const user = await User.findOne({ email: env.SEED_OWNER_EMAIL });
    if (user) return user._id;
    logger.warn(
      `SEED_OWNER_EMAIL=${env.SEED_OWNER_EMAIL} matched no user; seeding without an owner`,
    );
    return null;
  }
  const user = await User.findOne().sort({ createdAt: 1 });
  if (user) return user._id;
  logger.warn("no users found; seeding listings without an owner");
  return null;
}

async function main() {
  await mongoose.connect(env.MONGO_URI);
  await Listing.deleteMany({});
  const ownerId = await resolveOwnerId();
  // Flatten seed image objects (`{ filename, url }`) to plain URL strings since
  // the Listing schema stores image as a single String, and attach the owner so
  // re-seeds keep listings host-owned (editable/deletable from the UI).
  const normalized = initData.data.map((doc) => ({
    ...doc,
    image:
      typeof doc.image === "object" && doc.image ? doc.image.url : doc.image,
    ...(ownerId ? { owner: ownerId } : {}),
  }));
  await Listing.insertMany(normalized);
  logger.info(
    ownerId
      ? `data was initialized (owner: ${ownerId})`
      : "data was initialized (no owner assigned)",
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});
