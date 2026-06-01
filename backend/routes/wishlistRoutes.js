const express = require("express");
const wishlistController = require("../controllers/wishlistController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, wishlistController.index);
router.post("/:listingId", requireAuth, wishlistController.add);
router.delete("/:listingId", requireAuth, wishlistController.remove);

module.exports = router;
