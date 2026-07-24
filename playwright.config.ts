import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Fails fast with a named cause if the database has not been seeded
  // (supabase/seed.sql), rather than letting every data-backed spec fail.
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Boots the app for the suite; reuses a running dev server locally.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
