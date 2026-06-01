const mongoose = require("mongoose");

// TODO: define review schema — author, listing, rating, comment
const reviewSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing" },
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Review", reviewSchema);
