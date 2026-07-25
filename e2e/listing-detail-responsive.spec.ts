import { test, expect, type Page } from '@playwright/test'

/**
 * The DESIGN.md breakpoints, measured rather than eyeballed — the Phase 1
 * close-out found an 8/8 tap-target failure that reading the JSX had missed.
 *
 * `tablet:` is 744px, so 375 and 834 sit either side of the one boundary this
 * page's layout actually turns on.
 */
const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812, rail: false },
  { name: 'tablet', width: 834, height: 1112, rail: true },
  { name: 'laptop', width: 1280, height: 900, rail: true },
  { name: 'desktop', width: 1512, height: 950, rail: true },
] as const

const LISTING = '/listings/20000000-0000-4000-b000-000000000001'
const MIN_TAP_TARGET = 44

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
}

for (const bp of BREAKPOINTS) {
  test.describe(`${bp.name} (${bp.width}px)`, () => {
    test.use({ viewport: { width: bp.width, height: bp.height } })

    test('the page never scrolls horizontally', async ({ page }) => {
      await page.goto(LISTING)
      await page.getByRole('heading', { level: 1 }).waitFor()
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    })

    test(`the reservation card is ${bp.rail ? 'a right rail' : 'a bottom bar'}`, async ({
      page,
    }) => {
      await page.goto(LISTING)
      await page.getByRole('heading', { level: 1 }).waitFor()

      const rail = page.getByLabel('Reservation', { exact: true })
      const bar = page.getByLabel('Reservation summary')

      // Exactly one of the two is on screen at any width — never both, never
      // neither, which is what "collapses to a sticky bottom bar" has to mean.
      await expect(rail).toBeVisible({ visible: bp.rail })
      await expect(bar).toBeVisible({ visible: !bp.rail })
    })

    test('the visible Reserve control clears the 44px tap-target floor', async ({
      page,
    }) => {
      await page.goto(LISTING)
      await page.getByRole('heading', { level: 1 }).waitFor()

      const reserve = page
        .getByRole('button', { name: 'Reserve' })
        .filter({ visible: true })
      await expect(reserve).toHaveCount(1)

      const box = await reserve.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET)
    })

    test('every gallery photo stays inside the viewport', async ({ page }) => {
      await page.goto(LISTING)
      const gallery = page.getByLabel(/^Photos of /)
      await gallery.waitFor()

      const box = await gallery.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.width).toBeLessThanOrEqual(bp.width)
    })

    test('the bottom bar never hides the end of the page', async ({ page }) => {
      await page.goto(LISTING)
      await page.getByRole('heading', { level: 1 }).waitFor()
      await page.keyboard.press('End')

      // The reviews section is the last thing on the page; on mobile the fixed
      // bar sits over the document, so `pb-28` is what keeps it reachable.
      const last = page.getByText(/review|No reviews yet/).last()
      await expect(last).toBeInViewport()
    })
  })
}
