const asyncHandler = require("../utils/asyncHandler");

// TODO: accept multer single/array file upload, push to cloudinaryService, return URL(s).

const create = asyncHandler(async (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

const remove = asyncHandler(async (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

module.exports = { create, remove };
