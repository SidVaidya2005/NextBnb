import { test, expect, type Page } from '@playwright/test'

import { AUTH_STATE_FILE } from './constants'
import { addListingPhotoRow, createDraftListing, deleteListing } from './fixtures'

/**
 * `/host/listings` and the editor at the DESIGN.md breakpoints.
 *
 * Widths are each band's **lower boundary**, which is where a row is tightest.
 * Sampling band middles is how `nav-responsive.spec.ts` missed two real nav
 * defects for a whole feature (build-journal.md → F07), and how F09's photo grid
 * shipped 24px over the viewport at 320px until the same technique caught it.
 * The listing row carries four controls side by side, so 320px is the case that
 * matters most here.
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

    test('the listings grid fits and every control is tappable', async ({ page }) => {
      const listing = await createDraftListing()
      await addListingPhotoRow(listing.id, { isCover: true })

      try {
        await page.goto('/host/listings')

        const row = page
          .getByRole('list', { name: 'Your listings' })
          .getByRole('listitem')
          .filter({ hasText: listing.title })
        await row.waitFor()

        await expectNoHorizontalScroll(page)

        // Four controls share this row. They may wrap, but none may spill past
        // the viewport or shrink below the floor.
        const controls = [
          row.getByRole('link', { name: `Edit ${listing.title}` }),
          row.getByRole('link', { name: `Manage photos for ${listing.title}` }),
          row.getByRole('button', { name: `Publish ${listing.title}` }),
          row.getByRole('button', { name: `Delete ${listing.title}` }),
        ]

        for (const control of controls) {
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

    test('the confirm step fits too — it adds a control to a full row', async ({
      page,
    }) => {
      const listing = await createDraftListing()

      try {
        await page.goto('/host/listings')

        const row = page
          .getByRole('list', { name: 'Your listings' })
          .getByRole('listitem')
          .filter({ hasText: listing.title })
        await row.waitFor()

        // Delete becomes Confirm + Cancel, so the widest state of this row is
        // the one that only appears mid-interaction.
        await row.getByRole('button', { name: `Delete ${listing.title}` }).click()

        const confirm = row.getByRole('button', {
          name: `Confirm deleting ${listing.title}`,
        })
        const cancel = row.getByRole('button', { name: `Keep ${listing.title}` })
        await confirm.waitFor()

        await expectNoHorizontalScroll(page)

        for (const control of [confirm, cancel]) {
          const box = await control.boundingBox()
          expect(box!.height).toBeGreaterThanOrEqual(TAP_FLOOR)
          expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
        }
      } finally {
        await deleteListing(listing.id)
      }
    })

    test('the editor fits and its controls stay reachable', async ({ page }) => {
      const listing = await createDraftListing()

      try {
        await page.goto(`/host/listings/${listing.id}/edit`)

        const form = page.getByRole('form', { name: 'Edit your listing' })
        await form.waitFor()

        await expectNoHorizontalScroll(page)

        for (const id of ['title', 'city', 'pricePerNight']) {
          const box = await form.locator(`#${id}`).boundingBox()
          expect(box, `#${id} has no box`).not.toBeNull()
          expect(box!.x).toBeGreaterThanOrEqual(0)
          expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
        }

        const submit = form.getByRole('button', { name: 'Save changes' })
        const submitBox = await submit.boundingBox()
        expect(submitBox!.height).toBeGreaterThanOrEqual(TAP_FLOOR)
      } finally {
        await deleteListing(listing.id)
      }
    })
  })
}
