const asyncHandler = require("../utils/asyncHandler");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const User = require("../models/User");
const { signToken } = require("../services/authService");

const oauthCallback = asyncHandler(async (req, res) => {
  const token = signToken(req.user);
  res.redirect(`${env.FRONTEND_URL}/oauth?token=${encodeURIComponent(token)}`);
});

const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.sub);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  res.json(user);
});

const logout = asyncHandler(async (_req, res) => {
  res.status(204).end();
});

module.exports = { oauthCallback, me, logout };
