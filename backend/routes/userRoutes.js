const express = require("express");
const userController = require("../controllers/userController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/me", requireAuth, userController.me);
router.patch("/me", requireAuth, userController.updateMe);

module.exports = router;
