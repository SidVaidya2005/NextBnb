const asyncHandler = require("../utils/asyncHandler");
const listingService = require("../services/listingService");

const index = asyncHandler(async (req, res) => {
  const listings = await listingService.findAll({
    location: req.query.where,
    category: req.query.category,
  });
  res.json(listings);
});

// The authed user's own listings (for the Profile "Your listings" section).
const mine = asyncHandler(async (req, res) => {
  const listings = await listingService.findByOwner(req.user.sub);
  res.json(listings);
});

const show = asyncHandler(async (req, res) => {
  const listing = await listingService.findById(req.params.id);
  res.json(listing);
});

const create = asyncHandler(async (req, res) => {
  const listing = await listingService.create({
    ...req.body,
    owner: req.user.sub,
  });
  res.status(201).json(listing);
});

const update = asyncHandler(async (req, res) => {
  const listing = await listingService.update(
    req.params.id,
    req.body,
    req.user.sub,
  );
  res.json(listing);
});

const remove = asyncHandler(async (req, res) => {
  await listingService.remove(req.params.id, req.user.sub);
  res.status(204).end();
});

module.exports = { index, mine, show, create, update, remove };
