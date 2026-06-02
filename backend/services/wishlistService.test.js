const mongoose = require("mongoose");
const Listing = require("../models/Listing");
const Wishlist = require("../models/Wishlist");
const wishlistService = require("./wishlistService");

async function makeListing(title) {
  return Listing.create({ title, price: 100 });
}

describe("wishlistService", () => {
  const userId = new mongoose.Types.ObjectId();

  it("findForUser returns saved listings", async () => {
    const a = await makeListing("A");
    const b = await makeListing("B");
    await wishlistService.addListing(userId, a.id);
    await wishlistService.addListing(userId, b.id);

    const saved = await wishlistService.findForUser(userId);
    expect(saved).toHaveLength(2);
    expect(saved.map((l) => l.title).sort()).toEqual(["A", "B"]);
  });

  it("findForUser returns [] for a user with no wishlist", async () => {
    const saved = await wishlistService.findForUser(userId);
    expect(saved).toEqual([]);
  });

  it("addListing is idempotent for the same listing", async () => {
    const a = await makeListing("A");
    await wishlistService.addListing(userId, a.id);
    await wishlistService.addListing(userId, a.id);

    const saved = await wishlistService.findForUser(userId);
    expect(saved).toHaveLength(1);
  });

  it("removeListing removes only the targeted listing", async () => {
    const a = await makeListing("A");
    const b = await makeListing("B");
    await wishlistService.addListing(userId, a.id);
    await wishlistService.addListing(userId, b.id);

    await wishlistService.removeListing(userId, a.id);
    const saved = await wishlistService.findForUser(userId);
    expect(saved).toHaveLength(1);
    expect(String(saved[0]._id)).toBe(String(b.id));
  });

  it("clear empties the wishlist", async () => {
    const a = await makeListing("A");
    await wishlistService.addListing(userId, a.id);
    await wishlistService.clear(userId);

    const saved = await wishlistService.findForUser(userId);
    expect(saved).toEqual([]);
    // wishlist doc still exists, just empty
    const doc = await Wishlist.findOne({ user: userId });
    expect(doc.listings).toHaveLength(0);
  });
});
