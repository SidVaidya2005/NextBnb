import { test, expect, type Page } from '@playwright/test'
import { pickDay, revealDay } from './calendar'
import { AUTH_STATE_FILE } from './constants'
import {
  addDay,
  addListingPhotoRow,
  createBlockedDateRow,
  createBookingRow,
  createDraftListing,
  deleteListing,
  loadPublishedListings,
  publishFixtureListing,
  readBlockedDates,
  readBookings,
  todayISO,
} from './fixtures'
import { waitForHydration } from './hydration'

/**
 * Host-managed availability (F11) — the calendar, blocking, unblocking, and the
 * guards behind them.
 *
 * **Every assertion about what was written reads the table, not the page.** A
 * calendar that renders "Aug 18 – 23" perfectly can still have stored
 * `end_date = 2026-08-24`: the inclusive/half-open crossing is the one place
 * this feature can be wrong while looking entirely right, so `readBlockedDates`
 * is the oracle throughout.
 *
 * Specs assert on **their own** listing's rows rather than on any count, because
 * the suite is `fullyParallel` against one shared account.
 */

/** Keeps a published fixture listing out of every search spec's window — F10's
 *  fix, still load-bearing: `search.spec.ts` compares an exact count against an
 *  independently computed expectation over every published listing. */
const SAFE_MIN_NIGHTS = 30

/** A city no other spec queries, so a city-filtered search returns only ours. */
function uniqueCity(): string {
  return `Blockton${crypto.randomUUID().slice(0, 8)}`
}

const blockButton = (page: Page) =>
  page.getByRole('button', { name: 'Block these dates', exact: true })

/**
 * The error line, scoped to the section that owns it.
 *
 * A bare `getByRole('alert')` also matches Next's `__next-route-announcer__`,
 * which carries `role="alert"` on every page and is empty — a strict-mode
 * violation whose message reads like the app never rendered anything. That is
 * the **seventh** time this project has met a locator coupled to something
 * outside the thing under test (F05's `getByText('0.0')` matching prices, F07's
 * `circle-user-round` counting the nav, F08's `input[name="next"]` matching
 * hearts, F09's `getByLabel('Guests')` matching the SearchBar, F10's
 * `getByText('Draft')` matching fixture titles). Scoping is also why the section
 * carries an `aria-labelledby` in the first place.
 */
const blockError = (page: Page) =>
  page.getByRole('region', { name: 'Block dates', exact: true }).getByRole('alert')

async function openAvailability(page: Page, listingId: string) {
  await page.goto(`/host/listings/${listingId}/availability`)
  await blockButton(page).waitFor()
  // Every control here is a client button. Clicking before React attaches lands
  // on server HTML and silently does nothing (F10).
  await waitForHydration(blockButton(page))
}

test.describe('signed out', () => {
  test('the proxy guards the availability route', async ({ page }) => {
    const listing = await createDraftListing()

    try {
      await page.goto(`/host/listings/${listing.id}/availability`)

      await expect(page).toHaveURL(/signin=required/)
      await expect(page).toHaveURL(/next=%2Fhost%2Flistings/)
    } finally {
      await deleteListing(listing.id)
    }
  })
})

