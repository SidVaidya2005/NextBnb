const asyncHandler = require("../utils/asyncHandler");
const cloudinaryService = require("../services/cloudinaryService");
const listingService = require("../services/listingService");
const ApiError = require("../utils/ApiError");

const FOLDER_PREFIX = `${cloudinaryService.FOLDER}/`;

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
  const { publicId } = req.params;
  // Confine deletes to our listings folder and reject path-traversal artifacts —
  // the `(*)` route param would otherwise accept any asset in the account.
  if (!publicId.startsWith(FOLDER_PREFIX) || publicId.includes("..")) {
    throw new ApiError(400, "Invalid image id");
  }
  // IDOR guard: only the owner of the listing that uses this image may delete it.
  const listing = await listingService.findByImagePublicId(
    publicId,
    req.user.sub,
  );
  if (!listing) {
    throw new ApiError(403, "You can only delete images on your own listings");
  }
  await cloudinaryService.deleteImage(publicId);
  res.status(204).end();
});

module.exports = { create, remove };
