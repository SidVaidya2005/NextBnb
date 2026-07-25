import { test, expect, type Page } from '@playwright/test'

/**
 * Responsive verification of the home listing grid at the four DESIGN.md
 * breakpoints. The rule this guards is "grids drop columns, never reflow rows"
 * — which is invisible from reading the JSX and only provable by measuring where
 * the rendered cards actually sit.
 *
 * Widths are representative points INSIDE each band, not the boundaries:
 * mobile <744 / tablet 744-1128 / desktop 1128-1440 / wide >1440.
 */
const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812, columns: 1 },
  { name: 'tablet', width: 834, height: 1112, columns: 2 },
  { name: 'desktop', width: 1280, height: 800, columns: 4 },
  { name: 'wide', width: 1512, height: 900, columns: 4 },
] as const

/**
 * How many cards share the first row, measured from their bounding boxes.
 *
 * Cards in one CSS grid row share a `y`, but sub-pixel layout means "share"
 * has to be a tolerance rather than equality.
 */
async function countCardsInFirstRow(page: Page): Promise<number> {
  const cards = page.getByRole('list', { name: 'Stays' }).getByRole('listitem')
  await expect(cards.first()).toBeVisible()

  const boxes = await cards.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().top),
  )
  if (boxes.length === 0) return 0

  const firstRowTop = boxes[0]
  return boxes.filter((top) => Math.abs(top - firstRowTop) < 4).length
}

for (const bp of BREAKPOINTS) {
  test(`${bp.name} (${bp.width}px): the grid is ${bp.columns}-up`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height })
    await page.goto('/')

    expect(
      await countCardsInFirstRow(page),
      `${bp.name}: expected ${bp.columns} cards per row`,
    ).toBe(bp.columns)
  })

  test(`${bp.name} (${bp.width}px): the page never scrolls sideways`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height })
    await page.goto('/')

    await expect(
      page.getByRole('list', { name: 'Stays' }).getByRole('listitem').first(),
    ).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `${bp.name}: horizontal overflow of ${overflow}px`).toBeLessThanOrEqual(0)
  })
}
