const express = require("express");
const listingController = require("../controllers/listingController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", listingController.index);
router.post("/", requireAuth, listingController.create);
router.get("/:id", listingController.show);
router.put("/:id", requireAuth, listingController.update);
router.delete("/:id", requireAuth, listingController.remove);

module.exports = router;
