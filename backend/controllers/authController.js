const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const { signToken } = require('../services/authService');

const oauthCallback = asyncHandler(async (req, res) => {
  // req.user is set by passport's verify callback after a successful OAuth exchange.
  const token = signToken(req.user);
  res.redirect(`${env.FRONTEND_URL}/oauth?token=${encodeURIComponent(token)}`);
});

const me = asyncHandler(async (req, res) => {
  res.json(req.user);
});

const logout = asyncHandler(async (_req, res) => {
  // Stateless: client discards the JWT. Endpoint exists for symmetry.
  res.status(204).end();
});

module.exports = { oauthCallback, me, logout };
