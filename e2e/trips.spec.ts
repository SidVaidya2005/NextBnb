import { test, expect, type Locator, type Page } from '@playwright/test'

import { pickDay, revealDay } from './calendar'
import { AUTH_STATE_FILE } from './constants'
import {
  OTHER_USER_ID,
  addDay,
  addListingPhotoRow,
  createBookingRow,
  createDraftListing,
  deleteListing,
  publishFixtureListing,
  readBooking,
  readBookings,
  secondUserId,
  testUserId,
  todayISO,
  updateFixtureListing,
} from './fixtures'
import { waitForHydration } from './hydration'

/**
 * Trips (F13) — what a guest holds, and cancelling one that has not started.
 *
 * **The oracle is the `bookings` table, never the page.** A card that disappears
 * from Upcoming proves a re-render, not a write; `readBooking` returns every
 * column because the interesting claim is not only that `status` flipped but
 * that the **price snapshot and dates did not move** — the column `GRANT` in
 * migration `0006` proving itself.
 *
 * **Geometry: the second fixture account hosts, the primary one books.** F12's
 * arrangement, and it is what keeps every row sweepable — a guest may not book
 * their own listing, and `listingsOwnedByFixtureUser` covers both accounts, so
 * `deleteListing` in a `finally` (and `global-teardown.ts` behind it) reaches
 * the bookings by cascade.
 *
 * **No spec asserts a count or "the first card".** `/trips` is per-user global
 * state and this suite runs `fullyParallel` against one shared session, so every
 * card is located by its own listing's title — the same rule `favorites.spec.ts`
 * arrived at, for the same reason.
 */

/** Keeps a published fixture listing out of every search spec's date window (F10). */
const SAFE_MIN_NIGHTS = 30

/**
 * A published listing hosted by the *other* fixture account, ready to be booked
 * by this one. The window sits +40 days out — clear of today, and close enough
 * that `pickDay` reaches it inside its 14-month walk even at a phone width.
 */
async function bookableListing() {
  const hostId = await secondUserId()
  const listing = await createDraftListing({ hostId, minNights: SAFE_MIN_NIGHTS })
  await addListingPhotoRow(listing.id, { isCover: true })
  await publishFixtureListing(listing.id, true)

  const checkIn = addDay(todayISO(), 40)
  return { ...listing, checkIn, checkOut: addDay(checkIn, SAFE_MIN_NIGHTS) }
}

/**
 * A listing plus a booking already on it, in whatever temporal state the spec
 * needs. `min_nights` is left at 1 because these ranges are written straight to
 * the table — the point is to reach states `createBooking` refuses to create,
 * such as a stay that is already under way.
 */
async function tripInState(options: {
  checkIn: string
  checkOut: string
  status?: 'confirmed' | 'cancelled'
}) {
  const hostId = await secondUserId()
  const guestId = await testUserId()
  const listing = await createDraftListing({ hostId })
  await addListingPhotoRow(listing.id, { isCover: true })
  await publishFixtureListing(listing.id, true)

  const booking = await createBookingRow(listing.id, { ...options, guestId })
  return { listing, bookingId: booking.id }
}

const upcomingList = (page: Page) => page.getByRole('list', { name: 'Upcoming trips' })
const pastList = (page: Page) => page.getByRole('list', { name: 'Past trips' })

/** One trip card, found by its listing's (unique) title. */
const cardFor = (list: Locator, title: string) =>
  list.getByRole('listitem').filter({ hasText: title })

/** The cancel control inside one card, scoped so it cannot match a sibling trip. */
const cancelButton = (card: Locator) =>
  card.getByRole('button', { name: /^Cancel / })

// -----------------------------------------------------------------------------

test.describe('signed out', () => {
  test('/trips bounces to sign-in and comes back', async ({ page }) => {
    await page.goto('/trips')
    await expect(page).toHaveURL(/signin=required/)
    await expect(page).toHaveURL(/next=%2Ftrips/)
  })
})

