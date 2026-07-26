import { test, expect, type Page } from '@playwright/test'

import { AUTH_STATE_FILE } from './constants'
import {
  addListingPhotoRow,
  createDraftListing,
  deleteListing,
  FIXTURE_CITY,
  loadPublishedListings,
  readListing,
  readListingPhotos,
  testUserId,
} from './fixtures'

/**
 * Creating a listing (F09).
 *
 * Every spec cleans up the rows it made. The suite runs `fullyParallel: true`
 * against one shared account, so a leaked *published* listing would move counts
 * other specs compare — which is why the publish spec deletes inside its own
 * body rather than waiting for afterEach.
 *
 * Cloudinary is never called: photo rows are inserted by fixtures with a
 * public_id shaped like a real upload's. The real upload hop is verified by hand
 * once and recorded in build-journal.md, exactly as F04 did for Google sign-in.
 */

const PHOTOS_URL = /\/host\/listings\/[0-9a-f-]{36}\/photos/

/**
 * The create form, addressed by its accessible name.
 *
 * Scoped on purpose: the nav's SearchBar carries its own "Guests" control, so a
 * page-wide `getByLabel('Guests')` is a strict-mode violation. Fourth time this
 * project has hit a locator coupled to something outside the thing under test
 * (F05's `getByText('0.0')` matching prices, F07's `circle-user-round` counting
 * the nav, F08's `input[name="next"]` matching hearts).
 */
const listingForm = (page: Page) => page.getByRole('form', { name: 'List your place' })

