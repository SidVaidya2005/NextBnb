const asyncHandler = require("../utils/asyncHandler");
const listingService = require("../services/listingService");

const index = asyncHandler(async (_req, res) => {
  const listings = await listingService.findAll();
  res.json(listings);
});

const show = asyncHandler(async (req, res) => {
  const listing = await listingService.findById(req.params.id);
  res.json(listing);
});

const create = asyncHandler(async (req, res) => {
  const listing = await listingService.create(req.body);
  res.status(201).json(listing);
});

const update = asyncHandler(async (req, res) => {
  const listing = await listingService.update(req.params.id, req.body);
  res.json(listing);
});

const remove = asyncHandler(async (req, res) => {
  await listingService.remove(req.params.id);
  res.status(204).end();
});

module.exports = { index, show, create, update, remove };
