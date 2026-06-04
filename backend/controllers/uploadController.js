const asyncHandler = require("../utils/asyncHandler");
const cloudinaryService = require("../services/cloudinaryService");
const ApiError = require("../utils/ApiError");

// multer (uploadSingle) parses the multipart body and puts the file on req.file.
const create = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "No image file provided");
  }
  const { url, publicId } = await cloudinaryService.uploadImage(req.file);
  res.status(201).json({ url, publicId });
});

// publicId may contain the Cloudinary folder, e.g. "nextbnb/listings/abc".
const remove = asyncHandler(async (req, res) => {
  await cloudinaryService.deleteImage(req.params.publicId);
  res.status(204).end();
});

module.exports = { create, remove };
