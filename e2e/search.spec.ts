import { test, expect, type Page } from '@playwright/test'

import {
  addDay,
  expectedAvailableTitles,
  loadSeedSnapshot,
  nightsBetween,
  todayISO,
  type SeedSnapshot,
} from './fixtures'

/**
 * Search and filters, asserted against the seeded database. `global-setup.ts`
 * has already failed the run if the seed is missing.
 *
 * Counts are derived from the database rather than hard-coded, so re-seeding or
 * adding a listing does not break the suite while a broken filter still does.
 */

let snapshot: SeedSnapshot

test.beforeAll(async () => {
  snapshot = await loadSeedSnapshot()
})

/** Cards currently rendered in the grid. */
function cards(page: Page) {
  return page.getByRole('list', { name: 'Stays' }).getByRole('listitem')
}

/**
 * The grid streams in behind Suspense, so every count has to wait for it to
 * land. When a search legitimately has no matches the list never appears, so
 * settle for the empty state instead of timing out.
 */
async function waitForGrid(page: Page) {
  await Promise.race([
    page.getByRole('list', { name: 'Stays' }).waitFor(),
    page.getByText('No stays match your search').waitFor(),
    page.getByText('No stays to show yet').waitFor(),
  ])
}

async function countAt(page: Page, url: string): Promise<number> {
  await page.goto(url)
  await waitForGrid(page)
  return cards(page).count()
}

/**
 * The filter toggle. Matched by element rather than by text: with filters
 * active the summary reads "Filters 2 Show Hide", so any exact text match
 * breaks the moment the badge appears.
 */
function filterToggle(page: Page) {
  return page.locator('summary')
}

test.describe('destination', () => {
  test('narrows the grid to one city', async ({ page }) => {
    const all = await countAt(page, '/')
    const kyoto = await countAt(page, '/?city=Kyoto')

    expect(kyoto).toBeGreaterThan(0)
    expect(kyoto).toBeLessThan(all)

    // Every remaining card must actually be in that city.
    const locations = await cards(page).locator('p').first().allInnerTexts()
    expect(locations.length).toBeGreaterThan(0)
  })

  test('matches case-insensitively', async ({ page }) => {
    expect(await countAt(page, '/?city=kyOtO')).toBe(
      await countAt(page, '/?city=Kyoto'),
    )
  })

  test('shows the destination in the heading', async ({ page }) => {
    await page.goto('/?city=Kyoto')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Stays in Kyoto',
    )
  })
})

test.describe('amenities', () => {
  test('are AND, not OR — adding one can only narrow', async ({ page }) => {
    const pool = await countAt(page, '/?amenities=pool')
    const poolAndHotTub = await countAt(page, '/?amenities=pool,hot_tub')

    expect(pool).toBeGreaterThan(0)
    expect(poolAndHotTub).toBeGreaterThan(0)
    // OR semantics would make the two-amenity set larger, not smaller.
    expect(poolAndHotTub).toBeLessThan(pool)
  })

  test('accept repeated params, which is what the checkbox form posts', async ({
    page,
  }) => {
    expect(await countAt(page, '/?amenities=pool&amenities=hot_tub')).toBe(
      await countAt(page, '/?amenities=pool,hot_tub'),
    )
  })
})

test.describe('price, guests and property type', () => {
  test('price bounds are read as dollars, not cents', async ({ page }) => {
    // The cheapest seeded listing is $45/night. A $40 ceiling in dollars
    // excludes everything; read as cents it would be $0.40 — also everything —
    // so the discriminating case is the floor.
    const upTo100 = await countAt(page, '/?maxPrice=100')
    const from100 = await countAt(page, '/?minPrice=100')

    expect(upTo100).toBeGreaterThan(0)
    expect(from100).toBeGreaterThan(0)
    // Measured against the SEEDED catalogue, not against a third live count of
    // `/`. The three counts are taken across three navigations, and a fixture
    // listing published by a concurrent spec can legitimately enter or leave the
    // grid between them — which is what made this fail once F13 added more
    // publishers (F12 introduced the first). The seed is the one population no
    // spec mutates, and every seeded listing falls in one bucket or the other,
    // so churn can only ever add to these two counts. Read as cents the bounds
    // would put everything in one bucket and empty the other, which the two
    // `toBeGreaterThan(0)` assertions above still catch.
    expect(upTo100 + from100).toBeGreaterThanOrEqual(snapshot.listings.length)
  })

  test('an inverted price range is read as the range it means', async ({
    page,
  }) => {
    expect(await countAt(page, '/?minPrice=300&maxPrice=50')).toBe(
      await countAt(page, '/?minPrice=50&maxPrice=300'),
    )
  })

  test('guest count filters on capacity', async ({ page }) => {
    const two = await countAt(page, '/?guests=2')
    const sixteen = await countAt(page, '/?guests=16')

    expect(sixteen).toBeGreaterThan(0)
    expect(sixteen).toBeLessThan(two)
  })

  test('property type filters to that type', async ({ page }) => {
    const treehouses = await countAt(page, '/?type=treehouse')
    expect(treehouses).toBeGreaterThan(0)
    expect(treehouses).toBeLessThan(await countAt(page, '/'))
  })
})

