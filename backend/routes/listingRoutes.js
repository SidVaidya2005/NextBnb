const express = require("express");
const listingController = require("../controllers/listingController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", listingController.index);
// Must precede "/:id" so "mine" isn't swallowed as an :id param.
router.get("/mine", requireAuth, listingController.mine);
router.post("/", requireAuth, listingController.create);
router.get("/:id", listingController.show);
router.put("/:id", requireAuth, listingController.update);
router.delete("/:id", requireAuth, listingController.remove);

module.exports = router;
