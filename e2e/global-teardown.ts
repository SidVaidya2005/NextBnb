import {
  deleteListing,
  fixtureAdmins,
  listingsOwnedByFixtureUser,
  setUserAdmin,
} from './fixtures'

/**
 * Removes any listing still owned by the Playwright fixture user.
 *
 * Every host spec already deletes its own rows in a `finally`, so on a green run
 * this finds nothing. It exists for the runs that are **not** green: when a spec
 * exceeds its timeout Playwright terminates it, and `finally` does not
 * necessarily get to run — which is how three draft listings survived the first
 * F09 suite and pushed the catalogue from 26 rows to 29.
 *
 * That matters beyond tidiness. `seed-verification.sql` asserts exact counts,
 * and `loadPublishedListings`/`loadDraftListings` exclude this user precisely so
 * host rows cannot shift a parallel worker's claim — a guarantee that is only as
 * good as the cleanup behind it.
 *
 * Photos cascade with the listing (`on delete cascade`), so they need no
 * separate pass. Cloudinary assets are never created by the suite: photo rows
 * are inserted directly by fixtures.
 */
export default async function globalTeardown() {
  const leaked = await listingsOwnedByFixtureUser()

  if (leaked.length > 0) {
    console.log(
      `[e2e/global-teardown] removing ${leaked.length} listing(s) left by an interrupted spec`,
    )

    for (const id of leaked) {
      await deleteListing(id)
    }
  }

  // The admin spec grants `is_admin` for one assertion and drops it in a
  // `finally`. A spec killed by a timeout never reaches that `finally` — the
  // exact failure mode that leaked three listings in F09 — and here the residue
  // is not an untidy row but a **standing admin account whose password is
  // committed to this repo**. Reset it unconditionally.
  const stillAdmin = await fixtureAdmins()
  if (stillAdmin.length > 0) {
    console.log(
      `[e2e/global-teardown] revoking is_admin left on ${stillAdmin.length} fixture account(s)`,
    )

    for (const id of stillAdmin) {
      await setUserAdmin(id, false)
    }
  }
}
