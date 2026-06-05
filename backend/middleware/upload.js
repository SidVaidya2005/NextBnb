const multer = require("multer");
const ApiError = require("../utils/ApiError");

// Listing photos are streamed straight to Cloudinary, so we keep the file in
// memory rather than writing to disk. Tune both constants in one place.
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
    cb(
      new ApiError(400, "Unsupported image type — use JPEG, PNG, WebP, or GIF"),
    );
  },
});

// Single file under the `image` field — matches the listing form / upload API
// contract. multer puts the parsed file on `req.file`.
const uploadSingle = upload.single("image");

module.exports = { uploadSingle, MAX_BYTES, ALLOWED_MIME };
