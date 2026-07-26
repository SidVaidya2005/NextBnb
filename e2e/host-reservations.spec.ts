import { test, expect, type Locator, type Page } from '@playwright/test'

import { AUTH_STATE_FILE } from './constants'
import {
  OTHER_USER_ID,
  addDay,
  addListingPhotoRow,
  createBookingRow,
  createDraftListing,
  deleteListing,
  publishFixtureListing,
  readBookings,
  secondUserId,
  testUserId,
  todayISO,
} from './fixtures'

/**
 * Host reservations (F14) — bookings on the listings this account hosts.
 *
 * **Geometry is `trips.spec.ts`'s gate proof, inverted.** There the fixture user
 * is the guest and the second account hosts; here the fixture user **hosts** and
 * the seeded guest books. That inversion is the feature: the same `bookings` row
 * belongs to two screens, and each has to show only its own half.
 *
 * **The page is read-only, and that is a schema fact.**
 * `bookings_update_cancel_own_or_admin` admits only the guest or an admin, so a
 * host cannot write to `bookings` at all. `no control on the page mutates
 * anything` asserts it rather than leaving it to the absence of a button.
 *
 * **No spec asserts a count or "the first card".** This is per-user global state
 * and the suite runs `fullyParallel` against one shared session, so every card is
 * located by its own listing's title — `trips.spec.ts`'s rule, which is also what
 * keeps this file out of `mode: 'serial'`.
 */

/** Keeps a published fixture listing out of every search spec's date window (F10). */
const SAFE_MIN_NIGHTS = 30

/**
 * A non-zero cleaning fee, and it is load-bearing.
 *
 * Earnings are `total - service_fee`, which is `subtotal + cleaning_fee`. At a
 * zero cleaning fee that collapses onto `nights x price_per_night`, so an
 * implementation that ignored the fee entirely would render the identical number
 * and this spec would pass against it.
 */
const CLEANING_FEE_CENTS = 4_500

/**
 * A listing this account hosts, with a booking on it by the seeded guest.
 *
 * Written straight to the table by the service client, which is the only way to
 * reach the states this page has to render — `createBooking` refuses a past
 * check-in, and a host cannot book their own listing at all.
 */
async function reservationOnMyListing(options: {
  checkIn: string
  checkOut: string
  status?: 'confirmed' | 'cancelled'
  published?: boolean
}) {
  const hostId = await testUserId()
  const listing = await createDraftListing({ hostId, minNights: SAFE_MIN_NIGHTS })
  await addListingPhotoRow(listing.id, { isCover: true })
  await publishFixtureListing(listing.id, options.published ?? true)

  const booking = await createBookingRow(listing.id, {
    checkIn: options.checkIn,
    checkOut: options.checkOut,
    status: options.status,
    guestId: OTHER_USER_ID,
    cleaningFee: CLEANING_FEE_CENTS,
  })

  return { listing, bookingId: booking.id }
}

const upcomingList = (page: Page) =>
  page.getByRole('list', { name: 'Upcoming reservations' })
const pastList = (page: Page) => page.getByRole('list', { name: 'Past reservations' })

/** One reservation card, found by its listing's (unique) title. */
const cardFor = (list: Locator, title: string) =>
  list.getByRole('listitem').filter({ hasText: title })

// -----------------------------------------------------------------------------

test.describe('signed out', () => {
  test('/host/reservations bounces to sign-in and comes back', async ({ page }) => {
    await page.goto('/host/reservations')
    await expect(page).toHaveURL(/signin=required/)
    await expect(page).toHaveURL(/next=%2Fhost%2Freservations/)
  })
})

