import { test, expect, type Page } from '@playwright/test'

import { pickDay } from './calendar'
import { AUTH_STATE_FILE } from './constants'
import {
  addDay,
  addListingPhotoRow,
  createDraftListing,
  deleteListing,
  publishFixtureListing,
  readBookings,
  secondUserId,
  todayISO,
} from './fixtures'
import { waitForHydration } from './hydration'

/**
 * The booking widget at the DESIGN.md breakpoints.
 *
 * Widths are each band's **lower boundary**, where a row is tightest. Sampling
 * band middles is how `nav-responsive.spec.ts` missed two real nav defects for a
 * whole feature (build-journal.md → F07) and how F09's photo grid shipped 24px
 * over the viewport at 320px.
 *
 * Heights are deliberately modest, and that is not incidental: the calendar
 * popover originally hung below a `sticky` rail, which put "Clear dates" and
 * "Done" at ~810px with no way to scroll them into view — unreachable for a real
 * user on a 720px-tall screen, not merely for Playwright. The panel now opens to
 * the left of the card, top-aligned. `desktop` at 720px is the width/height pair
 * that caught it.
 *
 * The rail and the bottom bar must never both be showing, and never neither: they
 * are one control in two places, and the price they quote has to come from the
 * same state.
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

const SAFE_MIN_NIGHTS = 30

test.use({ storageState: AUTH_STATE_FILE })

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, 'the page scrolls horizontally').toBeLessThanOrEqual(0)
}

async function bookableListing() {
  const hostId = await secondUserId()
  const listing = await createDraftListing({ hostId, minNights: SAFE_MIN_NIGHTS })
  await addListingPhotoRow(listing.id, { isCover: true })
  await publishFixtureListing(listing.id, true)

  const checkIn = addDay(todayISO(), 40)
  return { ...listing, checkIn, checkOut: addDay(checkIn, SAFE_MIN_NIGHTS) }
}

const rail = (page: Page) =>
  page.getByRole('complementary', { name: 'Reservation', exact: true })
// `complementary`, not `generic`: the bar is an <aside>, because ARIA drops an
// accessible name on a bare div — it would be announced by nothing and matchable
// by nothing.
const bar = (page: Page) =>
  page.getByRole('complementary', { name: 'Reservation summary', exact: true })

for (const { name, width, height } of WIDTHS) {
  test.describe(`${name} (${width}px)`, () => {
    test.use({ viewport: { width, height } })

    test('shows exactly one of the rail and the bottom bar, and fits', async ({
      page,
    }) => {
      const listing = await bookableListing()

      try {
        await page.goto(`/listings/${listing.id}`)

        const railVisible = await rail(page).isVisible()
        const barVisible = await bar(page).isVisible()

        // Below tablet the rail collapses to the bar; from tablet up the bar goes
        // away. Never both (two prices on screen), never neither (no way to book).
        expect(railVisible, 'rail visibility').toBe(width >= 744)
        expect(barVisible, 'bar visibility').toBe(width < 744)

        await expectNoHorizontalScroll(page)
      } finally {
        await deleteListing(listing.id)
      }
    })

    test('every reservation control clears the 44px floor', async ({ page }) => {
      const listing = await bookableListing()

      try {
        await page.goto(`/listings/${listing.id}`)

        const container = width >= 744 ? rail(page) : bar(page)
        const controls = container.getByRole('button')
        const count = await controls.count()
        expect(count, 'the reservation surface has controls').toBeGreaterThan(0)

        for (let index = 0; index < count; index++) {
          const control = controls.nth(index)
          const box = await control.boundingBox()
          expect(box, 'control has a box').not.toBeNull()
          const label = (await control.getAttribute('aria-label')) ?? (await control.innerText())
          // The shorter side is the one that fails a thumb.
          expect(Math.min(box!.width, box!.height), `${label} is under 44px`).toBeGreaterThanOrEqual(
            TAP_FLOOR,
          )
        }
      } finally {
        await deleteListing(listing.id)
      }
    })
  })
}

test.describe('the calendar surface at each band', () => {
  for (const { name, width, height } of WIDTHS) {
    test.describe(`${name} (${width}px)`, () => {
      test.use({ viewport: { width, height } })

      test('opens, and its footer controls are reachable', async ({ page }) => {
        const listing = await bookableListing()

        try {
          await page.goto(`/listings/${listing.id}`)

          if (width >= 744) {
            const opener = rail(page).locator('button:has-text("Check-in")')
            await waitForHydration(opener)
            await opener.click()

            // Checked while the panel is OPEN: an absolutely-positioned panel does
            // contribute to scrollWidth when it overflows its container, and this
            // one opens leftward into a column that is only ~324px wide at 744.
            await expectNoHorizontalScroll(page)

            // **Clicking is the assertion**, not presence or viewport position.
            // The defect this file exists for was a footer that rendered fine and
            // could not be reached: `toBeInViewport()` depends on where the page
            // happens to be scrolled, while a click auto-scrolls and then fails
            // for real if the control is unreachable.
            await page.getByRole('button', { name: 'Clear dates' }).click()
            await page.getByRole('button', { name: 'Done', exact: true }).click()
            await expect(page.getByRole('button', { name: 'Done', exact: true })).toHaveCount(0)
          } else {
            // Below tablet the bar opens the sheet, which holds the calendar.
            const open = bar(page).getByRole('button')
            await waitForHydration(open)
            await open.click()

            const sheet = page.getByRole('dialog')
            await expect(sheet).toBeVisible()
            await expect(sheet.getByRole('button', { name: 'Next month' })).toBeVisible()
            await page.getByRole('button', { name: 'Close reservation' }).click()
            await expect(sheet).toHaveCount(0)
          }

          await expectNoHorizontalScroll(page)
        } finally {
          await deleteListing(listing.id)
        }
      })
    })
  }
})

test.describe('the mobile sheet books a stay end to end', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('bar opens the sheet, the sheet reserves, and the bar reports it', async ({
    page,
  }) => {
    // The bar deliberately never books — it opens the sheet, where the total is
    // visible before anything is committed. This is the only spec that drives the
    // phone path all the way to a row.
    const listing = await bookableListing()

    try {
      await page.goto(`/listings/${listing.id}`)

      const open = bar(page).getByRole('button')
      await waitForHydration(open)
      await expect(open).toHaveText('Add dates')
      await open.click()

      const sheet = page.getByRole('dialog')
      await pickDay(page, listing.checkIn)
      await pickDay(page, listing.checkOut)

      await expect(sheet).toContainText('Total')
      await sheet.getByRole('button', { name: 'Reserve', exact: true }).click()

      await expect(sheet.getByText('Your stay is confirmed')).toBeVisible()
      expect(await readBookings(listing.id)).toHaveLength(1)

      // Closing the sheet leaves the bar reporting the reservation rather than
      // offering to make another one.
      await page.getByRole('button', { name: 'Close reservation' }).click()
      await expect(bar(page)).toContainText('Reserved')
      await expect(bar(page).getByRole('link', { name: 'View in Trips' })).toBeVisible()
    } finally {
      await deleteListing(listing.id)
    }
  })
})
