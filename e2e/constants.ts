import path from 'node:path'

/** Where auth.setup.ts stores the signed-in browser state. */
export const AUTH_STATE_FILE = path.join(__dirname, '.auth', 'user.json')

/**
 * The one account the E2E suite signs in as. Provisioned automatically by
 * auth.setup.ts, so a fresh database needs no manual step. Deliberately not a
 * seed user: those are fixtures for public data, and none of them can sign in.
 */
export const TEST_USER = {
  email: 'e2e-tester@nextbnb.test',
  password: 'e2e-test-password-8f3a91',
  fullName: 'E2E Tester',
}
