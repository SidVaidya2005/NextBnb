import { deleteListing, listingsOwnedByFixtureUser } from './fixtures'

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
  if (leaked.length === 0) return

  console.log(
    `[e2e/global-teardown] removing ${leaked.length} listing(s) left by an interrupted spec`,
  )

  for (const id of leaked) {
    await deleteListing(id)
  }
}
