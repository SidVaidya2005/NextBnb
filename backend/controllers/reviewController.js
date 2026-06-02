const asyncHandler = require("../utils/asyncHandler");
const reviewService = require("../services/reviewService");

const index = asyncHandler(async (req, res) => {
  const { listingId } = req.query;
  const reviews = await reviewService.findForListing(listingId);
  res.json(reviews);
});

const show = asyncHandler(async (req, res) => {
  const review = await reviewService.findById(req.params.id);
  res.json(review);
});

const create = asyncHandler(async (req, res) => {
  const review = await reviewService.create({
    ...req.body,
    author: req.user.sub,
  });
  res.status(201).json(review);
});

const remove = asyncHandler(async (req, res) => {
  await reviewService.remove(req.params.id, req.user.sub);
  res.status(204).end();
});

module.exports = { index, show, create, remove };
