const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name }, env.JWT_SECRET, {
    expiresIn: '7d',
  });
}

function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

async function upsertOAuthUser(profile, provider) {
  // TODO: extract email + name + avatar from profile and upsert
  const filter = { provider, providerId: profile.id };
  const update = {
    provider,
    providerId: profile.id,
    email: profile.emails?.[0]?.value,
    name: profile.displayName,
    avatar: profile.photos?.[0]?.value,
  };
  return User.findOneAndUpdate(filter, update, { upsert: true, new: true });
}

module.exports = { signToken, verifyToken, upsertOAuthUser };
