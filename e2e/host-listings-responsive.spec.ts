import { test, expect, type Page } from '@playwright/test'

import { AUTH_STATE_FILE } from './constants'
import { addListingPhotoRow, createDraftListing, deleteListing } from './fixtures'

/**
 * The two host routes at the DESIGN.md breakpoints.
 *
 * Widths are each band's **lower boundary**, which is where a row is tightest —
 * the Phase 1 close-out spec sampled band middles and missed two real nav
 * defects for a whole feature because of it (see build-journal.md → F07).
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

    test('the create form fits and its controls are usable', async ({ page }) => {
      await page.goto('/host/listings/new')

      const form = page.getByRole('form', { name: 'List your place' })
      await form.waitFor()

      await expectNoHorizontalScroll(page)

      // Every control stays inside the viewport — a field wider than the screen
      // is unreachable on a phone even when the page itself does not scroll.
      for (const id of ['title', 'city', 'pricePerNight']) {
        const box = await form.locator(`#${id}`).boundingBox()
        expect(box, `#${id} has no box`).not.toBeNull()
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
      }

      const submit = page.getByRole('button', { name: 'Save and add photos' })
      const submitBox = await submit.boundingBox()
      expect(submitBox!.height).toBeGreaterThanOrEqual(TAP_FLOOR)
    })

    test('an amenity row clears the tap-target floor', async ({ page }) => {
      await page.goto('/host/listings/new')

      const form = page.getByRole('form', { name: 'List your place' })
      const row = form.getByText('Wi-Fi', { exact: true }).locator('..')
      const box = await row.boundingBox()

      expect(box!.height).toBeGreaterThanOrEqual(TAP_FLOOR)
    })

    test('the photo manager fits and every tile control is tappable', async ({
      page,
    }) => {
      const listing = await createDraftListing()
      await addListingPhotoRow(listing.id, { position: 0 })
      await addListingPhotoRow(listing.id, { position: 1 })

      try {
        await page.goto(`/host/listings/${listing.id}/photos`)
        await page.getByRole('button', { name: 'Remove photo 1' }).waitFor()

        await expectNoHorizontalScroll(page)

        // Move / cover / delete are icon buttons — the easiest thing in the
        // feature to ship below 44px, which is exactly what happened to the
        // account menu in Phase 1.
        for (const label of [
          'Move photo 1 later',
          'Make photo 1 the cover',
          'Remove photo 1',
        ]) {
          const box = await page.getByRole('button', { name: label }).boundingBox()
          expect(box, `${label} has no box`).not.toBeNull()
          expect(
            Math.min(box!.width, box!.height),
            `${label} is below the ${TAP_FLOOR}px floor`,
          ).toBeGreaterThanOrEqual(TAP_FLOOR)
          expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
        }
      } finally {
        await deleteListing(listing.id)
      }
    })

    test('the publish reason is visible, not just a disabled button', async ({
      page,
    }) => {
      const listing = await createDraftListing()

      try {
        await page.goto(`/host/listings/${listing.id}/photos`)

        await expect(page.getByRole('button', { name: 'Publish listing' })).toBeDisabled()
        await expect(page.getByText('Add at least one photo to publish.')).toBeVisible()
        await expectNoHorizontalScroll(page)
      } finally {
        await deleteListing(listing.id)
      }
    })
  })
}