test.describe('the trips list', () => {
  test.use({ storageState: AUTH_STATE_FILE })

  test('a booked stay appears under Upcoming and can be cancelled', async ({ page }) => {
    // The one spec that books through the UI end to end, per code-standards.md's
    // required flow: book -> confirmed -> shows in Trips -> cancel -> dates freed.
    const listing = await bookableListing()

    try {
      await page.goto(`/listings/${listing.id}`)

      const opener = page
        .getByRole('complementary', { name: 'Reservation', exact: true })
        .locator('button:has-text("Check-in")')
      // Before hydration this click does nothing and every locator after it
      // waits out its full timeout against static HTML (F10).
      await waitForHydration(opener)
      await opener.click()
      await pickDay(page, listing.checkIn)
      await pickDay(page, listing.checkOut)
      await page.getByRole('button', { name: 'Done', exact: true }).click()

      await page.getByRole('button', { name: 'Reserve', exact: true }).click()
      await expect(page.getByText('Your stay is confirmed')).toBeVisible()

      const [booked] = await readBookings(listing.id)
      expect(booked.status).toBe('confirmed')

      await page.goto('/trips')

      const card = cardFor(upcomingList(page), listing.title)
      await expect(card).toBeVisible()
      await expect(card).toContainText(`${SAFE_MIN_NIGHTS} nights`)

      const cancel = cancelButton(card)
      await waitForHydration(cancel)
      await cancel.click()
      await card.getByRole('button', { name: /^Confirm cancelling / }).click()

      // It moves sections rather than disappearing: a guest who cancels needs to
      // see that it worked.
      await expect(cardFor(pastList(page), listing.title)).toBeVisible()
      await expect(cardFor(pastList(page), listing.title)).toContainText('Cancelled')
      await expect(cardFor(upcomingList(page), listing.title)).toHaveCount(0)

      // The oracle. Only the two granted columns moved — the snapshot the guest
      // agreed to is still exactly what the row holds.
      const after = await readBooking(booked.id)
      expect(after).toMatchObject({
        status: 'cancelled',
        checkIn: booked.checkIn,
        checkOut: booked.checkOut,
        pricePerNightCents: booked.pricePerNightCents,
        serviceFeeCents: booked.serviceFeeCents,
        totalCents: booked.totalCents,
      })
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('cancelling frees the nights for everyone else', async ({ page, browser }) => {
    const listing = await bookableListing()

    try {
      await createBookingRow(listing.id, {
        checkIn: listing.checkIn,
        checkOut: listing.checkOut,
        guestId: await testUserId(),
      })

      // Proven against ANON — the stronger principal, which reads zero booking
      // rows and holds no session, so a greyed-out night can only have come from
      // the `0008` definer function. F12's reasoning, from the other direction.
      const anon = await browser.newContext()
      const anonPage = await anon.newPage()

      await anonPage.goto(`/listings/${listing.id}`)
      const anonOpener = anonPage
        .getByRole('complementary', { name: 'Reservation', exact: true })
        .locator('button:has-text("Check-in")')
      await waitForHydration(anonOpener)
      await anonOpener.click()
      await expect(await revealDay(anonPage, listing.checkIn)).toBeDisabled()

      await page.goto('/trips')
      const card = cardFor(upcomingList(page), listing.title)
      const cancel = cancelButton(card)
      await waitForHydration(cancel)
      await cancel.click()
      await card.getByRole('button', { name: /^Confirm cancelling / }).click()
      await expect(cardFor(pastList(page), listing.title)).toBeVisible()

      await anonPage.reload()
      await waitForHydration(anonOpener)
      await anonOpener.click()
      // The whole claim of a cancellation: the exclusion constraint is partial on
      // `status = 'confirmed'`, so these nights are genuinely for sale again.
      await expect(await revealDay(anonPage, listing.checkIn)).toBeEnabled()

      await anon.close()
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a stay already under way is Upcoming, but says why it cannot be cancelled', async ({
    page,
  }) => {
    // Only the service client can write this state — `createBooking` refuses a
    // past check-in outright, which is exactly why it needs a fixture row.
    const { listing } = await tripInState({
      checkIn: addDay(todayISO(), -2),
      checkOut: addDay(todayISO(), 3),
    })

    try {
      await page.goto('/trips')

      const card = cardFor(upcomingList(page), listing.title)
      await expect(card).toBeVisible()
      // Stated, not merely absent (F09's publish button, F10's delete).
      await expect(card).toContainText('Your stay has already started')
      await expect(cancelButton(card)).toHaveCount(0)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a finished stay is Past and offers no cancel', async ({ page }) => {
    const { listing } = await tripInState({
      checkIn: addDay(todayISO(), -20),
      checkOut: addDay(todayISO(), -15),
    })

    try {
      await page.goto('/trips')

      const card = cardFor(pastList(page), listing.title)
      await expect(card).toBeVisible()
      await expect(cancelButton(card)).toHaveCount(0)
      await expect(cardFor(upcomingList(page), listing.title)).toHaveCount(0)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a cancelled stay is Past however far in the future its dates are', async ({
    page,
  }) => {
    // "Upcoming" means still going to happen, not merely "in the future".
    const { listing } = await tripInState({
      checkIn: addDay(todayISO(), 60),
      checkOut: addDay(todayISO(), 65),
      status: 'cancelled',
    })

    try {
      await page.goto('/trips')

      const card = cardFor(pastList(page), listing.title)
      await expect(card).toBeVisible()
      await expect(card).toContainText('Cancelled')
      await expect(cancelButton(card)).toHaveCount(0)
      await expect(cardFor(upcomingList(page), listing.title)).toHaveCount(0)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a stay survives its listing being unpublished, and stays cancellable', async ({
    page,
  }) => {
    // RLS returns a null `listings` embed once the host unpublishes — postgrest
    // types that embed as never-null, so nothing in TypeScript asks about it.
    // `/favorites` drops such rows; a reservation must not be dropped, because
    // the guest still holds it and the cancel control lives on that card.
    const { listing, bookingId } = await tripInState({
      checkIn: addDay(todayISO(), 50),
      checkOut: addDay(todayISO(), 55),
    })

    try {
      await publishFixtureListing(listing.id, false)
      await page.goto('/trips')

      const card = upcomingList(page)
        .getByRole('listitem')
        .filter({ hasText: 'This listing is no longer available' })
        .first()

      await expect(card).toBeVisible()
      // The title is gone, but the reservation itself is all still there.
      await expect(cardFor(upcomingList(page), listing.title)).toHaveCount(0)

      const cancel = cancelButton(card)
      await waitForHydration(cancel)
      await cancel.click()
      await card.getByRole('button', { name: /^Confirm cancelling / }).click()

      await expect
        .poll(async () => (await readBooking(bookingId))?.status)
        .toBe('cancelled')
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a booking on a listing I HOST is not one of my trips', async ({ page }) => {
    // The gate proof for the `guest_id` filter. The `bookings` SELECT policy
    // admits the listing's host as well as the guest, so leaning on RLS the way
    // `/favorites` does — it has no such filter, deliberately — would put F14's
    // screen inside F13's. Deleting `.eq('guest_id', user.id)` makes this fail.
    const hostId = await testUserId()
    const listing = await createDraftListing({ hostId, minNights: SAFE_MIN_NIGHTS })
    await addListingPhotoRow(listing.id, { isCover: true })
    await publishFixtureListing(listing.id, true)

    try {
      await createBookingRow(listing.id, {
        checkIn: addDay(todayISO(), 70),
        checkOut: addDay(todayISO(), 75),
        guestId: OTHER_USER_ID,
      })

      await page.goto('/trips')

      // The positive control: the host CAN see this booking exists — it is on
      // their own listing — so a bare "not visible" here would otherwise be
      // measuring the setup rather than the filter (F11's lesson).
      expect(await readBookings(listing.id)).toHaveLength(1)

      await expect(cardFor(upcomingList(page), listing.title)).toHaveCount(0)
      await expect(cardFor(pastList(page), listing.title)).toHaveCount(0)
    } finally {
      await deleteListing(listing.id)
    }
  })
})
