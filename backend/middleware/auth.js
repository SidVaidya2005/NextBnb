const crypto = require("crypto");
const ApiError = require("../utils/ApiError");
const env = require("../config/env");
const { verifyToken } = require("../services/authService");

const OAUTH_STATE_COOKIE = "oauth_state";

function requireAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(new ApiError(401, "Missing or malformed Authorization header"));
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(new ApiError(401, "Invalid or expired token"));
  }
}

// Generates a random CSRF `state`, stashes it in an httpOnly cookie, and exposes
// it on req for the provider redirect. `sameSite: 'lax'` is required so the cookie
// survives the top-level navigation back from the OAuth provider.
function issueOAuthState(req, res, next) {
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 10 * 60 * 1000,
  });
  req.oauthState = state;
  next();
}

// Verifies the `state` echoed back by the provider matches the cookie we set.
// Runs before passport, so a forged/missing state is rejected even when the
// provider strategy isn't registered (e.g. no client ID configured).
function verifyOAuthState(req, res, next) {
  const cookieState = req.cookies?.[OAUTH_STATE_COOKIE];
  res.clearCookie(OAUTH_STATE_COOKIE);
  if (!req.query.state || !cookieState || req.query.state !== cookieState) {
    return res.redirect(`${env.FRONTEND_URL}/login?error=oauth_state`);
  }
  return next();
}

module.exports = { requireAuth, issueOAuthState, verifyOAuthState };
