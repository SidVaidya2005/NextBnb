const express = require("express");
const listingRoutes = require("./listingRoutes");
const authRoutes = require("./authRoutes");
const bookingRoutes = require("./bookingRoutes");
const wishlistRoutes = require("./wishlistRoutes");
const reviewRoutes = require("./reviewRoutes");
const uploadRoutes = require("./uploadRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/api/listings", listingRoutes);
router.use("/api/bookings", bookingRoutes);
router.use("/api/wishlist", wishlistRoutes);
router.use("/api/reviews", reviewRoutes);
router.use("/api/uploads", uploadRoutes);

module.exports = router;
