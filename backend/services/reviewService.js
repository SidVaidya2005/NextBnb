const Review = require("../models/Review");
const Listing = require("../models/Listing");
// Ensure the User model is registered for `populate("author")`.
require("../models/User");
const ApiError = require("../utils/ApiError");
const toObjectId = require("../utils/toObjectId");

// Recompute and denormalize the listing's average rating + review count.
async function recomputeListingRating(listingId) {
  const id = toObjectId(listingId, "listing id");
  const stats = await Review.aggregate([
    { $match: { listing: id } },
    {
      $group: {
        _id: "$listing",
        avg: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);
  const { avg = 0, count = 0 } = stats[0] || {};
  await Listing.findByIdAndUpdate(id, {
    rating: Math.round(avg * 10) / 10,
    reviewCount: count,
  });
}

async function findForListing(listingId) {
  return Review.find({ listing: toObjectId(listingId, "listing id") })
    .sort({ createdAt: -1 })
    .populate("author", "name avatar");
}

async function findById(id) {
  const review = await Review.findById(id).populate("author", "name avatar");
  if (!review) {
    throw new ApiError(404, "Review not found");
  }
  return review;
}

async function create({ author, listing, rating, comment }) {
  if (rating == null || rating < 1 || rating > 5) {
    throw new ApiError(400, "Rating must be between 1 and 5");
  }
  if (!author) {
    throw new ApiError(400, "Review requires an author");
  }
  const review = new Review({ author, listing, rating, comment });
  await review.save();
  await recomputeListingRating(listing);
  return review.populate("author", "name avatar");
}

async function remove(id, userId) {
  const review = await Review.findById(id);
  if (!review) {
    throw new ApiError(404, "Review not found");
  }
  if (String(review.author) !== String(userId)) {
    throw new ApiError(403, "You can only delete your own reviews");
  }
  await review.deleteOne();
  await recomputeListingRating(review.listing);
  return review;
}

module.exports = { findForListing, findById, create, remove };
