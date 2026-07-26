import { test, expect, type Locator, type Page } from '@playwright/test'

import { AUTH_STATE_FILE } from './constants'
import {
  addDay,
  addListingPhotoRow,
  createBookingRow,
  createDraftListing,
  deleteListing,
  loadPublishedListings,
  publishFixtureListing,
  readBookings,
  readListing,
  readListingPhotos,
  todayISO,
} from './fixtures'

/**
 * Managing an existing listing (F10) — the grid, the editor, publish/unpublish
 * and delete.
 *
 * Every spec cleans up the rows it made. The suite runs `fullyParallel: true`
 * against one shared account, so specs assert on **their own** listing's title
 * rather than on any count of the page — a sibling worker legitimately has
 * listings of its own on this screen.
 *
 * **A published fixture listing needs `minNights` above any window a search
 * spec queries.** `search.spec.ts` compares an exact count against an
 * independently computed expectation, and `loadSeedSnapshot` reads every
 * published listing — so a fixture listing that is bookable for those dates
 * fails that spec in another worker with nothing to point at. 30 nights keeps
 * it out of both sides.
 */

const SAFE_MIN_NIGHTS = 30

/** A city no other spec queries, so a city-filtered search returns only this one. */
function uniqueCity(): string {
  return `Testerton${crypto.randomUUID().slice(0, 8)}`
}

const ownListings = (page: Page) =>
  page.getByRole('list', { name: 'Your listings' })

const editForm = (page: Page) => page.getByRole('form', { name: 'Edit your listing' })

/**
 * Waits until React owns this element, not just the server's HTML.
 *
 * **Every spec here that clicks before hydration is a false result, and two of
 * them were.** Before hydration a `type="button"` click does nothing at all (no
 * handler is attached yet), and a value typed into a field React is about to
 * re-assert from `defaultValues` is silently reverted — so clearing the title
 * and submitting *saved the original title and navigated away*, which looked
 * exactly like "the editor accepts a blank title". Neither failure mode is
 * visible in the markup, and both go away on a slower machine, which is the
 * definition of a flake that would have been blamed on the app.
 *
 * React attaches a `__reactProps$…` key to every host node it hydrates. That is
 * an internal, but it is the direct signal — far better than sleeping and
 * hoping, which is what the alternative amounts to.
 */
async function waitForHydration(locator: Locator) {
  await expect
    .poll(
      () =>
        locator
          .first()
          .evaluate((element) =>
            Object.keys(element).some((key) => key.startsWith('__reactProps$')),
          ),
      { message: 'React never hydrated this element' },
    )
    .toBe(true)
}

async function waitForOwnListings(page: Page) {
  // Race the list against the empty state: waiting only for the list would hang
  // for the full timeout on a host who legitimately has nothing (F06's lesson).
  await Promise.race([
    ownListings(page).waitFor(),
    page.getByText('You have not listed a place yet').waitFor(),
  ])

  // Every control on this screen is a client button; without this the first
  // click can land on server HTML and do nothing.
  const anyRow = ownListings(page).getByRole('listitem').first()
  if (await anyRow.count()) await waitForHydration(anyRow.getByRole('button').first())
}

/** The editor, waited on until its fields will actually keep what is typed. */
async function openEditor(page: Page, listingId: string): Promise<Locator> {
  await page.goto(`/host/listings/${listingId}/edit`)

  const form = page.getByRole('form', { name: 'Edit your listing' })
  await form.waitFor()
  await waitForHydration(form)

  return form
}

