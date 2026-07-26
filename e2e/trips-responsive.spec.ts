import { test, expect, type Page } from '@playwright/test'

import { AUTH_STATE_FILE } from './constants'
import {
  addDay,
  addListingPhotoRow,
  createBookingRow,
  createDraftListing,
  deleteListing,
  publishFixtureListing,
  secondUserId,
  testUserId,
  todayISO,
} from './fixtures'
import { waitForHydration } from './hydration'

/**
 * `/trips` at the DESIGN.md breakpoints.
 *
 * Widths are each band's **lower boundary**, which is where a row is tightest —
 * sampling band middles is how `nav-responsive.spec.ts` missed two real nav
 * defects for a whole feature (build-journal.md → F07). The trip card stacks its
 * photo above the detail column below `tablet:` and sits side by side above it,
 * so 320px and 744px are the two that matter most.
 */
const WIDTHS = [
  { name: 'mobile-narrow', width: 320, height: 720 },
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 744, height: 1024 },
  { name: 'desktop', width: 1128, height: 720 },
  { name: 'wide', width: 1440, height: 900 },
]

/** The project's hard floor from code-standards.md — not DESIGN.md's 32px. */
const TAP_FLOOR = 44

test.use({ storageState: AUTH_STATE_FILE })

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, 'the page scrolls horizontally').toBeLessThanOrEqual(0)
}

/** A cancellable trip owned by this account, on a listing the other one hosts. */
async function upcomingTrip() {
  const hostId = await secondUserId()
  const guestId = await testUserId()
  const listing = await createDraftListing({ hostId })
  await addListingPhotoRow(listing.id, { isCover: true })
  await publishFixtureListing(listing.id, true)

  await createBookingRow(listing.id, {
    checkIn: addDay(todayISO(), 40),
    checkOut: addDay(todayISO(), 45),
    guestId,
  })

  return listing
}

for (const { name, width, height } of WIDTHS) {
  test.describe(`${name} (${width}px)`, () => {
    test.use({ viewport: { width, height } })

    test('the trip card fits and its controls are tappable', async ({ page }) => {
      const listing = await upcomingTrip()

      try {
        await page.goto('/trips')

        const card = page
          .getByRole('list', { name: 'Upcoming trips' })
          .getByRole('listitem')
          .filter({ hasText: listing.title })

        await expect(card).toBeVisible()
        await expectNoHorizontalScroll(page)

        const cancel = card.getByRole('button', { name: /^Cancel / })
        const box = await cancel.boundingBox()
        expect(box, 'the cancel control has no box').not.toBeNull()
        expect(
          Math.min(box!.width, box!.height),
          'the cancel control is below the tap floor',
        ).toBeGreaterThanOrEqual(TAP_FLOOR)

        // The two-step confirm puts two controls on one row — the case that
        // actually overflows at 320px, and the reason this asserts after the
        // click rather than only before it.
        await waitForHydration(cancel)
        await cancel.click()
        await expect(
          card.getByRole('button', { name: /^Confirm cancelling / }),
        ).toBeVisible()
        await expectNoHorizontalScroll(page)
      } finally {
        await deleteListing(listing.id)
      }
    })

    test('the empty state fits', async ({ page }) => {
      // No fixture: whatever this shared account currently holds, the page shell
      // and its headings must fit. Asserting on emptiness itself would race the
      // parallel workers that book on this same account (favorites.spec.ts's rule).
      await page.goto('/trips')

      await expect(page.getByRole('heading', { name: 'Trips', level: 1 })).toBeVisible()
      await expectNoHorizontalScroll(page)
    })
  })
}
