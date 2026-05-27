const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../services/authService');

function requireAuth(req, _res, next) {
  // TODO: extract `Authorization: Bearer <jwt>` and attach req.user
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Missing or malformed Authorization header'));
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired token'));
  }
}

module.exports = { requireAuth };
