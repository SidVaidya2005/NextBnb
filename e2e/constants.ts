import path from 'node:path'

/** Where auth.setup.ts stores the signed-in browser state. */
export const AUTH_STATE_FILE = path.join(__dirname, '.auth', 'user.json')

/** The second account's signed-in browser state. See SECOND_USER. */
export const SECOND_AUTH_STATE_FILE = path.join(__dirname, '.auth', 'second-user.json')

/**
 * The primary account the E2E suite signs in as. Provisioned automatically by
 * auth.setup.ts, so a fresh database needs no manual step. Deliberately not a
 * seed user: those are fixtures for public data, and none of them can sign in.
 */
export const TEST_USER = {
  email: 'e2e-tester@nextbnb.test',
  password: 'e2e-test-password-8f3a91',
  fullName: 'E2E Tester',
}

/**
 * A second signed-in account, provisioned the same way.
 *
 * It exists because three separate gaps are unreachable with one account, and
 * all three are the same shape — **RLS answers differently depending on who is
 * asking, and one account can only ever ask one of the two questions**:
 *
 * 1. `toFavoriteCards`' null-embed drop. A favorited listing that is later
 *    unpublished returns a null `listings` embed — but only to someone who is
 *    *not* its host. With one account, the only user who can sign in is always
 *    the host of anything it unpublishes, and RLS hands a draft straight back to
 *    its owner, so the embed is never null.
 * 2. `/favorites`' empty state. Asserting it needs a user whose favorites no
 *    parallel worker is writing to — impossible while every spec shares one account.
 * 3. `/admin`'s admin-side render. Flipping the *shared* user's `is_admin`
 *    mid-run would race auth.spec.ts's "no Admin entry for a non-admin".
 *
 * **This account is NOT a permanent admin.** The admin spec flips `is_admin` on
 * for the length of one assertion and off again, and global-teardown resets it
 * for the run that dies before its `finally` — because a standing admin whose
 * password is committed to the repo is a real privilege path, not a test detail.
 */
export const SECOND_USER = {
  email: 'e2e-second@nextbnb.test',
  password: 'e2e-second-password-4c7b26',
  fullName: 'E2E Second',
}