test.describe('signed out', () => {
  test('the proxy guards the listings route', async ({ page }) => {
    await page.goto('/host/listings')

    await expect(page).toHaveURL(/signin=required/)
    await expect(page).toHaveURL(/next=%2Fhost%2Flistings/)
  })

  test('the proxy guards the edit route', async ({ page }) => {
    const listing = await createDraftListing()

    try {
      await page.goto(`/host/listings/${listing.id}/edit`)
      await expect(page).toHaveURL(/signin=required/)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('an unpublished listing is invisible; publishing reveals it', async ({
    page,
  }) => {
    // The state change is made by fixtures rather than through the UI, so this
    // asserts what RLS does about visibility without racing a sign-in.
    const city = uniqueCity()
    const listing = await createDraftListing({ city, minNights: SAFE_MIN_NIGHTS })

    try {
      await page.goto(`/?city=${city}`)
      await expect(page.getByText('No stays match your search')).toBeVisible()

      const draft = await page.request.get(`/listings/${listing.id}`)
      expect(draft.status()).toBe(404)

      await addListingPhotoRow(listing.id, { isCover: true })
      await publishFixtureListing(listing.id, true)

      await page.goto(`/?city=${city}`)
      await expect(
        page.getByRole('list', { name: 'Stays' }).getByText(listing.title),
      ).toBeVisible()

      const published = await page.request.get(`/listings/${listing.id}`)
      expect(published.status()).toBe(200)
    } finally {
      await deleteListing(listing.id)
    }
  })
})

test.describe('signed in', () => {
  test.use({ storageState: AUTH_STATE_FILE })

  test('lists the host’s own listings and never anybody else’s', async ({ page }) => {
    const mine = await createDraftListing()
    const [seeded] = await loadPublishedListings()

    try {
      await page.goto('/host/listings')
      await waitForOwnListings(page)

      await expect(ownListings(page).getByText(mine.title)).toBeVisible()
      // The gate: drop `host_id` from getOwnListings and this is what fails.
      await expect(ownListings(page).getByText(seeded.title)).toHaveCount(0)
    } finally {
      await deleteListing(mine.id)
    }
  })

  test('badges a draft, and drops the badge once it is published', async ({
    page,
  }) => {
    const listing = await createDraftListing()

    try {
      await addListingPhotoRow(listing.id, { isCover: true })
      await page.goto('/host/listings')
      await waitForOwnListings(page)

      const row = rowFor(page, listing.title)
      // `exact` matters: getByText is a case-insensitive substring match, and
      // the fixture titles literally read "E2E draft <hex>". Sixth time this
      // project has met a locator coupled to text outside the thing under test.
      await expect(row.getByText('Draft', { exact: true })).toBeVisible()

      await row.getByRole('button', { name: `Publish ${listing.title}` }).click()
      await expect(
        row.getByRole('button', { name: `Unpublish ${listing.title}` }),
      ).toBeVisible()

      expect((await readListing(listing.id))?.isPublished).toBe(true)
      await expect(row.getByText('Draft', { exact: true })).toHaveCount(0)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('publishing from the grid is refused without a photo, and says why', async ({
    page,
  }) => {
    const listing = await createDraftListing()

    try {
      await page.goto('/host/listings')
      await waitForOwnListings(page)

      const row = rowFor(page, listing.title)
      await row.getByRole('button', { name: `Publish ${listing.title}` }).click()

      await expect(row.getByRole('alert')).toHaveText(
        'Add at least one photo before publishing.',
      )
      // The oracle is the table: the message could be right and the write wrong.
      expect((await readListing(listing.id))?.isPublished).toBe(false)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('unpublishing takes a live listing out of search and back', async ({
    page,
  }) => {
    const city = uniqueCity()
    const listing = await createDraftListing({ city, minNights: SAFE_MIN_NIGHTS })

    try {
      await addListingPhotoRow(listing.id, { isCover: true })
      await publishFixtureListing(listing.id, true)

      await page.goto('/host/listings')
      await waitForOwnListings(page)

      const row = rowFor(page, listing.title)
      await row.getByRole('button', { name: `Unpublish ${listing.title}` }).click()
      // `exact` is load-bearing: getByRole matches the accessible name as a
      // SUBSTRING by default, so "Publish <title>" also matches the *Unpublish*
      // button that is still on screen. Without it this resolves instantly
      // against the pre-click state and asserts nothing — F08's trap exactly,
      // and the database oracle two lines down is what exposed it.
      await expect(
        row.getByRole('button', { name: `Publish ${listing.title}`, exact: true }),
      ).toBeVisible()

      expect((await readListing(listing.id))?.isPublished).toBe(false)

      await page.goto(`/?city=${city}`)
      await expect(page.getByText('No stays match your search')).toBeVisible()
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('editing saves the change, and the database agrees', async ({ page }) => {
    const listing = await createDraftListing()
    const newTitle = `Edited ${crypto.randomUUID().slice(0, 8)}`

    try {
      const form = await openEditor(page, listing.id)
      await expect(form.getByLabel('Title')).toHaveValue(listing.title)

      await form.getByLabel('Title').fill(newTitle)
      await form.getByLabel('Price per night (USD)').fill('249')
      await form.getByLabel('Description').fill('Now with a description.')
      await form.getByLabel('Minimum nights').fill('3')
      await form.getByRole('button', { name: 'Save changes' }).click()

      await expect(page).toHaveURL(/\/host\/listings$/)

      // The oracle is the table, never the page that produced the write.
      const row = await readListing(listing.id)
      expect(row?.title).toBe(newTitle)
      // Dollars in the form, integer cents in the column.
      expect(row?.pricePerNightCents).toBe(24_900)
      expect(row?.description).toBe('Now with a description.')
      expect(row?.minNights).toBe(3)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('the editor opens on the stored values, blanks and all', async ({ page }) => {
    // A listing with every optional column null — the case that made the form go
    // uncontrolled before `toListingFormValues` mapped null to ''.
    const listing = await createDraftListing()

    try {
      const form = await openEditor(page, listing.id)
      await expect(form.getByLabel('Description')).toHaveValue('')
      await expect(form.getByLabel('State or region')).toHaveValue('')
      await expect(form.getByLabel('House rules')).toHaveValue('')
      // 12300 cents, and it must come back as dollars or a save would move it.
      await expect(form.getByLabel('Price per night (USD)')).toHaveValue('123')
      await expect(form.getByLabel('Guests')).toHaveValue('4')
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a round trip through the editor leaves the price untouched', async ({
    page,
  }) => {
    const listing = await createDraftListing()

    try {
      const form = await openEditor(page, listing.id)
      await form.getByRole('button', { name: 'Save changes' }).click()
      await expect(page).toHaveURL(/\/host\/listings$/)

      // Opening the editor and saving without touching anything must not move a
      // single stored value — the cents/dollars crossing happens twice here.
      const row = await readListing(listing.id)
      expect(row?.pricePerNightCents).toBe(12_300)
      expect(row?.title).toBe(listing.title)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('the editor rejects an invalid change without writing', async ({ page }) => {
    const listing = await createDraftListing()

    try {
      const form = await openEditor(page, listing.id)
      await form.getByLabel('Title').fill('')
      await form.getByRole('button', { name: 'Save changes' }).click()

      await expect(form.getByText('Give your place a title.')).toBeVisible()
      expect((await readListing(listing.id))?.title).toBe(listing.title)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('the editor 404s for a listing this user does not host', async ({ page }) => {
    const [seeded] = await loadPublishedListings()

    const response = await page.request.get(`/host/listings/${seeded.id}/edit`)
    expect(response.status()).toBe(404)
  })

  test('the editor 404s for a malformed id', async ({ page }) => {
    const response = await page.request.get('/host/listings/not-a-uuid/edit')
    expect(response.status()).toBe(404)
  })

  test('deleting removes the listing and its photo rows', async ({ page }) => {
    const listing = await createDraftListing()
    await addListingPhotoRow(listing.id, { isCover: true })
    await addListingPhotoRow(listing.id, { position: 1 })

    let deleted = false
    try {
      await page.goto('/host/listings')
      await waitForOwnListings(page)

      const row = rowFor(page, listing.title)
      await row.getByRole('button', { name: `Delete ${listing.title}` }).click()
      // Two steps, in place — no dialog to handle, and nothing destructive
      // happens on the first click.
      await row.getByRole('button', { name: `Confirm deleting ${listing.title}` }).click()

      await expect(ownListings(page).getByText(listing.title)).toHaveCount(0)

      expect(await readListing(listing.id)).toBeNull()
      expect(await readListingPhotos(listing.id)).toHaveLength(0)
      deleted = true
    } finally {
      if (!deleted) await deleteListing(listing.id)
    }
  })

  test('the first click only asks — cancelling deletes nothing', async ({ page }) => {
    const listing = await createDraftListing()

    try {
      await page.goto('/host/listings')
      await waitForOwnListings(page)

      const row = rowFor(page, listing.title)
      await row.getByRole('button', { name: `Delete ${listing.title}` }).click()
      await row.getByRole('button', { name: `Keep ${listing.title}` }).click()

      await expect(
        row.getByRole('button', { name: `Delete ${listing.title}` }),
      ).toBeVisible()
      expect(await readListing(listing.id)).not.toBeNull()
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a coming stay disables deleting, and says why', async ({ page }) => {
    const listing = await createDraftListing()
    // Confirmed and in the future: cascading the delete would erase it outright
    // — no cancellation, no cancelled_at, nothing left in the guest's Trips.
    await createBookingRow(listing.id, {
      checkIn: addDay(todayISO(), 20),
      checkOut: addDay(todayISO(), 24),
    })

    try {
      await page.goto('/host/listings')
      await waitForOwnListings(page)

      const row = rowFor(page, listing.title)

      // Disabled AND explained — a dead control with no reason is what users
      // report as broken.
      await expect(
        row.getByRole('button', { name: `Delete ${listing.title}`, exact: true }),
      ).toBeDisabled()
      await expect(
        row.getByText('This listing has upcoming reservations. Unpublish it instead.'),
      ).toBeVisible()

      expect(await readListing(listing.id)).not.toBeNull()
      expect(await readBookings(listing.id)).toHaveLength(1)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('the action refuses even when the page thinks deleting is allowed', async ({
    page,
  }) => {
    // The disabled button is a courtesy; the refusal that matters is in the
    // action. Reaching it means the client's `canDelete` must be *stale* — so
    // the booking arrives while the host is deciding, which is also the real
    // race (a guest reserving between the render and the click).
    //
    // Deliberately not "re-enable the button from the DOM": React owns that
    // attribute and restores it on its next render, so that version of this
    // test hangs waiting for a control it cannot click.
    const listing = await createDraftListing()

    try {
      await page.goto('/host/listings')
      await waitForOwnListings(page)

      const row = rowFor(page, listing.title)
      await expect(
        row.getByRole('button', { name: `Delete ${listing.title}`, exact: true }),
      ).toBeEnabled()
      await row.getByRole('button', { name: `Delete ${listing.title}`, exact: true }).click()

      await createBookingRow(listing.id, {
        checkIn: addDay(todayISO(), 20),
        checkOut: addDay(todayISO(), 24),
      })

      await row.getByRole('button', { name: `Confirm deleting ${listing.title}` }).click()

      await expect(row.getByRole('alert')).toHaveText(
        'This listing has upcoming reservations. Unpublish it instead.',
      )

      // The listing is still here and, more to the point, so is the stay the
      // cascade would have erased without a trace.
      expect(await readListing(listing.id)).not.toBeNull()
      expect(await readBookings(listing.id)).toHaveLength(1)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a cancelled or finished stay does not block deleting', async ({ page }) => {
    const listing = await createDraftListing()
    await createBookingRow(listing.id, {
      checkIn: addDay(todayISO(), 30),
      checkOut: addDay(todayISO(), 34),
      status: 'cancelled',
    })

    let deleted = false
    try {
      await page.goto('/host/listings')
      await waitForOwnListings(page)

      const row = rowFor(page, listing.title)
      // A cancelled booking frees its dates and holds nobody's plans.
      await expect(
        row.getByRole('button', { name: `Delete ${listing.title}` }),
      ).toBeEnabled()

      await row.getByRole('button', { name: `Delete ${listing.title}` }).click()
      await row.getByRole('button', { name: `Confirm deleting ${listing.title}` }).click()

      await expect(ownListings(page).getByText(listing.title)).toHaveCount(0)
      expect(await readListing(listing.id)).toBeNull()
      deleted = true
    } finally {
      if (!deleted) await deleteListing(listing.id)
    }
  })
})

/** The card for one listing, scoped by its (unique) title. */
function rowFor(page: Page, title: string) {
  return ownListings(page).getByRole('listitem').filter({ hasText: title })
}

