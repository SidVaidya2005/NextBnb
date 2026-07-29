import { test, expect } from '@playwright/test'

import { SECOND_AUTH_STATE_FILE } from './constants'
import {
  addDay,
  addListingPhotoRow,
  createBookingRow,
  createDraftListing,
  createReviewRow,
  deleteListing,
  OTHER_USER_ID,
  readBooking,
  readListing,
  secondUserId,
  setUserAdmin,
  testUserId,
  todayISO,
} from './fixtures'

/**
 * The admin dashboard, and the three verbs behind its gate.
 *
 * **This file owns `profiles.is_admin` for the fixture accounts, exclusively.**
 * The flag is global per-user state and `playwright.config.ts` sets
 * `fullyParallel: true`, which parallelises across files as well as within them
 * — so two files granting and revoking the same flag would race, and the failure
 * would look like a flaky redirect rather than like two specs fighting. F17 moved
 * the route-gate test out of `second-user.spec.ts` for exactly that reason:
 * `mode: 'serial'` orders tests *within* a file and buys nothing across two.
 *
 * The SECOND account is used rather than the shared one because flipping
 * `TEST_USER`'s flag mid-run would race `auth.spec.ts`'s "no Admin entry for a
 * non-admin" (`constants.ts` records this as the third reason that account
 * exists). Every test grants in a `try` and revokes in a `finally`;
 * `global-teardown.ts` is the backstop for the run killed before the `finally`,
 * because the fixture password is committed and a standing admin is a privilege
 * path rather than an untidy row.
 */
test.describe.configure({ mode: 'serial' })

test.use({ storageState: SECOND_AUTH_STATE_FILE })

