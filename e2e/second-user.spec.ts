import { test, expect } from '@playwright/test'

import { SECOND_AUTH_STATE_FILE } from './constants'
import {
  addFavorite,
  clearFavorites,
  createDraftListing,
  addListingPhotoRow,
  deleteListing,
  publishFixtureListing,
  readFavorites,
  secondUserId,
  testUserId,
} from './fixtures'

/**
 * The three gaps that one account structurally cannot reach.
 *
 * Every assertion here turns on the same fact: **RLS answers by who is asking**,
 * so proving it needs two principals. With a single fixture user the suite could
 * only ever ask one side of each question — and in each case the side it could
 * ask returns the *reassuring* answer, which is why none of these showed up as
 * failures for eleven features.
 *
 * `mode: 'serial'` is load-bearing, not stylistic. `playwright.config.ts` sets
 * `fullyParallel: true`, which parallelises tests **within** a file as well as
 * across them — and two of these specs assert on the second user's whole
 * favorites state, which a sibling running concurrently would be mutating. This
 * is the one file in the suite that owns global per-user state, and it owns it
 * by running alone.
 */
test.describe.configure({ mode: 'serial' })

test.use({ storageState: SECOND_AUTH_STATE_FILE })

test.describe('the second account', () => {
  test('sees the /favorites empty state when it has saved nothing', async ({
    page,
  }) => {
    const userId = await secondUserId()

    // The precondition is asserted, not assumed. This spec is only meaningful
    // if the account genuinely holds no rows; a stale favorite from an
    // interrupted run would make the empty state fail for a reason that has
    // nothing to do with the page.
    expect(await readFavorites(userId)).toEqual([])

    await page.goto('/favorites')

    await expect(
      page.getByRole('heading', { name: 'Favorites', level: 1 }),
    ).toBeVisible()
    await expect(page.getByText('No saved stays yet')).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Browse stays' }),
    ).toBeVisible()
    // The grid must be absent, not merely empty — an empty <ul> would render a
    // silent blank panel and still satisfy a text-only assertion.
    await expect(page.getByRole('list', { name: 'Saved stays' })).toHaveCount(0)
  })

  test('drops a favorite whose listing was unpublished by its host, and keeps the row', async ({
    page,
  }) => {
    const viewerId = await secondUserId()
    const hostId = await testUserId()

    // Hosted by the PRIMARY user and viewed by the second: that split is the
    // whole point. Unpublished by its own host, RLS hands the listing straight
    // back, so a single-account suite would see a populated embed and conclude
    // the drop was unnecessary. `min_nights` is 30 so a published fixture can
    // never move the exact counts search.spec.ts compares.
    const listing = await createDraftListing({
      hostId,
      isPublished: true,
      minNights: 30,
    })

    try {
      await addListingPhotoRow(listing.id, { position: 0, isCover: true })
      await addFavorite(viewerId, listing.id)

      // POSITIVE CONTROL. Without this, the assertion below passes just as
      // happily when the favorite was never created, when the title never
      // rendered, or when /favorites is broken outright — it would be measuring
      // the setup rather than the rule (F11's lesson).
      await page.goto('/favorites')
      await expect(
        page.getByRole('link', { name: listing.title }),
      ).toBeVisible()

      await publishFixtureListing(listing.id, false)

      await page.goto('/favorites')
      await expect(
        page.getByRole('link', { name: listing.title }),
      ).toHaveCount(0)

      // The distinction that makes this a null-EMBED test rather than a
      // deleted-row test: the favorite still exists. The page dropped it
      // because RLS returned `listings: null`, not because anything was removed.
      expect(await readFavorites(viewerId)).toContain(listing.id)

      // And the page still renders — `toFavoriteCards` filtering a null is the
      // only thing between this state and a crash on `listing.title`.
      await expect(
        page.getByRole('heading', { name: 'Favorites', level: 1 }),
      ).toBeVisible()
    } finally {
      await clearFavorites(viewerId, [listing.id])
      await deleteListing(listing.id)
    }
  })

  // The /admin route gate moved to `admin.spec.ts` at F17. It grants and revokes
  // `profiles.is_admin`, which is global per-user state, and the dashboard specs
  // need the same flag — two files flipping it would race under
  // `fullyParallel: true`, which orders nothing across files. One file owns it.
})
