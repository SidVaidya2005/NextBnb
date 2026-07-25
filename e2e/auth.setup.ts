import { test as setup } from '@playwright/test'

import { AUTH_STATE_FILE } from './constants'
import { mintSessionCookies } from './session'

/**
 * Saves a signed-in browser state that every "signed in" spec reuses via
 * `test.use({ storageState: AUTH_STATE_FILE })`.
 *
 * Specs that SIGN OUT must not use this shared state — logging out deletes the
 * session row server-side for every worker holding it. Those call
 * `mintSessionCookies()` directly to get an independent session (see auth.spec.ts).
 */
setup('authenticate a test user', async ({ context }) => {
  await context.addCookies(await mintSessionCookies())
  await context.storageState({ path: AUTH_STATE_FILE })
})
