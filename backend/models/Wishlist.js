const mongoose = require("mongoose");

// TODO: define wishlist schema — user, list of listings
const wishlistSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },
    listings: [{ type: mongoose.Schema.Types.ObjectId, ref: "Listing" }],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Wishlist", wishlistSchema);
