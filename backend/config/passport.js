const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const env = require("./env");
const { upsertOAuthUser } = require("../services/authService");

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await upsertOAuthUser(profile, "google");
          done(null, user);
        } catch (err) {
          done(err);
        }
      },
    ),
  );
}

module.exports = passport;
