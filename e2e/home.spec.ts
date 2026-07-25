import { test, expect } from '@playwright/test'

/**
 * The home grid, asserted against the seeded database (24 published listings,
 * 2 drafts). `global-setup.ts` has already failed the run if the seed is
 * missing, so a thin grid here means a real regression, not empty fixtures.
 */

/** The seed publishes 24; assert a floor rather than the exact count so adding
 *  a listing does not break the suite, while a broken query still does. */
const MIN_EXPECTED_LISTINGS = 20

test('home page renders the NextBnb nav shell', async ({ page }) => {
  await page.goto('/')

  // The nav logo is the persistent shell element.
  await expect(page.getByRole('link', { name: 'NextBnb home' })).toBeVisible()

  // The home heading proves the page tree rendered.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('the grid renders the seeded published listings', async ({ page }) => {
  await page.goto('/')

  const cards = page.getByRole('list', { name: 'Stays' }).getByRole('listitem')
  await expect(cards.first()).toBeVisible()
  expect(await cards.count()).toBeGreaterThanOrEqual(MIN_EXPECTED_LISTINGS)
})

test('a card shows a cover photo, a price and a location', async ({ page }) => {
  await page.goto('/')

  const card = page
    .getByRole('list', { name: 'Stays' })
    .getByRole('listitem')
    .first()

  // The cover renders through next/image, so the src is the optimizer URL.
  const image = card.getByRole('img')
  await expect(image).toBeVisible()
  await expect(image).toHaveAttribute('src', /\/_next\/image/)

  // Prices come from formatPrice — integer cents rendered as USD.
  await expect(card).toContainText(/\$\d/)

  // "City, Country" from the listing row.
  await expect(card).toContainText(/\w+,\s\w+/)
})

test('listings with no reviews are marked New rather than rated 0', async ({
  page,
}) => {
  await page.goto('/')

  const stays = page.getByRole('list', { name: 'Stays' })

  // The seed has only 7 reviews across 26 listings, so most cards are unrated.
  await expect(stays.getByText('New').first()).toBeVisible()

  // ...but the rated ones must still show a real average, or "New everywhere"
  // would pass while the rating path was broken.
  await expect(stays.getByText(/^[1-5]\.\d$/).first()).toBeVisible()

  // A 0.0 means averageRating() lost its null: the DB constrains ratings to
  // 1-5, so 0.0 is unreachable from real data. `exact` matters — without it
  // this matches prices like "$180.00" instead of ratings.
  await expect(stays.getByText('0.0', { exact: true })).toHaveCount(0)
})

test('clicking a card opens that listing', async ({ page }) => {
  await page.goto('/')

  await page
    .getByRole('list', { name: 'Stays' })
    .getByRole('listitem')
    .first()
    .getByRole('link')
    .click()

  await expect(page).toHaveURL(
    /\/listings\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  )
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('draft listings never reach the grid', async ({ page }) => {
  await page.goto('/')

  // The two seeded drafts, by exact title — the word "Draft" appears only in
  // their descriptions, which a card does not render, so asserting on that
  // would pass no matter what. Their appearance here would mean both the
  // is_published filter and the RLS policy had failed.
  const stays = page.getByRole('list', { name: 'Stays' })
  await expect(stays.getByText('Belém Riverside Home')).toHaveCount(0)
  await expect(stays.getByText('Barton Creek Cottage')).toHaveCount(0)
})
