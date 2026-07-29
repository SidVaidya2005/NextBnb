import { test, expect, type Page } from '@playwright/test'

import { dayLabel } from './calendar'
import { addDay, todayISO } from './fixtures'

/**
 * The search bar at the four DESIGN.md breakpoints.
 *
 * Follows the precedent set by `nav-responsive.spec.ts`: the collapse
 * behaviours are asserted, not eyeballed. That spec caught a 40px tap target
 * that reading the JSX never would have — measuring the rendered box is the
 * only thing that finds those.
 */

const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812, mobileSearch: true },
  { name: 'tablet', width: 834, height: 1112, mobileSearch: false },
  { name: 'desktop', width: 1280, height: 900, mobileSearch: false },
  { name: 'wide', width: 1512, height: 950, mobileSearch: false },
] as const

/** code-standards.md: never ship a tap target below 44px. */
const MIN_TAP_TARGET = 44
/** DESIGN.md: the search orb is the most-tapped element and gets 48px. */
const MIN_ORB = 48

async function boxOf(page: Page, selector: ReturnType<Page['getByRole']>) {
  const box = await selector.boundingBox()
  expect(box, 'element should be rendered and visible').toBeTruthy()
  return box!
}

for (const breakpoint of BREAKPOINTS) {
  test.describe(`${breakpoint.name} (${breakpoint.width}px)`, () => {
    test.use({ viewport: { width: breakpoint.width, height: breakpoint.height } })

    test('shows the right search affordance for the breakpoint', async ({
      page,
    }) => {
      await page.goto('/')

      const pill = page.getByPlaceholder('Search destinations')

      if (breakpoint.mobileSearch) {
        // Below 744px the three segments collapse to one tappable pill.
        await expect(pill).toBeHidden()
        await expect(page.getByRole('button', { name: /Anywhere/ })).toBeVisible()
      } else {
        await expect(pill).toBeVisible()
        await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeVisible()
      }
    })

    test('the page never scrolls sideways', async ({ page }) => {
      await page.goto('/?city=Kyoto')

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })

    test('filter controls meet the tap-target floor', async ({ page }) => {
      await page.goto('/')
      await page.locator('summary').click()

      const apply = page.getByRole('button', { name: 'Show stays' })
      expect((await boxOf(page, apply)).height).toBeGreaterThanOrEqual(MIN_TAP_TARGET)

      const clear = page.getByRole('link', { name: 'Clear filters' })
      expect((await boxOf(page, clear)).height).toBeGreaterThanOrEqual(MIN_TAP_TARGET)

      // The whole amenity row is the label, so the row is the tap target.
      const amenity = page.getByText('Air conditioning')
      expect((await boxOf(page, amenity)).height).toBeGreaterThanOrEqual(MIN_TAP_TARGET)
    })
  })
}

test.describe('mobile search overlay', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('opens full-screen, searches, and closes', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: /Anywhere/ }).click()

    const overlay = page.getByRole('dialog', { name: 'Search stays' })
    await expect(overlay).toBeVisible()

    // Full-screen means exactly that — it must cover the viewport.
    const box = await overlay.boundingBox()
    expect(box!.width).toBe(375)
    expect(box!.height).toBe(812)

    await overlay.getByPlaceholder('Search destinations').fill('Kyoto')
    await overlay.getByRole('button', { name: 'Search', exact: true }).click()

    await expect(page).toHaveURL(/city=Kyoto/)
    await expect(overlay).toBeHidden()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stays in Kyoto')
  })

  test('the close button meets the tap-target floor', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Anywhere/ }).click()

    const close = page.getByRole('button', { name: 'Close search' })
    const box = await boxOf(page, close)
    expect(box.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET)
    expect(box.width).toBeGreaterThanOrEqual(MIN_TAP_TARGET)
  })
})

test.describe('desktop search pill', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('the search orb is at least 48px', async ({ page }) => {
    await page.goto('/')

    const orb = page.getByRole('button', { name: 'Search', exact: true })
    const box = await boxOf(page, orb)
    expect(box.width).toBeGreaterThanOrEqual(MIN_ORB)
    expect(box.height).toBeGreaterThanOrEqual(MIN_ORB)
  })

  test('the calendar opens, selects a range, and applies it', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Add dates' }).click()

    // Two months are visible from desktop; pick two selectable days in the first.
    const days = page.getByRole('button', { name: /^\w+day, \d+ \w+ \d{4}$/ })
    const enabled = days.and(page.locator(':not([disabled])'))

    await enabled.nth(1).click()
    await enabled.nth(4).click()

    await page.getByRole('button', { name: 'Done' }).click()
    await page.getByRole('button', { name: 'Search', exact: true }).click()

    await expect(page).toHaveURL(/checkIn=\d{4}-\d{2}-\d{2}/)
    await expect(page).toHaveURL(/checkOut=\d{4}-\d{2}-\d{2}/)
  })

  test('past dates cannot be selected', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Add dates' }).click()

    // **Both branches assert; neither skips.** This was written as a bare
    // `if (sameMonth) { … }`, which meant that on the 1st of every month the
    // only assertion about past dates silently evaporated and the test still
    // reported green — a hidden gap on ~3% of days, and exactly the class of
    // date-fragility F17 found in `host-availability-responsive.spec.ts`.
    // Yesterday is unreachable either way; which *way* is what differs.
    const yesterday = addDay(todayISO(), -1)
    const cell = page.getByRole('button', { name: dayLabel(yesterday), exact: true })

    if (yesterday.slice(0, 7) === todayISO().slice(0, 7)) {
      // Same month: the cell renders, and must be disabled.
      await expect(cell).toBeDisabled()
    } else {
      // We are on the 1st, so yesterday is in the previous month — which the
      // calendar never renders. Not-present is the stronger claim, and together
      // with the disabled "Previous month" below it means genuinely unreachable.
      await expect(cell).toHaveCount(0)
    }

    // Stepping back past the current month is not offered either.
    await expect(page.getByRole('button', { name: 'Previous month' })).toBeDisabled()
  })
})
