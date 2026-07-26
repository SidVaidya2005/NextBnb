import { test, expect, type Page } from '@playwright/test'

import { AUTH_STATE_FILE } from './constants'
import {
  OTHER_USER_ID,
  addDay,
  addListingPhotoRow,
  createBookingRow,
  createDraftListing,
  deleteListing,
  publishFixtureListing,
  testUserId,
  todayISO,
} from './fixtures'

/**
 * `/host/reservations` at the DESIGN.md breakpoints.
 *
 * Widths are each band's **lower boundary**, which is where a row is tightest —
 * sampling band middles is how `nav-responsive.spec.ts` missed two real nav
 * defects for a whole feature (build-journal.md → F07).
 *
 * The reservation card stacks its photo above the detail column below `tablet:`
 * and sits side by side above it, so 320px and 744px matter most. The thing that
 * is new here is the **money block**: three label/value rows that justify to both
 * edges, which is the shape most likely to overflow a 320px card.
 *
 * Unlike `/trips` there is no tap-target assertion, because there is nothing to
 * tap — the page is read-only by design, which `host-reservations.spec.ts`
 * asserts directly.
 */
const WIDTHS = [
  { name: 'mobile-narrow', width: 320, height: 720 },
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 744, height: 1024 },
  { name: 'desktop', width: 1128, height: 720 },
  { name: 'wide', width: 1440, height: 900 },
]

const SAFE_MIN_NIGHTS = 30
const CLEANING_FEE_CENTS = 4_500

test.use({ storageState: AUTH_STATE_FILE })

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, 'the page scrolls horizontally').toBeLessThanOrEqual(0)
}

/** An upcoming reservation on a listing this account hosts. */
async function upcomingReservation() {
  const hostId = await testUserId()
  const listing = await createDraftListing({ hostId, minNights: SAFE_MIN_NIGHTS })
  await addListingPhotoRow(listing.id, { isCover: true })
  await publishFixtureListing(listing.id, true)

  await createBookingRow(listing.id, {
    checkIn: addDay(todayISO(), 40),
    checkOut: addDay(todayISO(), 45),
    guestId: OTHER_USER_ID,
    cleaningFee: CLEANING_FEE_CENTS,
  })

  return listing
}

for (const { name, width, height } of WIDTHS) {
  test.describe(`${name} (${width}px)`, () => {
    test.use({ viewport: { width, height } })

    test('the reservation card and its money block fit', async ({ page }) => {
      const listing = await upcomingReservation()

      try {
        await page.goto('/host/reservations')

        const card = page
          .getByRole('list', { name: 'Upcoming reservations' })
          .getByRole('listitem')
          .filter({ hasText: listing.title })

        await expect(card).toBeVisible()
        await expectNoHorizontalScroll(page)

        // The money block is the new shape on this page, and a `justify-between`
        // row is what pushes a card past its own edge when the label and the
        // figure stop fitting side by side.
        const money = card.locator('dl')
        await expect(money).toBeVisible()
        await expect(money).toContainText('$660.00')

        const cardBox = await card.boundingBox()
        const moneyBox = await money.boundingBox()
        expect(cardBox, 'the card has no box').not.toBeNull()
        expect(moneyBox, 'the money block has no box').not.toBeNull()
        expect(
          moneyBox!.x + moneyBox!.width,
          'the money block overflows its card',
        ).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 1)

        // Below `tablet:` the photo sits above the detail column; from `tablet:`
        // up they share a row. Asserted by geometry rather than by class name.
        const photo = card.locator('img').first()
        const photoBox = await photo.boundingBox()
        expect(photoBox, 'the cover has no box').not.toBeNull()
        if (width >= 744) {
          expect(photoBox!.y, 'the photo should share a row with the detail').toBeLessThan(
            moneyBox!.y,
          )
          expect(
            photoBox!.x + photoBox!.width,
            'the photo should sit beside the detail, not above it',
          ).toBeLessThanOrEqual(moneyBox!.x + 1)
        } else {
          expect(
            photoBox!.y + photoBox!.height,
            'the photo should stack above the detail',
          ).toBeLessThanOrEqual(moneyBox!.y + 1)
        }
      } finally {
        await deleteListing(listing.id)
      }
    })

    test('the page shell fits', async ({ page }) => {
      // No fixture: whatever this shared account currently holds, the heading and
      // shell must fit. Asserting on emptiness itself would race the parallel
      // workers creating reservations on this same account.
      await page.goto('/host/reservations')

      await expect(
        page.getByRole('heading', { name: 'Reservations', level: 1 }),
      ).toBeVisible()
      await expectNoHorizontalScroll(page)
    })
  })
}
