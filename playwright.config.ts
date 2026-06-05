import { defineConfig, devices } from "@playwright/test";
import { E2E } from "./e2e/setup/env";

/* End-to-end smoke tests. Two webServers are booted automatically:
 *  - the backend bootstrap (in-memory Mongo, seeded), on :8090
 *  - the frontend via Vite in `e2e` mode (reads frontend/.env.e2e → :8090), on :4321
 * global-setup writes a logged-in storageState that every test reuses. */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  globalSetup: "./e2e/setup/global-setup.ts",
  use: {
    baseURL: E2E.FRONTEND_ORIGIN,
    storageState: E2E.STORAGE_STATE,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/setup/backend-server.js",
      url: `${E2E.BACKEND_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: "test",
        PORT: String(E2E.BACKEND_PORT),
        JWT_SECRET: E2E.JWT_SECRET,
        FRONTEND_URL: E2E.FRONTEND_ORIGIN,
        E2E_USER_ID: E2E.USER_ID,
        E2E_USER_EMAIL: E2E.USER_EMAIL,
        E2E_USER_NAME: E2E.USER_NAME,
        E2E_SEED_COUNT: String(E2E.SEED_COUNT),
      },
    },
    {
      command: `npx vite --mode e2e --port ${E2E.FRONTEND_PORT} --strictPort`,
      cwd: "frontend",
      url: E2E.FRONTEND_ORIGIN,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
