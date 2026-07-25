import { test, expect } from '@playwright/test'

import { AUTH_STATE_FILE } from './constants'
import {
  loadDraftListings,
  loadListingDetail,
  loadSeedSnapshot,
  type ListingDetailFixture,
} from './fixtures'

/**
 * Every expectation here is derived from the database, never from the page — the
 * lesson F05 and F06 both learned the hard way. A spec that reads a number off
 * the screen and asserts the screen shows it passes whatever the app does.
 */

// Seed listings chosen for the branch each one exercises.
const RATED_TWO = '20000000-0000-4000-b000-000000000001' // 2 reviews, no state, has rules
const RATED_ONE = '20000000-0000-4000-b000-000000000004' // 1 review — singular copy, 1.5 baths
const UNRATED = '20000000-0000-4000-b000-000000000008' // 0 reviews, cleaning_fee = 0, rules NULL
const WITH_STATE = '20000000-0000-4000-b000-000000000016' // state set — 4-part location
const NULL_AVATAR = '20000000-0000-4000-b000-000000000019' // reviewer Aiko Tanaka has no avatar

function href(id: string) {
  return `/listings/${id}`
}

test.describe('listing detail — content matches the database', () => {
  let listing: ListingDetailFixture

  test.beforeAll(async () => {
    listing = await loadListingDetail(RATED_TWO)
  })

  test('renders the listing’s title as the page heading', async ({ page }) => {
    await page.goto(href(RATED_TWO))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(listing.title)
  })

  test('renders every photo the listing has, and only those', async ({ page }) => {
    await page.goto(href(RATED_TWO))
    const gallery = page.getByLabel(`Photos of ${listing.title}`)
    await expect(gallery.locator('img')).toHaveCount(listing.photoCount)
  })

  test('renders the rating and review count the reviews table implies', async ({
    page,
  }) => {
    await page.goto(href(RATED_TWO))
    // Guard the fixture itself: if this listing ever loses its reviews the spec
    // below would pass vacuously.
    expect(listing.rating).not.toBeNull()
    expect(listing.reviewCount).toBeGreaterThan(1)

    await expect(
      page.getByText(`(${listing.reviewCount} reviews)`),
    ).toBeVisible()
    await expect(page.getByText(listing.rating!, { exact: true }).first()).toBeVisible()
  })

  test('renders every amenity the listing offers', async ({ page }) => {
    await page.goto(href(RATED_TWO))
    const amenities = page
      .getByRole('heading', { name: 'What this place offers' })
      .locator('xpath=following::ul[1]')
    await expect(amenities.getByRole('listitem')).toHaveCount(listing.amenityCount)
  })

  test('names the host', async ({ page }) => {
    await page.goto(href(RATED_TWO))
    expect(listing.hostName).toBeTruthy()
    await expect(page.getByText(`Hosted by ${listing.hostName}`)).toBeVisible()
  })

  test('drops a null state from the location line, leaving no stray comma', async ({
    page,
  }) => {
    await page.goto(href(RATED_TWO))
    // This listing has state = null, so the line is neighborhood, city, country.
    expect(listing.location.split(', ')).toHaveLength(3)
    await expect(page.getByText(listing.location, { exact: true })).toBeVisible()
  })

  test('renders all four parts when the listing does have a state', async ({
    page,
  }) => {
    const withState = await loadListingDetail(WITH_STATE)
    expect(withState.location.split(', ')).toHaveLength(4)

    await page.goto(href(WITH_STATE))
    await expect(page.getByText(withState.location, { exact: true })).toBeVisible()
  })
})

