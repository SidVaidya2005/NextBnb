import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Fails fast with a named cause if the database has not been seeded
  // (supabase/seed.sql), rather than letting every data-backed spec fail.
  globalSetup: './e2e/global-setup.ts',
  // Sweeps up listings left behind when a spec is killed by a timeout, before
  // its own `finally` cleanup could run (see e2e/global-teardown.ts).
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    // Provisions the test user and saves a signed-in storageState.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      // Stays SIGNED OUT by default so the public surface is what specs see;
      // a spec that needs a session opts in with
      // `test.use({ storageState: AUTH_STATE_FILE })`.
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  // Boots the app for the suite; reuses a running dev server locally.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
