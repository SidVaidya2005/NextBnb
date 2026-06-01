const asyncHandler = require("../utils/asyncHandler");

// TODO: wire to bookingService once business rules are decided.

const index = asyncHandler(async (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

const show = asyncHandler(async (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

const create = asyncHandler(async (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

const update = asyncHandler(async (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

const remove = asyncHandler(async (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

module.exports = { index, show, create, update, remove };