test.describe('signed in', () => {
  test.use({ storageState: AUTH_STATE_FILE })

  test('blocking a range stores it with both ends inclusive', async ({ page }) => {
    const listing = await createDraftListing()
    const start = addDay(todayISO(), 10)
    const end = addDay(todayISO(), 15)

    try {
      await openAvailability(page, listing.id)

      await pickDay(page, start)
      await pickDay(page, end)
      await blockButton(page).click()

      // The database, not the page: the end day must be stored as picked, not
      // pushed out a day to match the half-open model bookings use.
      await expect
        .poll(() => readBlockedDates(listing.id))
        .toEqual([expect.objectContaining({ startDate: start, endDate: end })])

      await expect(page.getByRole('button', { name: /^Unblock/ })).toHaveCount(1)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('clicking one day twice blocks a single night', async ({ page }) => {
    // The `bounds="inclusive"` proof. A stay cannot be zero nights, so the
    // half-open picker restarts on a second click of the same day; a block of
    // one night is ordinary, and the table's own constraint is `end >= start`.
    const listing = await createDraftListing()
    const day = addDay(todayISO(), 12)

    try {
      await openAvailability(page, listing.id)

      await pickDay(page, day)
      await pickDay(page, day)
      await blockButton(page).click()

      await expect
        .poll(() => readBlockedDates(listing.id))
        .toEqual([expect.objectContaining({ startDate: day, endDate: day })])
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('unblocking removes only that range', async ({ page }) => {
    const listing = await createDraftListing()
    const keep = { startDate: addDay(todayISO(), 5), endDate: addDay(todayISO(), 7) }
    const drop = { startDate: addDay(todayISO(), 20), endDate: addDay(todayISO(), 22) }

    try {
      await createBlockedDateRow(listing.id, keep)
      await createBlockedDateRow(listing.id, drop)

      await openAvailability(page, listing.id)
      await expect(page.getByRole('button', { name: /^Unblock/ })).toHaveCount(2)

      // Located by position, not by rebuilding the label. The list is sorted by
      // start date, so the later range is second — and a spec that reconstructs
      // "Aug 15 – 17" by hand would silently stop matching on the ~2 days a
      // month where the two ends straddle a month boundary and the component
      // correctly renders "Jul 31 – Aug 2" instead. The database below is the
      // oracle for *which* range went.
      await page.getByRole('button', { name: /^Unblock/ }).nth(1).click()

      await expect
        .poll(() => readBlockedDates(listing.id))
        .toEqual([expect.objectContaining(keep)])
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a booked night cannot be selected, but its checkout day can', async ({
    page,
  }) => {
    // The half-open proof at the surface a host actually touches. A stay running
    // check-in -> check-out occupies every night up to the day *before*
    // check-out, so the checkout day is free for a block — exactly as the
    // exclusion constraint permits a same-day turnover.
    const listing = await createDraftListing()
    const checkIn = addDay(todayISO(), 10)
    const checkOut = addDay(todayISO(), 14)

    try {
      await createBookingRow(listing.id, { checkIn, checkOut })
      await openAvailability(page, listing.id)

      // `revealDay`, not a bare `dayCell`: these dates are today + 10…14, so on
      // the last ~16 days of any month they fall into the *next* month, which
      // `DateRangePicker` does not render without navigation. This is the exact
      // bug F17 found and fixed in `host-availability-responsive.spec.ts`; these
      // six sites were left unconverted and have only survived because this file
      // runs at the default 1280px viewport, where two months are visible.
      // Invisible for ~90% of any month, which is what makes it worth sweeping
      // rather than waiting for.
      await expect(await revealDay(page, checkIn)).toBeDisabled()
      await expect(await revealDay(page, addDay(checkOut, -1))).toBeDisabled()
      await expect(await revealDay(page, checkOut)).toBeEnabled()
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('an already-blocked day cannot be selected, but the next one can', async ({
    page,
  }) => {
    const listing = await createDraftListing()
    const startDate = addDay(todayISO(), 10)
    const endDate = addDay(todayISO(), 12)

    try {
      await createBlockedDateRow(listing.id, { startDate, endDate })
      await openAvailability(page, listing.id)

      // `revealDay` for the reason given above — today + 10…13.
      await expect(await revealDay(page, startDate)).toBeDisabled()
      await expect(await revealDay(page, endDate)).toBeDisabled()
      // Blocks are inclusive at both ends, so the day after one is free.
      await expect(await revealDay(page, addDay(endDate, 1))).toBeEnabled()
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a block abutting an existing one is accepted', async ({ page }) => {
    const listing = await createDraftListing()
    const existing = { startDate: addDay(todayISO(), 10), endDate: addDay(todayISO(), 12) }
    const abutting = addDay(existing.endDate, 1)

    try {
      await createBlockedDateRow(listing.id, existing)
      await openAvailability(page, listing.id)

      await pickDay(page, abutting)
      await pickDay(page, addDay(abutting, 2))
      await blockButton(page).click()

      await expect.poll(() => readBlockedDates(listing.id)).toHaveLength(2)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('the action refuses a range a guest booked while the host was deciding', async ({
    page,
  }) => {
    // **The only way to reach the server guard through the real UI**, and also
    // the genuine race: the calendar disables everything it already knows about,
    // so a conflict can only arrive after the page rendered. F10 proved its
    // delete guard the same way.
    const listing = await createDraftListing()
    const start = addDay(todayISO(), 10)
    const end = addDay(todayISO(), 15)

    try {
      await openAvailability(page, listing.id)

      await pickDay(page, start)
      await pickDay(page, end)

      // The guest reserves while the host is still looking at the calendar.
      await createBookingRow(listing.id, {
        checkIn: addDay(start, 1),
        checkOut: addDay(start, 3),
      })

      await blockButton(page).click()

      await expect(blockError(page)).toContainText('confirmed reservation')
      expect(await readBlockedDates(listing.id)).toEqual([])
      // And the stay it protected is untouched.
      expect(await readBookings(listing.id)).toHaveLength(1)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('the action refuses a range that was blocked while the host was deciding', async ({
    page,
  }) => {
    const listing = await createDraftListing()
    const start = addDay(todayISO(), 10)
    const end = addDay(todayISO(), 15)

    try {
      await openAvailability(page, listing.id)

      await pickDay(page, start)
      await pickDay(page, end)

      await createBlockedDateRow(listing.id, {
        startDate: addDay(start, 1),
        endDate: addDay(start, 2),
      })

      await blockButton(page).click()

      await expect(blockError(page)).toContainText('already set')
      // The one that was there, and nothing new.
      expect(await readBlockedDates(listing.id)).toHaveLength(1)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a reservation is listed read-only, with no control to remove it', async ({
    page,
  }) => {
    const listing = await createDraftListing()

    try {
      await createBookingRow(listing.id, {
        checkIn: addDay(todayISO(), 10),
        checkOut: addDay(todayISO(), 14),
      })
      await openAvailability(page, listing.id)

      await expect(page.getByRole('heading', { name: /^Reserved/ })).toBeVisible()
      // Freeing those nights is a cancellation, not an unblock.
      await expect(page.getByRole('button', { name: /^Unblock/ })).toHaveCount(0)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('blocking hides a published listing from a dated search, and unblocking restores it', async ({
    page,
  }) => {
    // End to end through `unavailable_listing_ids()` — proving F11's writes
    // reach the same availability function search has used since F06, without
    // this feature touching migration 0007 at all.
    const city = uniqueCity()
    const listing = await createDraftListing({
      city,
      minNights: SAFE_MIN_NIGHTS,
      isPublished: false,
    })
    const checkIn = addDay(todayISO(), 5)
    const checkOut = addDay(todayISO(), 40)

    try {
      await addListingPhotoRow(listing.id, { isCover: true })
      await publishFixtureListing(listing.id, true)

      const search = `/?city=${city}&checkIn=${checkIn}&checkOut=${checkOut}`
      const stays = page.getByRole('list', { name: 'Stays' })

      await page.goto(search)
      await expect(stays.getByText(listing.title)).toBeVisible()

      const block = await createBlockedDateRow(listing.id, {
        startDate: addDay(todayISO(), 10),
        endDate: addDay(todayISO(), 12),
      })

      await page.goto(search)
      await expect(page.getByText('No stays match your search')).toBeVisible()

      await openAvailability(page, listing.id)
      await page.getByRole('button', { name: /^Unblock/ }).click()
      await expect.poll(() => readBlockedDates(listing.id)).toEqual([])

      await page.goto(search)
      await expect(stays.getByText(listing.title)).toBeVisible()

      expect(block.id).toBeTruthy()
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('the route 404s for a non-owner and for a malformed id', async ({ page }) => {
    // **The listing has to genuinely exist, and the first version of this spec
    // proved that the hard way.** It named a hand-written id that was in the
    // wrong sentinel namespace and therefore matched no row at all — so the
    // route 404'd because the listing was missing, not because the viewer was
    // not its host, and the spec passed with `host_id` scoping deleted from the
    // query. `loadPublishedListings` excludes the fixture user, so this is a
    // real, live listing that this account demonstrably does not host.
    const [foreignListing] = await loadPublishedListings()

    const foreign = await page.request.get(
      `/host/listings/${foreignListing.id}/availability`,
    )
    expect(foreign.status()).toBe(404)

    // And it is reachable as a listing, which is what makes the 404 above mean
    // "not yours" rather than "no such thing".
    const publicPage = await page.request.get(`/listings/${foreignListing.id}`)
    expect(publicPage.status()).toBe(200)

    const malformed = await page.request.get('/host/listings/not-a-uuid/availability')
    expect(malformed.status()).toBe(404)
  })

  test('the listings grid links to availability', async ({ page }) => {
    const listing = await createDraftListing()

    try {
      await page.goto('/host/listings')

      await page
        .getByRole('link', { name: `Manage availability for ${listing.title}`, exact: true })
        .click()

      await expect(page).toHaveURL(`/host/listings/${listing.id}/availability`)
      await expect(
        page.getByRole('heading', { name: `Availability for ${listing.title}` }),
      ).toBeVisible()
    } finally {
      await deleteListing(listing.id)
    }
  })
})
