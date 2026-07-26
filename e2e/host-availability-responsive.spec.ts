import { test, expect, type Page } from '@playwright/test'

import { dayCell, pickDay } from './calendar'
import { AUTH_STATE_FILE } from './constants'
import {
  addDay,
  createBlockedDateRow,
  createBookingRow,
  createDraftListing,
  deleteListing,
  todayISO,
} from './fixtures'
import { waitForHydration } from './hydration'

/**
 * `/host/listings/[id]/availability` at the DESIGN.md breakpoints.
 *
 * Widths are each band's **lower boundary**, where a row is tightest. Sampling
 * band middles is how `nav-responsive.spec.ts` missed two real nav defects for a
 * whole feature (build-journal.md → F07) and how F09's photo grid shipped 24px
 * over the viewport at 320px.
 *
 * The calendar is the interesting case here: DESIGN.md fixes a month panel at a
 * width the narrowest phone cannot hold, so it scrolls **inside its own
 * container** rather than pushing the page sideways. That is the distinction
 * these specs exist to hold — a horizontally scrolling *page* is the defect; a
 * horizontally scrolling calendar is the design.
 */
const WIDTHS = [
  { name: 'mobile-narrow', width: 320, height: 720 },
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 744, height: 1024 },
  { name: 'desktop', width: 1128, height: 900 },
  { name: 'wide', width: 1440, height: 900 },
]

/** The project's hard floor from code-standards.md — not DESIGN.md's 32px. */
const TAP_FLOOR = 44

/** DESIGN.md `date-picker-day` is a 40px cell; the floor applies to the controls
 *  around the grid, which are ordinary buttons. */
const DAY_CELL = 40

test.use({ storageState: AUTH_STATE_FILE })

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, 'the page scrolls horizontally').toBeLessThanOrEqual(0)
}

for (const { name, width, height } of WIDTHS) {
  test.describe(`${name} (${width}px)`, () => {
    test.use({ viewport: { width, height } })

    test('the availability page fits and its controls stay tappable', async ({
      page,
    }) => {
      const listing = await createDraftListing()

      try {
        await createBlockedDateRow(listing.id, {
          startDate: addDay(todayISO(), 10),
          endDate: addDay(todayISO(), 12),
        })
        await createBookingRow(listing.id, {
          checkIn: addDay(todayISO(), 30),
          checkOut: addDay(todayISO(), 34),
        })

        await page.goto(`/host/listings/${listing.id}/availability`)

        const block = page.getByRole('button', {
          name: 'Block these dates',
          exact: true,
        })
        await block.waitFor()

        await expectNoHorizontalScroll(page)

        const unblock = page.getByRole('button', { name: /^Unblock/ }).first()

        for (const control of [block, unblock]) {
          const box = await control.boundingBox()
          expect(box, 'a control has no box').not.toBeNull()
          expect(box!.height, 'below the tap floor').toBeGreaterThanOrEqual(TAP_FLOOR)
          expect(box!.x).toBeGreaterThanOrEqual(0)
          expect(
            box!.x + box!.width,
            'a control overflows the viewport',
          ).toBeLessThanOrEqual(width + 1)
        }
      } finally {
        await deleteListing(listing.id)
      }
    })

    test('the calendar scrolls inside its own container, never the page', async ({
      page,
    }) => {
      const listing = await createDraftListing()

      try {
        await page.goto(`/host/listings/${listing.id}/availability`)
        await page.getByRole('button', { name: 'Block these dates', exact: true }).waitFor()

        // Month navigation is a real control and has to clear the floor.
        const nextMonth = page.getByRole('button', { name: 'Next month', exact: true })
        const navBox = await nextMonth.boundingBox()
        expect(navBox!.height).toBeGreaterThanOrEqual(TAP_FLOOR)
        expect(navBox!.width).toBeGreaterThanOrEqual(TAP_FLOOR)

        // A day cell keeps its DESIGN.md size at every width, so the grid never
        // silently collapses into something untappable. Measured on a *future*
        // day: the first cell of the current month is usually in the past and
        // renders in the disabled style.
        const dayBox = await dayCell(page, addDay(todayISO(), 3)).boundingBox()
        expect(dayBox!.height).toBeGreaterThanOrEqual(DAY_CELL)

        await expectNoHorizontalScroll(page)
      } finally {
        await deleteListing(listing.id)
      }
    })

    test('a selected range stays legible and the page still fits', async ({ page }) => {
      // The widest this screen gets: a selection adds a second button beside the
      // primary one, the same way F10's delete-confirm widens its row.
      const listing = await createDraftListing()

      try {
        await page.goto(`/host/listings/${listing.id}/availability`)

        const block = page.getByRole('button', {
          name: 'Block these dates',
          exact: true,
        })
        await block.waitFor()

        await waitForHydration(block)
        await pickDay(page, addDay(todayISO(), 10))

        const clear = page.getByRole('button', { name: 'Clear selection', exact: true })
        await clear.waitFor()

        await expectNoHorizontalScroll(page)

        for (const control of [block, clear]) {
          const box = await control.boundingBox()
          expect(box!.height).toBeGreaterThanOrEqual(TAP_FLOOR)
          expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
        }
      } finally {
        await deleteListing(listing.id)
      }
    })
  })
}
