const asyncHandler = require("../utils/asyncHandler");
const wishlistService = require("../services/wishlistService");

const index = asyncHandler(async (req, res) => {
  const listings = await wishlistService.findForUser(req.user.sub);
  res.json(listings);
});

const add = asyncHandler(async (req, res) => {
  const listings = await wishlistService.addListing(
    req.user.sub,
    req.params.listingId,
  );
  res.status(201).json(listings);
});

const remove = asyncHandler(async (req, res) => {
  const listings = await wishlistService.removeListing(
    req.user.sub,
    req.params.listingId,
  );
  res.json(listings);
});

module.exports = { index, add, remove };
