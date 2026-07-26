import { test, expect, type Page } from '@playwright/test'

import { pickDay, revealDay } from './calendar'
import { AUTH_STATE_FILE } from './constants'
import {
  OTHER_USER_ID,
  addDay,
  addListingPhotoRow,
  createBlockedDateRow,
  createBookingRow,
  createDraftListing,
  deleteListing,
  publishFixtureListing,
  readBookings,
  secondUserId,
  testUserId,
  todayISO,
  updateFixtureListing,
} from './fixtures'
import { waitForHydration } from './hydration'

/**
 * Instant Book (F12) — picking dates, the price snapshot, and the four guards
 * that only this action enforces.
 *
 * **The oracle is the `bookings` table, never the confirmation panel.** A widget
 * can render "$4,206.60" perfectly while storing the wrong integer, or the right
 * total against the wrong dates. `readBookings` returns every money column for
 * exactly that reason.
 *
 * **The bookable listing is hosted by the SECOND fixture account.** A guest may
 * not book their own listing, so the account that books cannot be the host — and
 * hosting it on a fixture account rather than a seed user is what lets
 * `global-teardown.ts` sweep it if a spec dies before its `finally`.
 *
 * **"Unavailable to a second guest" is proven against `anon`**, and deliberately:
 * anon reads *zero* booking rows and holds no session at all, so a greyed-out
 * night on an anonymous visitor's calendar can only have come from the `0008`
 * definer function. A third *signed-in* guest is unreachable with two fixture
 * accounts — the host and the booker use both — and would be the weaker principal
 * anyway. The refusal half is proven from the other side: a stay booked by a
 * genuinely different guest (`OTHER_USER_ID`) that arrives while this guest is
 * deciding.
 */

/** Keeps a published fixture listing out of every search spec's window — F10's
 *  fix, still load-bearing. It also makes every booking here exactly 30 nights,
 *  which is legal, and lets the `min_nights` guard be tested by moving the
 *  minimum rather than by shortening the stay. */
const SAFE_MIN_NIGHTS = 30

/** `createDraftListing`'s fixed guest cap, restated so the expectations below are
 *  readable here rather than a file away. */
const FIXTURE_MAX_GUESTS = 4

/**
 * **A price chosen so that rounding is discriminating.** `createDraftListing`'s
 * own $123.00 gives a service fee of exactly 51660 cents whether you round it or
 * truncate it, so an assertion on the stored total would have passed against a
 * broken `priceBreakdown` — proved by running it with `Math.floor`. At $123.33 the
 * two answers differ by a cent, so this spec gates the half-up rule end to end and
 * not merely the unit tests.
 */
const FIXTURE_PRICE_CENTS = 12_333

/** 30 nights at $123.33: subtotal $3,699.90, no cleaning fee, 14% = $517.986,
 *  which is 51799 cents rounded half-up and 51798 truncated. */
const EXPECTED_SERVICE_FEE_CENTS = 51_799
const EXPECTED_TOTAL_CENTS = 421_789

/**
 * A published listing this account can book, hosted by the other fixture account.
 *
 * The window sits +40 days out. Far enough to be clear of "today", close enough
 * that `pickDay` reaches it inside its 14-month walk even at a phone width, where
 * only one month panel is on screen.
 */
async function bookableListing(options: { hostedByViewer?: boolean } = {}) {
  const hostId = options.hostedByViewer ? await testUserId() : await secondUserId()

  const listing = await createDraftListing({ hostId, minNights: SAFE_MIN_NIGHTS })
  await addListingPhotoRow(listing.id, { isCover: true })
  await updateFixtureListing(listing.id, { pricePerNightCents: FIXTURE_PRICE_CENTS })
  await publishFixtureListing(listing.id, true)

  const checkIn = addDay(todayISO(), 40)
  return { ...listing, checkIn, checkOut: addDay(checkIn, SAFE_MIN_NIGHTS) }
}

const rail = (page: Page) =>
  page.getByRole('complementary', { name: 'Reservation', exact: true })