test.describe('the reservations list', () => {
  test.use({ storageState: AUTH_STATE_FILE })

  test('a booking on my listing shows the guest, the stay and the money', async ({
    page,
  }) => {
    const { listing } = await reservationOnMyListing({
      checkIn: addDay(todayISO(), 40),
      checkOut: addDay(todayISO(), 45),
    })

    try {
      await page.goto('/host/reservations')

      const card = cardFor(upcomingList(page), listing.title)
      await expect(card).toBeVisible()

      // The guest leads the card — the whole point of a host-side view.
      await expect(card).toContainText('Priya Raman')
      await expect(card).toContainText('5 nights')
      await expect(card).toContainText('2 guests')

      // The money, asserted against the row rather than the page's own arithmetic.
      // 5 x $123.00 = $615.00 subtotal, +$45.00 cleaning, +$86.10 service fee.
      const [booked] = await readBookings(listing.id)
      expect(booked.totalCents).toBe(74_610)
      expect(booked.serviceFeeCents).toBe(8_610)

      await expect(card).toContainText('Guest paid')
      await expect(card).toContainText('$746.10')
      await expect(card).toContainText('$86.10')
      await expect(card).toContainText('Your earnings')
      // $660.00 = total - service fee. Distinct from the total ($746.10) AND from
      // the bare subtotal ($615.00), which is what the cleaning fee buys us.
      await expect(card).toContainText('$660.00')

      await expect(cardFor(pastList(page), listing.title)).toHaveCount(0)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a booking where I am the GUEST is not one of my reservations', async ({
    page,
  }) => {
    // The gate proof for the `listing_id` scoping, and it does not fail closed:
    // the `bookings` SELECT policy admits `guest_id = auth.uid()` as well as the
    // listing's host, so an unscoped read puts F13's screen inside F14's — the
    // exact inverse of the leak `trips.spec.ts` guards. Deleting
    // `.in('listing_id', listingIds)` makes this fail; RLS never would.
    const hostId = await secondUserId()
    const guestId = await testUserId()
    const theirListing = await createDraftListing({ hostId, minNights: SAFE_MIN_NIGHTS })
    await addListingPhotoRow(theirListing.id, { isCover: true })
    await publishFixtureListing(theirListing.id, true)

    // The positive control (F11's rule): a reservation that MUST appear, created
    // alongside, so "nothing is visible" cannot pass by measuring a broken page.
    const mine = await reservationOnMyListing({
      checkIn: addDay(todayISO(), 40),
      checkOut: addDay(todayISO(), 45),
    })

    try {
      await createBookingRow(theirListing.id, {
        checkIn: addDay(todayISO(), 70),
        checkOut: addDay(todayISO(), 75),
        guestId,
      })

      await page.goto('/host/reservations')

      // The row exists and this user can read it — they are its guest. So its
      // absence below is the scoping, not the data.
      expect(await readBookings(theirListing.id)).toHaveLength(1)

      await expect(cardFor(upcomingList(page), mine.listing.title)).toBeVisible()
      await expect(cardFor(upcomingList(page), theirListing.title)).toHaveCount(0)
      await expect(cardFor(pastList(page), theirListing.title)).toHaveCount(0)
    } finally {
      await deleteListing(theirListing.id)
      await deleteListing(mine.listing.id)
    }
  })

  test('a finished stay is Past', async ({ page }) => {
    const { listing } = await reservationOnMyListing({
      checkIn: addDay(todayISO(), -20),
      checkOut: addDay(todayISO(), -15),
    })

    try {
      await page.goto('/host/reservations')

      await expect(cardFor(pastList(page), listing.title)).toBeVisible()
      await expect(cardFor(upcomingList(page), listing.title)).toHaveCount(0)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a cancelled stay is Past, and reports no earnings', async ({ page }) => {
    // "Upcoming" means still going to happen, not merely "in the future" — and a
    // cancelled stay earns the host nothing, so the earnings figure must not
    // survive onto it. A number under a "Cancelled" pill is money never coming.
    const { listing } = await reservationOnMyListing({
      checkIn: addDay(todayISO(), 60),
      checkOut: addDay(todayISO(), 65),
      status: 'cancelled',
    })

    try {
      await page.goto('/host/reservations')

      const card = cardFor(pastList(page), listing.title)
      await expect(card).toBeVisible()
      await expect(card).toContainText('Cancelled')
      await expect(card).toContainText('nothing earned')
      await expect(card).not.toContainText('Your earnings')
      await expect(card).not.toContainText('$660.00')

      await expect(cardFor(upcomingList(page), listing.title)).toHaveCount(0)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a reservation on a listing I unpublished is still there, and says so', async ({
    page,
  }) => {
    // A host can unpublish a place that already has stays booked on it, and those
    // stays stand. The `bookings` SELECT policy's host branch carries no
    // `is_published` condition, so the row is exactly as readable as any other —
    // and it is the last thing that should quietly vanish from the host's screen.
    const { listing } = await reservationOnMyListing({
      checkIn: addDay(todayISO(), 50),
      checkOut: addDay(todayISO(), 55),
      published: false,
    })

    try {
      await page.goto('/host/reservations')

      const card = cardFor(upcomingList(page), listing.title)
      await expect(card).toBeVisible()
      await expect(card).toContainText('Unpublished')
      await expect(card).toContainText('Priya Raman')
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('nothing on the page can cancel or change a reservation', async ({ page }) => {
    // The read-only guarantee, asserted rather than assumed. A host has no write
    // path to `bookings` at all, so a control here would either 403 at the policy
    // or need a migration to work — both worse than not rendering one.
    const { listing } = await reservationOnMyListing({
      checkIn: addDay(todayISO(), 40),
      checkOut: addDay(todayISO(), 45),
    })

    try {
      await page.goto('/host/reservations')

      const card = cardFor(upcomingList(page), listing.title)
      await expect(card).toBeVisible()

      await expect(card.getByRole('button')).toHaveCount(0)
      // The one link a card carries goes to the public listing page — a read.
      const links = card.getByRole('link')
      await expect(links).toHaveCount(1)
      await expect(links).toHaveAttribute('href', `/listings/${listing.id}`)
    } finally {
      await deleteListing(listing.id)
    }
  })
})
