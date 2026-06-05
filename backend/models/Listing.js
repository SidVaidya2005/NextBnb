const mongoose = require("mongoose");

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1625505826533-5c80aca7d157?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fGdvYXxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=800&q=60";

const listingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: String,
  image: {
    type: String,
    default: DEFAULT_IMAGE,
    set: (v) => (v === "" || v == null ? DEFAULT_IMAGE : v),
  },
  price: Number,
  location: String,
  country: String,
  // Browse-category tags (e.g. "Villas", "Beachfront"). A listing can belong to
  // several at once; the home page category strip filters on membership.
  categories: { type: [String], default: [] },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  // Denormalized review aggregates, recomputed by reviewService on write so the
  // grid can render ratings without an N+1 lookup.
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
});

const Listing = mongoose.model("Listing", listingSchema);

module.exports = Listing;
module.exports.DEFAULT_IMAGE = DEFAULT_IMAGE;
