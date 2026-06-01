const express = require("express");
const passport = require("../config/passport");
const env = require("../config/env");
const authController = require("../controllers/authController");
const {
  requireAuth,
  issueOAuthState,
  verifyOAuthState,
} = require("../middleware/auth");

const router = express.Router();

const oauthFailureRedirect = `${env.FRONTEND_URL}/login?error=oauth`;

router.get("/google", issueOAuthState, (req, res, next) =>
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    state: req.oauthState,
  })(req, res, next),
);
router.get(
  "/google/callback",
  verifyOAuthState,
  passport.authenticate("google", {
    session: false,
    failureRedirect: oauthFailureRedirect,
  }),
  authController.oauthCallback,
);

router.get("/me", requireAuth, authController.me);
router.post("/logout", authController.logout);

module.exports = router;
