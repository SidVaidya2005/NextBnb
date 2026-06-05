const express = require("express");
const uploadController = require("../controllers/uploadController");
const { requireAuth } = require("../middleware/auth");
const { uploadSingle } = require("../middleware/upload");

const router = express.Router();

router.post("/", requireAuth, uploadSingle, uploadController.create);
// The `(*)` capture keeps the slashes in a Cloudinary publicId such as
// "nextbnb/listings/abc" that a bare `:publicId` would split on.
router.delete("/:publicId(*)", requireAuth, uploadController.remove);

module.exports = router;
