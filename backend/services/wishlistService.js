const Wishlist = require("../models/Wishlist");

// Returns the user's saved listings (populated), or [] when they have no wishlist yet.
async function findForUser(userId) {
  const wishlist = await Wishlist.findOne({ user: userId }).populate(
    "listings",
  );
  return wishlist ? wishlist.listings : [];
}

// Idempotent: $addToSet won't duplicate, upsert creates the wishlist on first save.
async function addListing(userId, listingId) {
  const wishlist = await Wishlist.findOneAndUpdate(
    { user: userId },
    { $addToSet: { listings: listingId } },
    { upsert: true, new: true },
  ).populate("listings");
  return wishlist.listings;
}

async function removeListing(userId, listingId) {
  const wishlist = await Wishlist.findOneAndUpdate(
    { user: userId },
    { $pull: { listings: listingId } },
    { new: true },
  ).populate("listings");
  return wishlist ? wishlist.listings : [];
}

async function clear(userId) {
  const wishlist = await Wishlist.findOneAndUpdate(
    { user: userId },
    { $set: { listings: [] } },
    { new: true },
  );
  return wishlist ? wishlist.listings : [];
}

module.exports = { findForUser, addListing, removeListing, clear };
