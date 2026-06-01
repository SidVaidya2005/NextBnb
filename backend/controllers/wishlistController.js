const asyncHandler = require("../utils/asyncHandler");

// TODO: wire to wishlistService once schema is finalized.

const index = asyncHandler(async (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

const add = asyncHandler(async (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

const remove = asyncHandler(async (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

module.exports = { index, add, remove };
