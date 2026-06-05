import path from "path";

const BACKEND_PORT = 8090;
const FRONTEND_PORT = 4321;

// Single source of truth for the e2e harness. The Playwright config passes the
// secret/user values into the backend bootstrap via the webServer `env`, and
// global-setup signs a JWT with the same secret so the browser starts logged in.
// Paths are anchored to the repo root (Playwright runs from the config's dir).
export const E2E = {
  USER_ID: "e2e000000000000000000001",
  USER_EMAIL: "e2e@example.com",
  USER_NAME: "E2E Tester",
  JWT_SECRET: "e2e-smoke-secret",
  SEED_COUNT: 15,
  BACKEND_PORT,
  BACKEND_URL: `http://localhost:${BACKEND_PORT}`,
  FRONTEND_PORT,
  FRONTEND_ORIGIN: `http://localhost:${FRONTEND_PORT}`,
  STORAGE_STATE: path.join(
    process.cwd(),
    "e2e",
    "setup",
    ".auth",
    "state.json",
  ),
} as const;