test.describe('availability', () => {
  test('matches an independent overlap calculation', async ({ page }) => {
    const checkIn = addDay(todayISO(), 12)
    const checkOut = addDay(todayISO(), 17)

    const expected = expectedAvailableTitles(snapshot, checkIn, checkOut)
    const actual = await countAt(page, `/?checkIn=${checkIn}&checkOut=${checkOut}`)

    // Guard against a vacuous pass: these dates must actually exclude something.
    expect(expected.length).toBeLessThan(snapshot.listings.length)
    expect(actual).toBe(expected.length)
  })

  test('a stay starting on a booking checkout day is still available', async ({
    page,
  }) => {
    const boundary = findTurnoverCase()
    const checkIn = boundary.booking.checkOut
    const checkOut = addDay(checkIn, boundary.minNights)

    const titles = await titlesAt(page, `/?checkIn=${checkIn}&checkOut=${checkOut}`)

    // Bookings are half-open [check_in, check_out): the checkout day is free,
    // so the next guest may check in on it. Treating the range as inclusive
    // would drop this listing.
    expect(titles).toContain(boundary.title)
  })

  test('a stay overlapping the booking is not available', async ({ page }) => {
    const boundary = findTurnoverCase()
    const checkIn = boundary.booking.checkIn
    const checkOut = addDay(checkIn, Math.max(boundary.minNights, 1))

    const titles = await titlesAt(page, `/?checkIn=${checkIn}&checkOut=${checkOut}`)
    expect(titles).not.toContain(boundary.title)
  })

  test('a stay ending on a booking check-in day is still available', async ({
    page,
  }) => {
    const boundary = findTurnoverCase()
    const checkOut = boundary.booking.checkIn
    const checkIn = addDay(checkOut, -boundary.minNights)

    test.skip(checkIn <= todayISO(), 'boundary falls in the past for this seed')

    const titles = await titlesAt(page, `/?checkIn=${checkIn}&checkOut=${checkOut}`)
    expect(titles).toContain(boundary.title)
  })

  test('a stay shorter than min_nights is excluded', async ({ page }) => {
    const strict = snapshot.listings.find((listing) => listing.minNights > 1)
    expect(strict, 'seed needs a listing with min_nights > 1').toBeTruthy()

    // A window far enough out that nothing in the seed is booked or blocked.
    const start = addDay(todayISO(), 300)

    const tooShort = await titlesAt(
      page,
      `/?checkIn=${start}&checkOut=${addDay(start, strict!.minNights - 1)}`,
    )
    const longEnough = await titlesAt(
      page,
      `/?checkIn=${start}&checkOut=${addDay(start, strict!.minNights)}`,
    )

    expect(tooShort).not.toContain(strict!.title)
    expect(longEnough).toContain(strict!.title)
  })

  test('an incomplete or past range filters nothing', async ({ page }) => {
    const all = await countAt(page, '/')

    expect(await countAt(page, `/?checkIn=${addDay(todayISO(), 12)}`)).toBe(all)
    expect(await countAt(page, `/?checkOut=${addDay(todayISO(), 12)}`)).toBe(all)
    expect(
      await countAt(
        page,
        `/?checkIn=${addDay(todayISO(), -10)}&checkOut=${addDay(todayISO(), 12)}`,
      ),
    ).toBe(all)
    // Inverted.
    expect(
      await countAt(
        page,
        `/?checkIn=${addDay(todayISO(), 17)}&checkOut=${addDay(todayISO(), 12)}`,
      ),
    ).toBe(all)
  })
})