test.describe('the admin dashboard', () => {
  test('reaches /admin only while is_admin is set', async ({ page }) => {
    const userId = await secondUserId()

    // NEGATIVE CONTROL FIRST, on the same account and the same route, so the
    // 200 below can only mean "is_admin decided it".
    await page.goto('/admin')
    await expect(page).toHaveURL('/')

    try {
      await setUserAdmin(userId, true)

      await page.goto('/admin')
      await expect(page).toHaveURL('/admin')
      await expect(page.getByRole('heading', { name: 'Admin', level: 1 })).toBeVisible()
    } finally {
      await setUserAdmin(userId, false)
    }

    // And it is genuinely revoked, verified through the app rather than by
    // trusting the write.
    await page.goto('/admin')
    await expect(page).toHaveURL('/')
  })

  test('renders all three tables against real rows', async ({ page }) => {
    const userId = await secondUserId()

    try {
      await setUserAdmin(userId, true)
      await page.goto('/admin')

      // Each table is asserted by its own accessible name. These are the first
      // exercise the PostgREST select strings in `queries/admin.ts` get — a bad
      // embed alias is a runtime 400, not a type error, and it would land here
      // as an empty section rather than as a crash.
      for (const name of [
        'All accounts, with their listing and booking counts',
        'All listings, with controls to unpublish or delete each one',
        'All reservations, with controls to cancel the confirmed ones',
      ]) {
        await expect(page.getByRole('table', { name })).toBeVisible()
      }

      // Populated, not merely present: the seeded catalogue is 26 listings, so an
      // empty Listings section would mean the read failed and the section fell
      // through to its empty state — which a table-exists assertion cannot see.
      await expect(
        page.getByRole('heading', { name: /^Listings \(\d+\)/, level: 2 }),
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: /^Bookings \(\d+\)/, level: 2 }),
      ).toBeVisible()
      // The Users table's email column is the one thing RLS cannot reach, so it
      // proves `admin_list_users()` actually ran rather than degrading to null.
      await expect(page.getByRole('cell', { name: 'e2e-second@nextbnb.test' })).toBeVisible()
    } finally {
      await setUserAdmin(userId, false)
    }
  })

  test('unpublishes a listing hosted by someone else', async ({ page }) => {
    const adminId = await secondUserId()
    const hostId = await testUserId()

    // Hosted by the OTHER account: an admin unpublishing their own listing would
    // pass through `listings_update_own`'s host branch and prove nothing about
    // the definer function this feature exists to add. `min_nights: 30` keeps a
    // published fixture out of the counts `search.spec.ts` compares.
    const listing = await createDraftListing({
      hostId,
      isPublished: true,
      minNights: 30,
    })

    try {
      await addListingPhotoRow(listing.id, { position: 0, isCover: true })
      await setUserAdmin(adminId, true)

      // POSITIVE CONTROL: the row starts published, so the assertion below can
      // only mean the click did it (F11).
      expect((await readListing(listing.id))?.isPublished).toBe(true)

      await page.goto('/admin')
      await page.getByRole('button', { name: `Unpublish ${listing.title}` }).click()

      // The DATABASE is the oracle, not the page. An UPDATE that RLS refuses
      // returns `{ error: null }` and changes nothing, so a UI that merely
      // stopped showing the control would look identical to a working one —
      // this is the assertion the whole 0009 migration exists to satisfy.
      await expect
        .poll(async () => (await readListing(listing.id))?.isPublished)
        .toBe(false)
    } finally {
      await setUserAdmin(adminId, false)
      await deleteListing(listing.id)
    }
  })

  test('names what a delete would erase before erasing it', async ({ page }) => {
    const adminId = await secondUserId()
    const hostId = await testUserId()

    const listing = await createDraftListing({
      hostId,
      isPublished: true,
      minNights: 30,
    })

    try {
      await addListingPhotoRow(listing.id, { position: 0, isCover: true })

      // Three DISTINCT counts — 2 upcoming, 1 past, 3 reviews. Equal counts
      // would pass against an implementation that read the wrong field for any
      // of them (F12's rule about what a green assertion still passes against).
      const soon = await createBookingRow(listing.id, {
        checkIn: addDay(todayISO(), 10),
        checkOut: addDay(todayISO(), 12),
      })
      const later = await createBookingRow(listing.id, {
        checkIn: addDay(todayISO(), 20),
        checkOut: addDay(todayISO(), 22),
      })
      const past = await createBookingRow(listing.id, {
        checkIn: addDay(todayISO(), -20),
        checkOut: addDay(todayISO(), -18),
      })

      for (const booking of [soon, later, past]) {
        await createReviewRow({
          listingId: listing.id,
          bookingId: booking.id,
          reviewerId: OTHER_USER_ID,
        })
      }

      await setUserAdmin(adminId, true)
      await page.goto('/admin')

      await page.getByRole('button', { name: `Delete ${listing.title}` }).click()

      // The count, before the click that acts on it. This is what replaces the
      // refusal the host's `deleteListing` would have given.
      await expect(
        page.getByText('Also erases 2 upcoming reservations, 1 past reservation and 3 reviews.'),
      ).toBeVisible()
      await expect(page.getByText('Guests see no cancellation')).toBeVisible()

      // The reversible verb is offered right there, so the destructive one is
      // not the only way out of the confirm.
      await expect(
        page.getByRole('button', { name: `Unpublish ${listing.title} instead of deleting it` }),
      ).toBeVisible()

      // Backing out leaves everything alone.
      await page.getByRole('button', { name: `Keep ${listing.title}` }).click()
      expect(await readListing(listing.id)).not.toBeNull()

      // And then it really does delete — including the upcoming stays that would
      // have stopped the host. That is the escape hatch F10 left open.
      await page.getByRole('button', { name: `Delete ${listing.title}` }).click()
      await page.getByRole('button', { name: `Confirm deleting ${listing.title}` }).click()

      await expect.poll(async () => await readListing(listing.id)).toBeNull()
      await expect.poll(async () => await readBooking(soon.id)).toBeNull()
    } finally {
      await setUserAdmin(adminId, false)
      await deleteListing(listing.id)
    }
  })

  test('cancels an in-progress stay that its own guest could not', async ({ page }) => {
    const adminId = await secondUserId()
    const hostId = await testUserId()

    const listing = await createDraftListing({
      hostId,
      isPublished: true,
      minNights: 30,
    })

    try {
      await addListingPhotoRow(listing.id, { position: 0, isCover: true })

      // Checked in yesterday, leaving tomorrow. `canCancelBooking` is false for
      // this (`check_in >= current_date`) and so is the guest branch of
      // `bookings_update_cancel_own_or_admin` — the admin branch of the same
      // USING clause carries no window at all, which is the thing under test.
      const booking = await createBookingRow(listing.id, {
        checkIn: addDay(todayISO(), -1),
        checkOut: addDay(todayISO(), 1),
      })

      await setUserAdmin(adminId, true)
      await page.goto('/admin')

      expect((await readBooking(booking.id))?.status).toBe('confirmed')

      await page.getByRole('button', { name: new RegExp(`^Cancel ${listing.title}`) }).click()
      await page
        .getByRole('button', { name: new RegExp(`^Confirm cancelling ${listing.title}`) })
        .click()

      await expect
        .poll(async () => (await readBooking(booking.id))?.status)
        .toBe('cancelled')

      // `cancelled_at` is written too — the column pair `0006` grants together,
      // and the thing that makes a cancellation legible after the fact.
      expect((await readBooking(booking.id))?.cancelledAt).not.toBeNull()
    } finally {
      await setUserAdmin(adminId, false)
      await deleteListing(listing.id)
    }
  })
})

