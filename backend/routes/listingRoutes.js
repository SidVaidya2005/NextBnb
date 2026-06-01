const express = require("express");
const listingController = require("../controllers/listingController");

const router = express.Router();

router.get("/", listingController.index);
router.post("/", listingController.create);
router.get("/:id", listingController.show);
router.put("/:id", listingController.update);
router.delete("/:id", listingController.remove);

module.exports = router;
