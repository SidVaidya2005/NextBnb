const express = require("express");
const reviewController = require("../controllers/reviewController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", reviewController.index);
router.post("/", requireAuth, reviewController.create);
router.get("/:id", reviewController.show);
router.delete("/:id", requireAuth, reviewController.remove);

module.exports = router;