/**
 * `/admin` at the DESIGN.md breakpoints.
 *
 * **Deliberately in this file rather than in `admin-responsive.spec.ts`**, which
 * is the project's convention everywhere else. These tests need `is_admin`, and
 * that flag is global per-user state — a second file granting and revoking it
 * would race this one under `fullyParallel: true` exactly as `second-user.spec.ts`
 * would have. The convention loses to the race.
 *
 * Widths are each band's **lower boundary**, where a row is tightest — sampling
 * band middles is how `nav-responsive.spec.ts` missed two real nav defects for a
 * whole feature (build-journal.md → F07).
 *
 * The claim under test is specific to this page: DESIGN.md specs no table, and
 * `code-standards.md`'s "grids drop columns" governs card grids rather than data
 * an operator is moderating on. So the tables keep every column at every width
 * and **scroll inside their own container**, while the page body never scrolls.
 * Both halves are asserted — a table that simply fit would pass the second alone.
 */
const WIDTHS = [
  { name: 'mobile-narrow', width: 320, height: 720 },
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 744, height: 1024 },
  { name: 'desktop', width: 1128, height: 720 },
  { name: 'wide', width: 1440, height: 900 },
]

const TAP_FLOOR = 44

for (const { name, width, height } of WIDTHS) {
  test.describe(`the admin dashboard at ${name} (${width}px)`, () => {
    test.use({ viewport: { width, height } })

    test('keeps every column and scrolls the table, not the page', async ({ page }) => {
      const adminId = await secondUserId()

      try {
        await setUserAdmin(adminId, true)
        await page.goto('/admin')

        const table = page.getByRole('table', {
          name: 'All listings, with controls to unpublish or delete each one',
        })
        await expect(table).toBeVisible()

        // The page body must never scroll horizontally, at any width.
        const pageOverflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(pageOverflow, 'the page scrolls horizontally').toBeLessThanOrEqual(0)

        // And the containment is real: below the width the table needs, its own
        // wrapper is what overflows. Asserting only "the page does not scroll"
        // would pass just as happily against a table that had dropped columns.
        const wrapperOverflow = await table.evaluate((el) => {
          const wrapper = el.parentElement
          if (!wrapper) return null
          return {
            scrollable: wrapper.scrollWidth > wrapper.clientWidth,
            columns: el.querySelectorAll('thead th').length,
          }
        })

        expect(wrapperOverflow, 'the table has no wrapper').not.toBeNull()
        expect(wrapperOverflow!.columns, 'a column was dropped').toBe(5)
        if (width < 744) {
          expect(
            wrapperOverflow!.scrollable,
            'the table should scroll within its own container at this width',
          ).toBe(true)
        }

        // The controls inside the table still clear the hard tap-target floor.
        const control = page.getByRole('button', { name: /^Delete / }).first()
        const box = await control.boundingBox()
        expect(box, 'the delete control has no box').not.toBeNull()
        expect(box!.height, 'below the tap-target floor').toBeGreaterThanOrEqual(TAP_FLOOR)
      } finally {
        await setUserAdmin(adminId, false)
      }
    })
  })
}
