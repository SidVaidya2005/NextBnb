import { test, expect, type Page } from '@playwright/test'

import { AUTH_STATE_FILE } from './constants'
import { loadPublishedListings } from './fixtures'

/**
 * The heart, measured at the DESIGN.md breakpoints.
 *
 * The gallery overlay is the piece worth measuring: the mobile strip bleeds
 * 24px past the content column while its first tile is `w-[88%]` of that bleed,
 * so a fixed right offset lands on the first photo at 375px and on the *second*
 * one by 743px. The offset is percentage-based for that reason, and 743 is
 * sampled here precisely because it is the band's worst case — the Phase 1
 * close-out and F07 both found defects that only existed at a band's edge.
 */
const BREAKPOINTS = [
  { name: 'mobile-narrow', width: 320, height: 700 },
  { name: 'mobile', width: 375, height: 812 },
  { name: 'mobile-large', width: 414, height: 896 },
  { name: 'mobile-max', width: 743, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'laptop', width: 1280, height: 900 },
  { name: 'desktop', width: 1512, height: 950 },
] as const

const MIN_TAP_TARGET = 44

let listing: { id: string; title: string }

test.beforeAll(async () => {
  listing = (await loadPublishedListings())[0]
})

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
}

/** The heart on the listing page, whichever auth state rendered it. */
function galleryHeart(page: Page) {
  return page.getByRole('button', { name: /save|Remove/i }).first()
}

type Box = { x: number; y: number; width: number; height: number }

/** `inner` is fully within `outer` on all four sides. */
function expectContains(outer: Box, inner: Box) {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x)
  expect(inner.y).toBeGreaterThanOrEqual(outer.y)
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width)
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height)
}

for (const bp of BREAKPOINTS) {
  test.describe(`${bp.name} (${bp.width}px)`, () => {
    test.use({
      viewport: { width: bp.width, height: bp.height },
      storageState: AUTH_STATE_FILE,
    })

    test('the heart clears the 44px tap-target floor on a card', async ({
      page,
    }) => {
      await page.goto('/')
      await page.getByRole('list', { name: 'Stays' }).waitFor()

      const heart = page.getByRole('button', { name: /^(Save|Remove) /  }).first()
      const box = await heart.boundingBox()

      expect(box).not.toBeNull()
      expect(box!.width).toBeGreaterThanOrEqual(MIN_TAP_TARGET)
      expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET)
    })

    test('the gallery heart sits inside the photo block', async ({ page }) => {
      await page.goto(`/listings/${listing.id}`)
      await page.getByRole('heading', { level: 1 }).waitFor()

      const heartBox = await galleryHeart(page).boundingBox()
      const galleryBox = await page.getByLabel(/^Photos of /).boundingBox()
      expect(heartBox).not.toBeNull()
      expect(galleryBox).not.toBeNull()

      expectContains(galleryBox!, heartBox!)
    })

    test('below tablet the heart is over the FIRST photo, not the one peeking past it', async ({
      page,
    }) => {
      // Mobile-only on purpose. Above `tablet:` the layout is a 1-large + 2×2
      // mosaic and the top-right corner belongs to a small tile — the heart
      // correctly sits there, so asserting "first photo" at every width would
      // be asserting the mobile layout against the desktop one.
      test.skip(bp.width >= 744, 'the mosaic puts a different photo top-right')

      await page.goto(`/listings/${listing.id}`)
      await page.getByRole('heading', { level: 1 }).waitFor()

      const heartBox = await galleryHeart(page).boundingBox()
      const photoBox = await page
        .getByLabel(/^Photos of /)
        .locator('img')
        .first()
        .boundingBox()

      // The check that fails if the percentage offset is swapped for a fixed
      // one: a fixed inset lands on photo 1 at 375 and on photo 2 by 743.
      expectContains(photoBox!, heartBox!)
    })

    test('the gallery heart does not scroll away with the photo strip', async ({
      page,
    }) => {
      await page.goto(`/listings/${listing.id}`)
      await page.getByRole('heading', { level: 1 }).waitFor()

      const before = await galleryHeart(page).boundingBox()

      // Swipe the strip to the next photo. Above `tablet:` this is a no-op
      // (the container is a grid with overflow-hidden), which is the point —
      // the heart must be stationary at every width.
      await page.getByLabel(/^Photos of /).evaluate((node) => {
        node.scrollLeft = node.scrollWidth
      })
      await page.waitForTimeout(150)

      const after = await galleryHeart(page).boundingBox()
      expect(after!.x).toBeCloseTo(before!.x, 0)
      expect(after!.y).toBeCloseTo(before!.y, 0)
    })

    test('neither page scrolls horizontally with the heart added', async ({
      page,
    }) => {
      await page.goto('/')
      await page.getByRole('list', { name: 'Stays' }).waitFor()
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)

      await page.goto(`/listings/${listing.id}`)
      await page.getByRole('heading', { level: 1 }).waitFor()
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    })

    test('/favorites never scrolls horizontally', async ({ page }) => {
      await page.goto('/favorites')
      await page.getByRole('heading', { level: 1, name: 'Favorites' }).waitFor()
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    })
  })
}
