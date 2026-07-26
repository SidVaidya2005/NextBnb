import { test as setup } from '@playwright/test'

import {
  AUTH_STATE_FILE,
  SECOND_AUTH_STATE_FILE,
  SECOND_USER,
} from './constants'
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

/**
 * The same, for the second account.
 *
 * Kept as a separate storageState rather than a second session for the same
 * user: the point of this account is to be a *different* principal, so that RLS
 * is asked the question one account structurally cannot ask (see SECOND_USER).
 */
setup('authenticate the second test user', async ({ context }) => {
  await context.addCookies(await mintSessionCookies(SECOND_USER))
  await context.storageState({ path: SECOND_AUTH_STATE_FILE })
})
