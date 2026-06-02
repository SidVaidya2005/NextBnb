const mongoose = require("mongoose");
const Listing = require("../models/Listing");
const Review = require("../models/Review");
const reviewService = require("./reviewService");

async function makeListing() {
  return Listing.create({ title: "Stay", price: 100 });
}

describe("reviewService", () => {
  const authorId = new mongoose.Types.ObjectId();
  const otherId = new mongoose.Types.ObjectId();

  it("create rejects ratings outside 1..5", async () => {
    const listing = await makeListing();
    await expect(
      reviewService.create({
        author: authorId,
        listing: listing.id,
        rating: 6,
        comment: "Too high",
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      reviewService.create({
        author: authorId,
        listing: listing.id,
        rating: 0,
        comment: "Too low",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("create requires an authenticated author", async () => {
    const listing = await makeListing();
    await expect(
      reviewService.create({
        listing: listing.id,
        rating: 5,
        comment: "No author",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("create denormalizes rating + count onto the listing", async () => {
    const listing = await makeListing();
    await reviewService.create({
      author: authorId,
      listing: listing.id,
      rating: 4,
      comment: "Good",
    });
    await reviewService.create({
      author: otherId,
      listing: listing.id,
      rating: 2,
      comment: "Meh",
    });
    const updated = await Listing.findById(listing.id);
    expect(updated.reviewCount).toBe(2);
    expect(updated.rating).toBe(3); // (4 + 2) / 2
  });

  it("findForListing returns reviews sorted by recency", async () => {
    const listing = await makeListing();
    const older = await reviewService.create({
      author: authorId,
      listing: listing.id,
      rating: 3,
      comment: "First",
    });
    // ensure a distinct createdAt
    await Review.findByIdAndUpdate(older._id, {
      createdAt: new Date(Date.now() - 60000),
    });
    await reviewService.create({
      author: otherId,
      listing: listing.id,
      rating: 5,
      comment: "Second",
    });

    const reviews = await reviewService.findForListing(listing.id);
    expect(reviews).toHaveLength(2);
    expect(reviews[0].comment).toBe("Second");
    expect(reviews[1].comment).toBe("First");
  });

  it("remove only allows the author to delete", async () => {
    const listing = await makeListing();
    const review = await reviewService.create({
      author: authorId,
      listing: listing.id,
      rating: 5,
      comment: "Mine",
    });
    await expect(
      reviewService.remove(review._id, otherId),
    ).rejects.toMatchObject({ status: 403 });

    await reviewService.remove(review._id, authorId);
    const remaining = await reviewService.findForListing(listing.id);
    expect(remaining).toHaveLength(0);
    const updated = await Listing.findById(listing.id);
    expect(updated.reviewCount).toBe(0);
    expect(updated.rating).toBe(0);
  });
});