test.describe('listing detail — the branches that only some listings take', () => {
  test('uses singular copy for a listing with exactly one review', async ({
    page,
  }) => {
    const one = await loadListingDetail(RATED_ONE)
    expect(one.reviewCount).toBe(1)

    await page.goto(href(RATED_ONE))
    await expect(page.getByText('(1 review)')).toBeVisible()
    await expect(page.getByText('(1 reviews)')).toHaveCount(0)
  })

  test('an unreviewed listing shows the empty state and no rating number', async ({
    page,
  }) => {
    const unrated = await loadListingDetail(UNRATED)
    expect(unrated.reviewCount).toBe(0)

    await page.goto(href(UNRATED))
    await expect(page.getByText(/No reviews yet/)).toBeVisible()
    // The 64px display must not render — asserting only the empty text would
    // pass even if a "0.0" were also on screen.
    await expect(page.getByText(/^[0-5]\.\d$/, { exact: true })).toHaveCount(0)
  })

  test('omits the cleaning-fee row when the listing charges none', async ({
    page,
  }) => {
    const free = await loadListingDetail(UNRATED)
    expect(free.cleaningFeeCents).toBe(0)

    await page.goto(href(UNRATED))
    await expect(page.getByText('Cleaning fee')).toHaveCount(0)
  })

  test('omits house rules when the listing has none, but keeps check-in times', async ({
    page,
  }) => {
    const noRules = await loadListingDetail(UNRATED)
    expect(noRules.hasHouseRules).toBe(false)

    await page.goto(href(UNRATED))
    await expect(page.getByRole('heading', { name: 'Things to know' })).toBeVisible()
    await expect(page.getByText(/^After \d{1,2}:\d{2} (AM|PM)$/)).toBeVisible()
  })

  test('falls back to an icon for a reviewer with no avatar', async ({ page }) => {
    const fixture = await loadListingDetail(NULL_AVATAR)
    expect(fixture.reviewersWithoutAvatar.length).toBeGreaterThan(0)

    await page.goto(href(NULL_AVATAR))
    for (const name of fixture.reviewersWithoutAvatar) {
      // The fallback carries the name in an sr-only span; a real <img> does not.
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
    }

    // Scoped to the reviews region on purpose: the signed-out account menu in
    // the nav renders the same fallback icon, so an unscoped count is off by
    // one for a reason that has nothing to do with reviewers.
    const reviews = page.getByRole('region', { name: 'Reviews' })
    await expect(reviews.locator('svg.lucide-circle-user-round')).toHaveCount(
      fixture.reviewersWithoutAvatar.length,
    )
    // And the reviewers who *do* have an avatar get a real image, so this spec
    // cannot pass by every avatar falling back.
    await expect(reviews.locator('img')).toHaveCount(
      fixture.reviewCount - fixture.reviewersWithoutAvatar.length,
    )
  })
})

test.describe('listing detail — every published listing resolves', () => {
  // Driven through `request`, not `page`: this walks the whole catalogue, and
  // 24 full browser navigations in one test overruns the timeout under parallel
  // load. The server still renders the HTML, which is what is being asserted —
  // only the browser is skipped.
  test('all seeded published listings render their own title as the h1', async ({
    request,
  }) => {
    const snapshot = await loadSeedSnapshot()
    expect(snapshot.listings.length).toBeGreaterThanOrEqual(24)

    const mismatches: string[] = []

    for (const listing of snapshot.listings) {
      const response = await request.get(href(listing.id))
      if (response.status() !== 200) {
        mismatches.push(`${listing.title}: HTTP ${response.status()}`)
        continue
      }

      const heading = /<h1[^>]*>(.*?)<\/h1>/s.exec(await response.text())?.[1]
      if (decodeEntities(heading ?? '') !== listing.title) {
        mismatches.push(`${listing.title}: h1 was "${heading ?? '(none)'}"`)
      }
    }

    expect(mismatches, 'every published listing must render its own title').toEqual([])
  })
})

/** The few entities Next emits in text content; enough to compare a title. */
function decodeEntities(html: string): string {
  return html
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

test.describe('listing detail — drafts and bad ids are 404s', () => {
  test('a draft is a real 404 for a signed-out visitor, and leaks no title', async ({
    page,
  }) => {
    const drafts = await loadDraftListings()
    expect(drafts.length).toBeGreaterThan(0)

    for (const draft of drafts) {
      const response = await page.goto(href(draft.id))
      // The status matters as much as the body: a 200 would let a search engine
      // index an unpublished listing.
      expect(response?.status(), `${draft.title} must 404`).toBe(404)
      await expect(page.getByText(draft.title)).toHaveCount(0)
      // Matched loosely on purpose: `&apos;` renders a straight quote, and
      // pinning the apostrophe character makes the spec fail on punctuation.
      await expect(
        page.getByRole('heading', { name: /find that listing/i }),
      ).toBeVisible()
    }
  })

  test('a well-formed id that matches nothing is a 404', async ({ page }) => {
    const response = await page.goto(href('11111111-2222-4333-8444-555555555555'))
    expect(response?.status()).toBe(404)
  })

  test('a malformed id is a 404, not a database error', async ({ page }) => {
    const response = await page.goto(href('not-a-uuid'))
    expect(response?.status()).toBe(404)
  })
})

test.describe('listing detail — drafts stay hidden when signed in', () => {
  test.use({ storageState: AUTH_STATE_FILE })

  test('a draft owned by someone else is a 404 for a signed-in non-owner', async ({
    page,
  }) => {
    const drafts = await loadDraftListings()

    for (const draft of drafts) {
      const response = await page.goto(href(draft.id))
      expect(response?.status(), `${draft.title} must 404`).toBe(404)
      await expect(page.getByText(draft.title)).toHaveCount(0)
    }
  })

  test('a published listing still renders when signed in', async ({ page }) => {
    const listing = await loadListingDetail(RATED_TWO)
    await page.goto(href(RATED_TWO))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(listing.title)
  })
})
