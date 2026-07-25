import { test, expect, type Page } from '@playwright/test'

import { AUTH_STATE_FILE } from './constants'
import {
  OTHER_USER_ID,
  addFavorite,
  clearFavorites,
  loadPublishedListings,
  readFavorites,
  testUserId,
} from './fixtures'

/**
 * The oracle is the `favorites` table read with the service key, never the page.
 * A spec that hearts a listing and then asserts the heart looks pressed proves
 * only that React re-rendered — it would pass with the server action deleted.
 *
 * Favorites are per-user global state and this suite runs `fullyParallel`
 * against one shared session, so **no spec asserts on a row count or on the
 * favorites page being empty**. Each claims a distinct listing by index and
 * cleans up only its own rows.
 */

/** Distinct per spec, so two workers can never contend for the same row. */
const SLOT = {
  savesFromGrid: 0,
  appearsInFavorites: 1,
  unsavesFromFavorites: 2,
  idempotent: 3,
  savesFromDetail: 4,
  otherUsersAreHidden: 5,
  signedOutWritesNothing: 6,
} as const

let listings: { id: string; title: string }[]
let userId: string

test.beforeAll(async () => {
  listings = await loadPublishedListings()
  userId = await testUserId()
})

function claim(slot: number) {
  return listings[slot]
}

/** The heart for one listing, located by its accessible name. */
function heartFor(page: Page, title: string) {
  return page.getByRole('button', {
    name: new RegExp(`(Save|Remove) ${escapeForRegex(title)}`),
  })
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// -----------------------------------------------------------------------------

test.describe('signed out', () => {
  test('the heart is shown, not hidden, on every card', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('list', { name: 'Stays' })).toBeVisible()

    const hearts = page.getByRole('button', { name: /^Sign in to save / })
    // One per card — the control advertises the feature rather than hiding it.
    expect(await hearts.count()).toBeGreaterThan(0)
  })

  test('the heart offers sign-in and carries the current path as next', async ({
    page,
  }) => {
    await page.goto('/')
    const form = page
      .getByRole('button', { name: /^Sign in to save / })
      .first()
      .locator('xpath=ancestor::form')

    await expect(form.locator('input[name="next"]')).toHaveValue('/')
  })

  test('next carries the search query, so hearting a filtered result returns to it', async ({
    page,
  }) => {
    await page.goto('/?city=Kyoto')
    const form = page
      .getByRole('button', { name: /^Sign in to save / })
      .first()
      .locator('xpath=ancestor::form')

    await expect(form.locator('input[name="next"]')).toHaveValue('/?city=Kyoto')
  })

  test('the listing page heart offers sign-in too', async ({ page }) => {
    const listing = claim(SLOT.savesFromDetail)
    await page.goto(`/listings/${listing.id}`)

    await expect(
      page.getByRole('button', { name: `Sign in to save ${listing.title}` }),
    ).toBeVisible()
  })

  test('no favorite row is written for a signed-out visitor', async ({ page }) => {
    // Scoped to one claimed listing, never to the whole user: this spec runs
    // beside signed-in specs that are legitimately writing rows for the same
    // account, so comparing before/after snapshots of readFavorites(userId)
    // measures their work, not this page's. (It did, on the first run.)
    const listing = claim(SLOT.signedOutWritesNothing)
    await clearFavorites(userId, [listing.id])

    await page.goto('/')
    const heart = heartFor(page, listing.title)

    // The signed-out control is a sign-in form, so there is no toggle to press
    // and nothing that can reach setFavorite.
    await expect(heart).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: `Sign in to save ${listing.title}` }),
    ).toBeVisible()

    expect(await readFavorites(userId)).not.toContain(listing.id)
  })
})

// -----------------------------------------------------------------------------

