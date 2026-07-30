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

    test('the visible reservation CTA clears the 44px tap-target floor', async ({
      page,
    }) => {
      await page.goto(LISTING)
      await page.getByRole('heading', { level: 1 }).waitFor()

      // F12 replaced F07's inert "Reserve" button, so the name changed with it.
      // Signed out — which this project is by default — the rail's CTA is the
      // sign-in form's submit, and the bar's is the control that opens the sheet.
      // **Scoped to its container deliberately:** the nav's SearchBar carries its
      // own "Add dates" button, and an unscoped name would match that instead.
      const container = page.getByLabel(
        bp.rail ? 'Reservation' : 'Reservation summary',
        { exact: true },
      )
      const cta = container.getByRole('button', {
        name: bp.rail ? 'Sign in to book' : 'Add dates',
        exact: true,
      })
      await expect(cta).toHaveCount(1)

      const box = await cta.boundingBox()
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

      // **F23 moved the end of the page.** This asserted the reviews section on
      // the stated premise that it "is the last thing on the page"; the footer
      // now is, so pressing End scrolls reviews above the fold and the old
      // assertion failed for a reason that was not a defect. The invariant it
      // exists to protect is unchanged — the fixed bar must not swallow the
      // document's final row — so the target moves to that row.
      const lastLine = page.getByRole('contentinfo').getByText(/Built by/)
      await expect(lastLine).toBeInViewport()

      // `toBeInViewport()` cannot see occlusion: an element sitting *under* a
      // fixed bar is still in the viewport, so the original form of this test
      // could not actually have caught the thing it is named for. Comparing
      // boxes can, and this is what the footer's mobile `pb-24` buys.
      const bar = page.getByLabel('Reservation summary')
      if (await bar.isVisible()) {
        // Polled, not read once. `boundingBox()` does not retry, and
        // `toBeInViewport()` above is satisfied by a PARTIALLY visible element —
        // so a single read lands mid-scroll and reports an overlap that settles
        // out a frame later. Measured while getting this wrong: 795px against a
        // bar top of 739px, which looked exactly like a real 56px overlap.
        await expect
          .poll(
            async () => {
              const lineBox = await lastLine.boundingBox()
              const barBox = await bar.boundingBox()
              if (!lineBox || !barBox) return Number.POSITIVE_INFINITY
              return lineBox.y + lineBox.height - barBox.y
            },
            { message: 'the last line is hidden behind the reserve bar' },
          )
          .toBeLessThanOrEqual(1)
      }
    })
  })
}