/** Fills every required field. Returns the title it used, which is unique. */
async function fillListingForm(page: Page, overrides: { title?: string } = {}) {
  const title = overrides.title ?? `E2E listing ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const form = listingForm(page)

  await form.getByLabel('Title').fill(title)
  await form.getByLabel('Description').fill('A quiet place to test from.')
  await form.getByLabel('Property type').selectOption('cabin')
  await form.getByLabel('City').fill(FIXTURE_CITY)
  await form.getByLabel('Country').fill('Testland')
  await form.getByLabel('State or region').fill('Test County')
  await form.getByLabel('Guests').fill('6')
  await form.getByLabel('Bedrooms').fill('3')
  await form.getByLabel('Beds').fill('4')
  await form.getByLabel('Bathrooms').fill('1.5')
  await form.getByLabel('Price per night (USD)').fill('249')
  await form.getByLabel('Cleaning fee (USD)').fill('35')
  await form.getByLabel('Minimum nights').fill('2')
  await form.getByLabel('Wi-Fi').check()
  await form.getByLabel('Kitchen').check()
  await form.getByLabel('House rules').fill('No parties.')

  return title
}

/** The listing id out of a `/host/listings/<id>/photos` URL. */
function listingIdFromUrl(url: string): string {
  const id = /\/host\/listings\/([0-9a-f-]{36})\/photos/.exec(url)?.[1]
  if (!id) throw new Error(`no listing id in ${url}`)
  return id
}

test.describe('signed out', () => {
  test('the proxy guards the create route', async ({ page }) => {
    await page.goto('/host/listings/new')

    await expect(page).toHaveURL(/signin=required/)
    await expect(page).toHaveURL(/next=%2Fhost%2Flistings%2Fnew/)
  })

  test('the proxy guards the photos route', async ({ page }) => {
    const listing = await createDraftListing()

    try {
      await page.goto(`/host/listings/${listing.id}/photos`)
      await expect(page).toHaveURL(/signin=required/)
    } finally {
      await deleteListing(listing.id)
    }
  })
})

test.describe('signed in', () => {
  test.use({ storageState: AUTH_STATE_FILE })

  test('creates a draft and moves to the photo step', async ({ page }) => {
    await page.goto('/host/listings/new')

    const title = await fillListingForm(page)
    await page.getByRole('button', { name: 'Save and add photos' }).click()

    await expect(page).toHaveURL(PHOTOS_URL)
    const id = listingIdFromUrl(page.url())

    try {
      // The oracle is the table, not the page that rendered it.
      const row = await readListing(id)
      expect(row).not.toBeNull()

      expect(row!.title).toBe(title)
      expect(row!.hostId).toBe(await testUserId())
      expect(row!.isPublished).toBe(false)
      expect(row!.city).toBe(FIXTURE_CITY)
      expect(row!.country).toBe('Testland')
      expect(row!.state).toBe('Test County')
      expect(row!.propertyType).toBe('cabin')
      expect(row!.maxGuests).toBe(6)
      expect(row!.bedrooms).toBe(3)
      expect(row!.beds).toBe(4)
      expect(row!.bathrooms).toBe(1.5)
      expect(row!.minNights).toBe(2)
      expect(row!.amenities.sort()).toEqual(['kitchen', 'wifi'])
      expect(row!.houseRules).toBe('No parties.')

      // Dollars in the form, integer cents in the column.
      expect(row!.pricePerNightCents).toBe(24_900)
      expect(row!.cleaningFeeCents).toBe(3_500)
    } finally {
      await deleteListing(id)
    }
  })

  test('stores a blank optional field as null, not an empty string', async ({ page }) => {
    await page.goto('/host/listings/new')

    await fillListingForm(page)
    await listingForm(page).getByLabel('State or region').fill('')
    await listingForm(page).getByLabel('House rules').fill('')
    await page.getByRole('button', { name: 'Save and add photos' }).click()

    await expect(page).toHaveURL(PHOTOS_URL)
    const id = listingIdFromUrl(page.url())

    try {
      const row = await readListing(id)
      // '' would render as an empty row on the detail page instead of being
      // omitted — the columns are nullable and the detail page checks for null.
      expect(row!.state).toBeNull()
      expect(row!.houseRules).toBeNull()
      expect(row!.neighborhood).toBeNull()
    } finally {
      await deleteListing(id)
    }
  })

  test('refuses a blank title and creates nothing', async ({ page }) => {
    await page.goto('/host/listings/new')

    await fillListingForm(page)
    await listingForm(page).getByLabel('Title').fill('   ')
    await page.getByRole('button', { name: 'Save and add photos' }).click()

    await expect(page.getByText('Give your place a title.')).toBeVisible()
    // Still on the form: no draft was created and no navigation happened.
    await expect(page).toHaveURL(/\/host\/listings\/new$/)
  })

  test('refuses a free listing', async ({ page }) => {
    await page.goto('/host/listings/new')

    await fillListingForm(page)
    await listingForm(page).getByLabel('Price per night (USD)').fill('0')
    await page.getByRole('button', { name: 'Save and add photos' }).click()

    await expect(page.getByText('Set a price above zero.')).toBeVisible()
    await expect(page).toHaveURL(/\/host\/listings\/new$/)
  })

  test('refuses more guests than the database allows', async ({ page }) => {
    await page.goto('/host/listings/new')

    await fillListingForm(page)
    await listingForm(page).getByLabel('Guests').fill('17')
    await page.getByRole('button', { name: 'Save and add photos' }).click()

    await expect(page.getByText('At most 16 guests.')).toBeVisible()
    await expect(page).toHaveURL(/\/host\/listings\/new$/)
  })

  test("404s on someone else's listing", async ({ page }) => {
    // A seed listing: hosted by a fake user, so the fixture account is a
    // non-owner even though RLS would happily show it (it is published).
    const [seedListing] = await loadPublishedListings()

    const response = await page.goto(`/host/listings/${seedListing.id}/photos`)

    expect(response?.status()).toBe(404)
    await expect(page.getByText(seedListing.title)).toHaveCount(0)
  })

  test('404s on a malformed listing id', async ({ page }) => {
    const response = await page.goto('/host/listings/not-a-uuid/photos')
    expect(response?.status()).toBe(404)
  })

  test('cannot publish without a photo', async ({ page }) => {
    const listing = await createDraftListing()

    try {
      await page.goto(`/host/listings/${listing.id}/photos`)

      const publish = page.getByRole('button', { name: 'Publish listing' })
      await expect(publish).toBeDisabled()
      // Disabled AND told why — a dead button with no reason reads as broken.
      await expect(page.getByText('Add at least one photo to publish.')).toBeVisible()

      expect((await readListing(listing.id))!.isPublished).toBe(false)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('publishes with a photo, sets exactly one cover, and reaches search', async ({
    page,
  }) => {
    const listing = await createDraftListing({ title: `E2E publish ${Date.now()}` })
    await addListingPhotoRow(listing.id, { position: 0 })
    await addListingPhotoRow(listing.id, { position: 1 })

    try {
      await page.goto(`/host/listings/${listing.id}/photos`)
      await page.getByRole('button', { name: 'Publish listing' }).click()

      // Publishing lands on the live listing page.
      await expect(page).toHaveURL(`/listings/${listing.id}`)

      const row = await readListing(listing.id)
      expect(row!.isPublished).toBe(true)

      // Uploads never claim the cover, so publish is what makes "exactly one"
      // true — the guarantee coverPhotoOf has been documenting since F05.
      const photos = await readListingPhotos(listing.id)
      expect(photos.filter((photo) => photo.isCover)).toHaveLength(1)
      expect(photos.find((photo) => photo.isCover)!.position).toBe(0)

      // It is now a real, findable stay.
      await page.goto(`/?city=${encodeURIComponent(FIXTURE_CITY)}`)
      await expect(page.getByText(listing.title).first()).toBeVisible()
    } finally {
      // Deleted here, not in afterEach: while this listing is published it is
      // visible to every parallel worker's search assertions.
      await deleteListing(listing.id)
    }
  })

  test('renders the draft notice on a draft the user hosts', async ({ page }) => {
    // The gap open since F07: RLS returns a draft to its owner, but both seed
    // drafts belong to fake users who cannot sign in, so no browser had ever
    // rendered this branch.
    const listing = await createDraftListing({ title: `E2E draft notice ${Date.now()}` })
    await addListingPhotoRow(listing.id, { position: 0, isCover: true })

    try {
      const response = await page.goto(`/listings/${listing.id}`)

      expect(response?.status()).toBe(200)
      await expect(page.getByRole('heading', { name: listing.title })).toBeVisible()
      await expect(page.getByText(/draft/i).first()).toBeVisible()
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('removes a photo', async ({ page }) => {
    const listing = await createDraftListing()
    await addListingPhotoRow(listing.id, { position: 0 })
    await addListingPhotoRow(listing.id, { position: 1 })

    try {
      await page.goto(`/host/listings/${listing.id}/photos`)
      await page.getByRole('button', { name: 'Remove photo 1' }).click()

      await expect
        .poll(async () => (await readListingPhotos(listing.id)).length)
        .toBe(1)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('reorders photos and makes one the cover', async ({ page }) => {
    const listing = await createDraftListing()
    const first = await addListingPhotoRow(listing.id, { position: 0 })
    const second = await addListingPhotoRow(listing.id, { position: 1 })

    try {
      await page.goto(`/host/listings/${listing.id}/photos`)

      await page.getByRole('button', { name: 'Move photo 1 later' }).click()
      await expect
        .poll(async () => {
          const photos = await readListingPhotos(listing.id)
          return photos.find((photo) => photo.id === first.id)!.position
        })
        .toBe(1)

      // Reload before clicking again. The controls are labelled by INDEX, and
      // the poll above only proved the *database* had moved — `router.refresh()`
      // may not have repainted yet, so "photo 2" could still mean the old photo.
      await page.reload()

      // "Make cover" also moves the photo to the front, so the host's order and
      // the gallery's cover-first order cannot disagree.
      await page.getByRole('button', { name: 'Make photo 2 the cover' }).click()
      await expect
        .poll(async () => {
          const photos = await readListingPhotos(listing.id)
          const cover = photos.find((photo) => photo.isCover)
          return cover ? `${cover.id}:${cover.position}` : 'none'
        })
        .toBe(`${first.id}:0`)

      expect(
        (await readListingPhotos(listing.id)).filter((photo) => photo.isCover),
      ).toHaveLength(1)
      expect(second.id).toBeTruthy()
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('the create page is reachable from the host area', async ({ page }) => {
    await page.goto('/host/listings')

    await page.getByRole('link', { name: 'List your place' }).click()
    await expect(page).toHaveURL('/host/listings/new')
    await expect(page.getByRole('heading', { name: 'List your place' })).toBeVisible()
  })
})