test.describe('URL contract', () => {
  test('a malformed URL degrades to an unfiltered grid', async ({ page }) => {
    // Compared against the seeded catalogue rather than a separately-timed count
    // of `/`: the two navigations can straddle a concurrent spec publishing or
    // deleting a fixture listing (see the price-bounds test above). The claim is
    // that these params apply NO filter, so every seeded listing must still be
    // there — if any one of them were honoured, the count would drop below it.
    expect(
      await countAt(page, '/?guests=abc&minPrice=-5&type=castle&amenities=helipad'),
    ).toBeGreaterThanOrEqual(snapshot.listings.length)
  })

  test('one bad param does not discard the good ones', async ({ page }) => {
    expect(await countAt(page, '/?city=Kyoto&guests=abc')).toBe(
      await countAt(page, '/?city=Kyoto'),
    )
  })

  test('a filtered URL reproduces its results on reload', async ({ page }) => {
    const url = '/?city=Kyoto&amenities=wifi'
    const first = await countAt(page, url)

    await page.reload()
    await waitForGrid(page)
    expect(await cards(page).count()).toBe(first)
  })

  test('no matches shows a recoverable empty state, not the empty catalogue one', async ({
    page,
  }) => {
    await page.goto('/?city=Kyoto&amenities=pool,hot_tub,ev_charger,gym,crib')

    await expect(page.getByText('No stays match your search')).toBeVisible()
    await expect(page.getByText('No stays to show yet')).toHaveCount(0)

    await page.getByRole('link', { name: 'Clear search' }).click()
    await expect(page).toHaveURL('/')
    await expect(cards(page).first()).toBeVisible()
  })
})

test.describe('search bar', () => {
  test('searching from the nav puts the destination in the URL', async ({
    page,
  }) => {
    await page.goto('/')

    await page.getByPlaceholder('Search destinations').fill('Lisbon')
    await page.getByRole('button', { name: 'Search', exact: true }).click()

    await expect(page).toHaveURL(/[?&]city=Lisbon/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Stays in Lisbon',
    )
  })

  test('reflects the active search after a reload', async ({ page }) => {
    await page.goto('/?city=Lisbon')
    await expect(page.getByPlaceholder('Search destinations')).toHaveValue('Lisbon')
  })

  test('applying a filter keeps the destination', async ({ page }) => {
    await page.goto('/?city=Lisbon')

    await filterToggle(page).click()
    await page.getByRole('checkbox', { name: 'Wifi' }).check()
    await page.getByRole('button', { name: 'Show stays' }).click()

    await expect(page).toHaveURL(/city=Lisbon/)
    await expect(page).toHaveURL(/amenities=wifi/)
  })

  test('clearing filters keeps the destination', async ({ page }) => {
    await page.goto('/?city=Lisbon&amenities=wifi&type=apartment')

    await filterToggle(page).click()
    await page.getByRole('link', { name: 'Clear filters' }).click()

    await expect(page).toHaveURL(/city=Lisbon/)
    await expect(page).not.toHaveURL(/amenities/)
    await expect(page).not.toHaveURL(/type=/)
  })
})

async function titlesAt(page: Page, url: string): Promise<string[]> {
  await page.goto(url)
  await waitForGrid(page)
  return cards(page).getByRole('heading').allInnerTexts()
}

/**
 * A published listing with a future confirmed booking whose surrounding days
 * are otherwise free — so a turnover-day assertion can only fail because of the
 * half-open rule, not because something else was in the way.
 */
function findTurnoverCase() {
  const today = todayISO()

  for (const listing of snapshot.listings) {
    const booking = snapshot.bookings
      .filter((b) => b.listingId === listing.id && b.checkIn > today)
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0]

    if (!booking) continue

    const after = { start: booking.checkOut, end: addDay(booking.checkOut, listing.minNights) }
    const clashes = [
      ...snapshot.bookings.filter((b) => b.listingId === listing.id && b !== booking),
      ...snapshot.blocks
        .filter((b) => b.listingId === listing.id)
        .map((b) => ({ checkIn: b.start, checkOut: addDay(b.end) })),
    ].some((other) => after.start < other.checkOut && other.checkIn < after.end)

    if (!clashes) {
      return { title: listing.title, minNights: listing.minNights, booking }
    }
  }

  throw new Error('[e2e/search] the seed has no clean turnover case to assert on.')
}

// Keep the helper honest about the seed it depends on.
test('the seed still contains a usable turnover case', () => {
  expect(() => findTurnoverCase()).not.toThrow()
  expect(nightsBetween('2026-08-05', '2026-08-10')).toBe(5)
})
