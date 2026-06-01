const express = require("express");
const uploadController = require("../controllers/uploadController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/", requireAuth, uploadController.create);
router.delete("/:publicId", requireAuth, uploadController.remove);

module.exports = router;
