const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const passport = require("./config/passport");
const env = require("./config/env");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/error");

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
if (env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// Throttle every route to blunt brute-force / scraping. Skipped under test so
// the in-process suite isn't rate-limited.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test",
});
app.use(apiLimiter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use(routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
