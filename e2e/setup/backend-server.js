/* Self-contained backend for the e2e run: spins up an in-memory MongoDB, seeds
 * a known user + listings, then boots the real Express app against it. Owning
 * the database in-process means there's no cross-process ordering to coordinate
 * — Playwright just waits on /health. Configuration comes from the webServer
 * `env` block in playwright.config.ts (with dev-friendly fallbacks). */
const path = require("path");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

const BACKEND = path.join(__dirname, "..", "..", "backend");

const USER_ID = process.env.E2E_USER_ID || "e2e000000000000000000001";
const USER_EMAIL = process.env.E2E_USER_EMAIL || "e2e@example.com";
const USER_NAME = process.env.E2E_USER_NAME || "E2E Tester";
const SEED_COUNT = Number(process.env.E2E_SEED_COUNT || 15);
const PORT = Number(process.env.PORT || 8090);

async function main() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // Configure the backend BEFORE requiring it: config/env.js reads process.env
  // at load time, and dotenv won't override values already set here.
  process.env.NODE_ENV = "test"; // skips rate limiting; relaxes the JWT_SECRET boot guard
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-smoke-secret";
  process.env.PORT = String(PORT);
  process.env.FRONTEND_URL =
    process.env.FRONTEND_URL || "http://localhost:4321";

  await mongoose.connect(uri);
  const User = require(path.join(BACKEND, "models", "User"));
  const Listing = require(path.join(BACKEND, "models", "Listing"));

  await User.create({
    _id: USER_ID,
    provider: "google",
    providerId: "e2e-user",
    email: USER_EMAIL,
    name: USER_NAME,
  });
  await Listing.insertMany(
    Array.from({ length: SEED_COUNT }, (_, i) => ({
      title: `E2E Stay ${String(i + 1).padStart(2, "0")}`,
      price: 100 + i,
      location: "Testville",
      country: "Testland",
      categories: ["Villas"],
      owner: USER_ID,
    })),
  );

  const app = require(path.join(BACKEND, "app"));
  const server = app.listen(PORT, () => {
    console.log(`[e2e] backend listening on http://localhost:${PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await mongoose.disconnect().catch(() => {});
    await mongod.stop().catch(() => {});
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[e2e] backend failed to start", err);
  process.exit(1);
});
