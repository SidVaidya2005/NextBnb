import { test, expect, type Page } from '@playwright/test'

/**
 * Responsive verification of the footer (F23) at the DESIGN.md breakpoints.
 *
 * Bands: mobile <744 / tablet 744-1128 / desktop 1128-1440 / wide >1440.
 *
 * **The lower boundary of each band is sampled, not its middle** — F21's rule,
 * earned by two defects that middle-of-band sampling missed. A band's tightest
 * point is its first pixel.
 *
 * The column assertion is geometric rather than class-based: three headings
 * sharing a `y` is what "3-up" actually means to a reader, and it fails if
 * `tablet:grid-cols-3` is removed. Asserting the class name instead would pass
 * against a grid that had collapsed for any other reason.
 */
const BREAKPOINTS = [
  { name: 'mobile-narrow', width: 320, height: 700, stacked: true },
  { name: 'mobile', width: 375, height: 812, stacked: true },
  { name: 'tablet-min', width: 744, height: 1000, stacked: false },
  { name: 'tablet', width: 834, height: 1112, stacked: false },
  { name: 'desktop-min', width: 1128, height: 800, stacked: false },
  { name: 'desktop', width: 1280, height: 800, stacked: false },
  { name: 'wide', width: 1512, height: 900, stacked: false },
] as const

/** code-standards.md: "never ship a tap target below 44px". */
const MIN_TAP_TARGET = 44

const GROUPS = ['Discover', 'Travelling', 'Hosting'] as const

/**
 * All three heading positions read in ONE evaluate, deliberately.
 *
 * Three separate `boundingBox()` calls are three separate round trips, and an
 * image finishing above the footer between the first and the third shifts the
 * footer underneath them — so the three `y` values come from three different
 * layouts and "share a row" fails on a footer that is laid out perfectly. That
 * is not hypothetical: this spec passed in isolation and failed at `desktop` in a
 * full-suite run, where images load under contention. Measuring in one frame
 * makes the comparison scroll- and reflow-invariant, because only the RELATIVE
 * positions matter.
 *
 * Scoped to <footer> as well, so it cannot pick up a same-named string
 * elsewhere on the page.
 */
async function headingBoxes(page: Page) {
  const boxes = await page.evaluate((groups) => {
    const footer = document.querySelector('footer')
    if (!footer) return []
    return groups.map((group) => {
      const el = Array.from(footer.querySelectorAll('p')).find(
        (p) => p.textContent?.trim() === group,
      )
      if (!el) return null
      const rect = el.getBoundingClientRect()
      return { group, x: rect.x, y: rect.y }
    })
  }, GROUPS as unknown as string[])

  for (const box of boxes) {
    expect(box, 'each group heading should be found in the footer').not.toBeNull()
  }
  return boxes.filter((box): box is { group: string; x: number; y: number } => box !== null)
}

for (const bp of BREAKPOINTS) {
  test(`footer at ${bp.name} (${bp.width}px)`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height })
    await page.goto('/')

    const footer = page.getByRole('contentinfo')
    await footer.scrollIntoViewIfNeeded()
    await expect(footer).toBeVisible()

    const box = await footer.boundingBox()
    expect(box, 'footer should have a box').not.toBeNull()
    if (!box) return

    // Horizontal overflow is unreachable content, not merely untidy.
    expect.soft(box.x, `${bp.name}: footer overflows the left edge`).toBeGreaterThanOrEqual(0)
    expect
      .soft(box.x + box.width, `${bp.name}: footer overflows the right edge`)
      .toBeLessThanOrEqual(bp.width + 1)

    const headings = await headingBoxes(page)
    expect(headings).toHaveLength(3)

    if (bp.stacked) {
      // Grids drop columns rather than reflowing rows: below tablet: every group
      // starts a new row, so each heading sits lower than the last.
      expect
        .soft(headings[1].y, `${bp.name}: groups should stack`)
        .toBeGreaterThan(headings[0].y)
      expect
        .soft(headings[2].y, `${bp.name}: groups should stack`)
        .toBeGreaterThan(headings[1].y)
    } else {
      // 3-up: same row, increasing x.
      expect
        .soft(Math.abs(headings[1].y - headings[0].y), `${bp.name}: groups should share a row`)
        .toBeLessThanOrEqual(1)
      expect
        .soft(Math.abs(headings[2].y - headings[0].y), `${bp.name}: groups should share a row`)
        .toBeLessThanOrEqual(1)
      expect.soft(headings[1].x, `${bp.name}: columns should advance`).toBeGreaterThan(headings[0].x)
      expect.soft(headings[2].x, `${bp.name}: columns should advance`).toBeGreaterThan(headings[1].x)
    }

    if (bp.stacked) {
      // Thumb-sized targets are only required where the input is a thumb.
      const links = await footer.getByRole('link').all()
      expect(links.length).toBeGreaterThan(0)

      for (const link of links) {
        const linkBox = await link.boundingBox()
        if (!linkBox) continue
        // Only ONE link is exempt: the name inside the "Built by …" sentence,
        // which cannot be stretched to 44px without breaking the line box. The
        // LinkedIn / Email me / Source row is a set of discrete controls and is
        // held to the floor like the navigation rows.
        const label = (await link.textContent())?.trim() ?? ''
        if (label === 'Siddarth Vaidya') continue

        expect
          .soft(linkBox.height, `${bp.name}: "${label}" tap target is under ${MIN_TAP_TARGET}px`)
          .toBeGreaterThanOrEqual(MIN_TAP_TARGET)
      }
    }
  })
}