const reserveButton = (page: Page) =>
  page.getByRole('button', { name: 'Reserve', exact: true })

/**
 * The widget's error line, scoped to the rail that owns it.
 *
 * A bare `getByRole('alert')` also matches Next's `__next-route-announcer__`,
 * which carries `role="alert"` on every page — F11 lost two specs to exactly that,
 * and the fix is the same here.
 */
const bookingError = (page: Page) => rail(page).getByRole('alert')

/** The rail's date field, which toggles the calendar popover. */
const calendarOpener = (page: Page) => rail(page).locator('button:has-text("Check-in")')

/** Opens the rail's calendar, picks a range, and closes it. */
async function pickStay(page: Page, checkIn: string, checkOut: string) {
  const opener = calendarOpener(page)
  // Before hydration this click does nothing at all and every locator after it
  // waits out its full timeout against static HTML (F10).
  await waitForHydration(opener)
  await opener.click()

  await pickDay(page, checkIn)
  await pickDay(page, checkOut)

  await page.getByRole('button', { name: 'Done', exact: true }).click()
}

test.describe('signed out', () => {
  test('Reserve is a sign-in form carrying the chosen stay, not a live control', async ({
    page,
  }) => {
    const listing = await bookableListing()

    try {
      await page.goto(
        `/listings/${listing.id}?checkIn=${listing.checkIn}&checkOut=${listing.checkOut}&guests=3`,
      )

      await expect(rail(page).getByRole('button', { name: 'Sign in to book' })).toBeVisible()

      // The whole point: nothing on this page can create a booking while signed out.
      await expect(reserveButton(page)).toHaveCount(0)

      // The selection rides along, so signing in returns the guest to this stay
      // rather than to an empty widget — F08's heart, same reasoning.
      await expect(rail(page).locator('input[name="next"]')).toHaveValue(
        `/listings/${listing.id}?checkIn=${listing.checkIn}&checkOut=${listing.checkOut}&guests=3`,
      )

      expect(await readBookings(listing.id)).toHaveLength(0)
    } finally {
      await deleteListing(listing.id)
    }
  })
})

