const asyncHandler = require('../utils/asyncHandler');

// TODO: profile management endpoints (read/update own profile, public profile).

const me = asyncHandler(async (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

const updateMe = asyncHandler(async (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

module.exports = { me, updateMe };