test.describe('signed in', () => {
  test.use({ storageState: AUTH_STATE_FILE })

  test('hearting a card on the home grid writes exactly one row', async ({
    page,
  }) => {
    const listing = claim(SLOT.savesFromGrid)
    await clearFavorites(userId, [listing.id])

    await page.goto('/')
    const heart = heartFor(page, listing.title)
    await expect(heart).toHaveAttribute('aria-pressed', 'false')
    await heart.click()
    await expect(heart).toHaveAttribute('aria-pressed', 'true')

    await expect
      .poll(async () => (await readFavorites(userId)).filter((id) => id === listing.id).length)
      .toBe(1)

    await clearFavorites(userId, [listing.id])
  })

  test('hearting a card does not navigate to the listing', async ({ page }) => {
    // The regression the ListingCard restructure exists to prevent: a <button>
    // nested inside the card's <a> both toggles AND follows the link.
    //
    // `await expect(page).toHaveURL('/')` is NOT the assertion to use here — it
    // matches instantly because the page is already at '/', so it resolves
    // before any navigation could occur and passes against the broken markup.
    // (F04's journal records the same trap from the other direction.) The wait
    // has to be a real signal, so we wait for the write to land and only then
    // read the URL.
    const listing = claim(SLOT.savesFromGrid)
    await clearFavorites(userId, [listing.id])

    await page.goto('/')
    await heartFor(page, listing.title).click()

    await expect
      .poll(async () => (await readFavorites(userId)).includes(listing.id))
      .toBe(true)
    await page.waitForLoadState('networkidle')

    expect(new URL(page.url()).pathname).toBe('/')

    await clearFavorites(userId, [listing.id])
  })

  test('a saved stay appears on /favorites', async ({ page }) => {
    const listing = claim(SLOT.appearsInFavorites)
    await addFavorite(userId, listing.id)

    await page.goto('/favorites')
    await expect(
      page.getByRole('list', { name: 'Saved stays' }).getByText(listing.title),
    ).toBeVisible()

    await clearFavorites(userId, [listing.id])
  })

  test('unhearting on /favorites deletes the row and drops the tile', async ({
    page,
  }) => {
    const listing = claim(SLOT.unsavesFromFavorites)
    await addFavorite(userId, listing.id)

    await page.goto('/favorites')
    const heart = heartFor(page, listing.title)
    await expect(heart).toHaveAttribute('aria-pressed', 'true')
    await heart.click()

    await expect
      .poll(async () => (await readFavorites(userId)).includes(listing.id))
      .toBe(false)

    await page.reload()
    await expect(page.getByText(listing.title)).toHaveCount(0)
  })

  test('saving the same stay twice leaves exactly one row', async ({ page }) => {
    // The idempotency proof, and the reason setFavorite takes the desired state
    // instead of flipping: two rapid clicks must converge, not double-write.
    const listing = claim(SLOT.idempotent)
    await clearFavorites(userId, [listing.id])

    await page.goto(`/listings/${listing.id}`)
    const heart = heartFor(page, listing.title)

    await heart.click()
    await expect
      .poll(async () => (await readFavorites(userId)).includes(listing.id))
      .toBe(true)

    // Unheart, then heart again — the same row, never a duplicate.
    await heart.click()
    await heart.click()

    await expect
      .poll(async () => (await readFavorites(userId)).filter((id) => id === listing.id).length)
      .toBe(1)

    await clearFavorites(userId, [listing.id])
  })

  test('hearting from the listing page writes the row', async ({ page }) => {
    const listing = claim(SLOT.savesFromDetail)
    await clearFavorites(userId, [listing.id])

    await page.goto(`/listings/${listing.id}`)
    await heartFor(page, listing.title).click()

    await expect
      .poll(async () => (await readFavorites(userId)).includes(listing.id))
      .toBe(true)

    await clearFavorites(userId, [listing.id])
  })

  test('the saved state survives a reload — it is in the database, not in React', async ({
    page,
  }) => {
    const listing = claim(SLOT.savesFromDetail)
    await addFavorite(userId, listing.id)

    await page.goto(`/listings/${listing.id}`)
    await expect(heartFor(page, listing.title)).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await clearFavorites(userId, [listing.id])
  })

  test('another user’s favorites are invisible', async ({ page }) => {
    const listing = claim(SLOT.otherUsersAreHidden)
    await clearFavorites(userId, [listing.id])
    await addFavorite(OTHER_USER_ID, listing.id)

    try {
      await page.goto('/favorites')
      await expect(page.getByText(listing.title)).toHaveCount(0)

      // And it must not read as saved on the public grid either.
      await page.goto(`/listings/${listing.id}`)
      await expect(heartFor(page, listing.title)).toHaveAttribute(
        'aria-pressed',
        'false',
      )
    } finally {
      await clearFavorites(OTHER_USER_ID, [listing.id])
    }
  })
})