test.describe('booking a stay', () => {
  test.use({ storageState: AUTH_STATE_FILE })

  test('books the stay and stores the price snapshot in cents', async ({ page }) => {
    const listing = await bookableListing()
    const guestId = await testUserId()

    try {
      await page.goto(`/listings/${listing.id}`)
      await pickStay(page, listing.checkIn, listing.checkOut)

      // 1 -> 2 guests, so the stepper is exercised rather than assumed.
      await page.getByRole('button', { name: 'Add a guest', exact: true }).first().click()

      await expect(rail(page)).toContainText('Total')

      await reserveButton(page).click()
      await expect(page.getByText('Your stay is confirmed')).toBeVisible()

      const bookings = await readBookings(listing.id)
      expect(bookings).toHaveLength(1)
      expect(bookings[0]).toMatchObject({
        guestId,
        status: 'confirmed',
        checkIn: listing.checkIn,
        checkOut: listing.checkOut,
        guestsCount: 2,
        nights: SAFE_MIN_NIGHTS,
        pricePerNightCents: FIXTURE_PRICE_CENTS,
        cleaningFeeCents: 0,
        serviceFeeCents: EXPECTED_SERVICE_FEE_CENTS,
        totalCents: EXPECTED_TOTAL_CENTS,
      })

      // The parts must add up in the row, not merely on screen.
      const row = bookings[0]
      expect(row.totalCents).toBe(
        row.nights * row.pricePerNightCents + row.cleaningFeeCents + row.serviceFeeCents,
      )
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('those nights then read as taken to an anonymous visitor', async ({
    page,
    browser,
  }) => {
    const listing = await bookableListing()

    try {
      await page.goto(`/listings/${listing.id}`)
      await pickStay(page, listing.checkIn, listing.checkOut)
      await reserveButton(page).click()
      await expect(page.getByText('Your stay is confirmed')).toBeVisible()

      // A context with no storageState at all: this visitor reads zero booking
      // rows, so a greyed cell can only have come from the definer function.
      const anon = await browser.newContext({ storageState: undefined })
      const anonPage = await anon.newPage()
      try {
        await anonPage.goto(`/listings/${listing.id}`)
        const opener = calendarOpener(anonPage)
        await waitForHydration(opener)
        await opener.click()

        // revealDay, not dayCell: the cell may be months ahead of the opening
        // view, and a disabled cell must never be clicked to reach it.
        await expect(await revealDay(anonPage, listing.checkIn)).toBeDisabled()
        await expect(await revealDay(anonPage, addDay(listing.checkOut, -1))).toBeDisabled()
        // Half-open: the checkout day itself is free for the next guest.
        await expect(await revealDay(anonPage, listing.checkOut)).toBeEnabled()
      } finally {
        await anon.close()
      }
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a second stay may start on the first one’s checkout day', async ({ page }) => {
    // The positive control for the RPC's `check_out - 1`. Without it the checkout
    // day reads as occupied and this same-day turnover is refused — the exclusion
    // constraint permits it, so the app must too. Pairing the refusals above with
    // a success is F11's rule: otherwise a refusal may be measuring the setup.
    const listing = await bookableListing()

    try {
      await page.goto(`/listings/${listing.id}`)
      await pickStay(page, listing.checkIn, listing.checkOut)
      await reserveButton(page).click()
      await expect(page.getByText('Your stay is confirmed')).toBeVisible()

      await page.goto(`/listings/${listing.id}`)
      await pickStay(page, listing.checkOut, addDay(listing.checkOut, SAFE_MIN_NIGHTS))
      await reserveButton(page).click()
      await expect(page.getByText('Your stay is confirmed')).toBeVisible()

      const bookings = await readBookings(listing.id)
      expect(bookings).toHaveLength(2)
      expect(bookings.map((booking) => booking.checkIn).sort()).toEqual(
        [listing.checkIn, listing.checkOut].sort(),
      )
    } finally {
      await deleteListing(listing.id)
    }
  })
})

test.describe('the guards only this action enforces', () => {
  test.use({ storageState: AUTH_STATE_FILE })

  test('refuses nights the host blocked while this guest was deciding', async ({
    page,
  }) => {
    // **This is the spec that gates the action's availability check, and the
    // booking one below is not.** Removing the check leaves a booking-vs-booking
    // overlap to the `bookings_no_overlap` exclusion constraint, which refuses it
    // anyway and — because `23P01` maps to the same sentence — produces an
    // identical pass. A block is the case no constraint can reach: nothing in
    // Postgres expresses a rule spanning `bookings` and `blocked_dates`, so this
    // action is the only thing standing between a guest and a host's blocked
    // nights. Proven by deletion: with the check removed, this booking succeeds.
    const listing = await bookableListing()

    try {
      await page.goto(`/listings/${listing.id}`)
      await pickStay(page, listing.checkIn, listing.checkOut)

      // The host blocks the same nights while the guest is choosing — the block
      // could not have been on the calendar the guest is looking at.
      await createBlockedDateRow(listing.id, {
        startDate: listing.checkIn,
        endDate: addDay(listing.checkIn, 2),
      })

      await reserveButton(page).click()
      await expect(bookingError(page)).toHaveText('Those dates are no longer available.')
      expect(await readBookings(listing.id)).toHaveLength(0)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('refuses dates another guest took while this one was deciding', async ({
    page,
  }) => {
    // The calendar disables every night it already knows about, so the server's
    // availability check is only reachable by a stay that arrives *after* the
    // render — which is also the genuine race. F10 proved its delete guard and
    // F11 its overlap guard the same way.
    //
    // **Honest note: this one does not gate the app-side check** — see the block
    // spec above. It proves the outcome a guest experiences, which the exclusion
    // constraint alone would also deliver.
    const listing = await bookableListing()

    try {
      await page.goto(`/listings/${listing.id}`)
      await pickStay(page, listing.checkIn, listing.checkOut)

      // A different guest entirely: createBookingRow books as OTHER_USER_ID.
      await createBookingRow(listing.id, {
        checkIn: listing.checkIn,
        checkOut: listing.checkOut,
      })

      await reserveButton(page).click()
      await expect(bookingError(page)).toHaveText('Those dates are no longer available.')

      // Still exactly the other guest's stay, and none of ours. Asserted on the
      // guest id, not the total: this fixture's numbers are the same as ours.
      const bookings = await readBookings(listing.id)
      expect(bookings).toHaveLength(1)
      expect(bookings[0].guestId).toBe(OTHER_USER_ID)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('refuses a stay under the minimum the host set while deciding', async ({
    page,
  }) => {
    // `min_nights` has no constraint behind it — this action is the only thing
    // enforcing it. The calendar is built from the same number, so raising it
    // mid-decision is the only way to reach the server's copy of the rule.
    const listing = await bookableListing()

    try {
      await page.goto(`/listings/${listing.id}`)
      await pickStay(page, listing.checkIn, listing.checkOut)

      await updateFixtureListing(listing.id, { minNights: SAFE_MIN_NIGHTS + 10 })

      await reserveButton(page).click()
      await expect(bookingError(page)).toHaveText(
        `This place has a ${SAFE_MIN_NIGHTS + 10}-night minimum stay.`,
      )
      expect(await readBookings(listing.id)).toHaveLength(0)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('refuses more guests than the listing sleeps', async ({ page }) => {
    // The table checks only 1–16, so the per-listing cap is enforced here and
    // nowhere else — the rule `build-plan.md`'s F12 line does not mention.
    const listing = await bookableListing()

    try {
      await page.goto(`/listings/${listing.id}`)
      await pickStay(page, listing.checkIn, listing.checkOut)

      // Up to the listing's stated capacity, which the stepper allows and then stops.
      const addGuest = page.getByRole('button', { name: 'Add a guest', exact: true }).first()
      for (let guests = 1; guests < FIXTURE_MAX_GUESTS; guests++) await addGuest.click()
      await expect(addGuest).toBeDisabled()

      await updateFixtureListing(listing.id, { maxGuests: 2 })

      await reserveButton(page).click()
      await expect(bookingError(page)).toHaveText('This place sleeps at most 2 guests.')
      expect(await readBookings(listing.id)).toHaveLength(0)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a host cannot book their own listing', async ({ page }) => {
    // Hosted by this account. Dates are picked first so that `isOwnListing` is
    // the *only* remaining reason Reserve is disabled — otherwise the assertion
    // would also pass on a widget that simply had no dates yet.
    const listing = await bookableListing({ hostedByViewer: true })

    try {
      await page.goto(`/listings/${listing.id}`)
      await pickStay(page, listing.checkIn, listing.checkOut)

      await expect(page.getByText('You cannot book your own listing.')).toBeVisible()
      await expect(reserveButton(page)).toBeDisabled()
      expect(await readBookings(listing.id)).toHaveLength(0)
    } finally {
      await deleteListing(listing.id)
    }
  })
})

test.describe('availability the calendar reads', () => {
  test.use({ storageState: AUTH_STATE_FILE })

  test('a host’s blocked range is not offered, and its end day is inclusive', async ({
    page,
  }) => {
    const listing = await bookableListing()

    try {
      // Inserted before the render, so this proves the calendar reads blocks as
      // well as bookings — the half of availability that *is* anon-readable, and
      // could therefore have been (wrongly) computed in app code.
      await createBlockedDateRow(listing.id, {
        startDate: listing.checkIn,
        endDate: addDay(listing.checkIn, 3),
      })

      await page.goto(`/listings/${listing.id}`)
      const opener = calendarOpener(page)
      await waitForHydration(opener)
      await opener.click()

      await expect(await revealDay(page, listing.checkIn)).toBeDisabled()
      await expect(await revealDay(page, addDay(listing.checkIn, 3))).toBeDisabled()
      // Blocks are inclusive [start, end], so the day after the end is free.
      await expect(await revealDay(page, addDay(listing.checkIn, 4))).toBeEnabled()
    } finally {
      await deleteListing(listing.id)
    }
  })
})
