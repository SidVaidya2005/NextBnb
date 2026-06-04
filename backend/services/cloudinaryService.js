const { v2: cloudinary } = require("cloudinary");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

// All listing photos live under one folder so they're easy to find/clean up in
// the Cloudinary console. The returned public_id keeps this prefix.
const FOLDER = "nextbnb/listings";

// Cloudinary creds are optional in dev/test/CI. Reading them live (rather than
// once at load) lets tests toggle config without re-importing the module.
function isConfigured() {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME &&
    env.CLOUDINARY_API_KEY &&
    env.CLOUDINARY_API_SECRET,
  );
}

// Streams an in-memory file buffer (from multer's memoryStorage) to Cloudinary.
// Resolves with the hosted URL plus the publicId needed to delete it later.
async function uploadImage(file) {
  if (!isConfigured()) {
    throw new ApiError(501, "Image upload is not configured");
  }
  if (!file || !file.buffer) {
    throw new ApiError(400, "No image file provided");
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: FOLDER, resource_type: "image" },
      (err, result) => {
        if (err || !result) {
          return reject(new ApiError(502, "Image upload failed"));
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(file.buffer);
  });
}

async function deleteImage(publicId) {
  if (!isConfigured()) {
    throw new ApiError(501, "Image upload is not configured");
  }
  if (!publicId) {
    throw new ApiError(400, "publicId is required");
  }

  const result = await cloudinary.uploader.destroy(publicId);
  // Treat an already-gone asset as success so deletes are idempotent.
  if (result.result !== "ok" && result.result !== "not found") {
    throw new ApiError(502, "Image deletion failed");
  }
  return { deleted: true, publicId };
}

module.exports = { uploadImage, deleteImage, isConfigured };
