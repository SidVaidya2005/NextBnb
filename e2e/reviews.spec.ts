import { test, expect, type Locator, type Page } from '@playwright/test'

import { AUTH_STATE_FILE } from './constants'
import {
  addDay,
  addListingPhotoRow,
  createBookingRow,
  createDraftListing,
  deleteListing,
  deleteReviewRow,
  publishFixtureListing,
  readReviewForBooking,
  secondUserId,
  testUserId,
  todayISO,
} from './fixtures'
import { waitForHydration } from './hydration'

/**
 * Reviews & ratings (F15) — a guest reviewing a stay that has finished.
 *
 * **The oracle is the `reviews` table, never the page.** Rendered stars prove a
 * number reached a component; only the row proves the review is attached to the
 * right booking, the right listing and the right reviewer — and `listing_id`
 * matching the booking's is a condition
 * `reviews_insert_own_completed_booking` enforces, so getting it wrong is a
 * refused insert rather than a cosmetic slip.
 *
 * **Geometry: the second fixture account hosts, the primary one books.**
 * `trips.spec.ts`' arrangement, inherited for the same two reasons — a guest may
 * not book their own listing, and `listingsOwnedByFixtureUser` covers both
 * accounts so `deleteListing` in a `finally` sweeps every row by cascade.
 * Reviews need no sweep of their own: they cascade from both their booking and
 * their listing.
 *
 * **Every fixture stay is written by the service client**, because the states
 * this feature cares about are ones the app refuses to create: `createBooking`
 * rejects a past check-in outright, so a finished stay has no other way in.
 *
 * **No spec asserts a count or "the first card"** — `/trips` is per-user global
 * state and this suite runs `fullyParallel` against one shared session, so every
 * card is located by its own listing's unique title.
 */

/** A finished, confirmed, unreviewed stay held by the primary fixture account. */
async function completedStay(options?: { checkIn?: string; checkOut?: string }) {
  const hostId = await secondUserId()
  const guestId = await testUserId()
  const listing = await createDraftListing({ hostId })
  await addListingPhotoRow(listing.id, { isCover: true })
  await publishFixtureListing(listing.id, true)

  const booking = await createBookingRow(listing.id, {
    checkIn: options?.checkIn ?? addDay(todayISO(), -20),
    checkOut: options?.checkOut ?? addDay(todayISO(), -15),
    guestId,
  })

  return { listing, bookingId: booking.id }
}

const pastList = (page: Page) => page.getByRole('list', { name: 'Past trips' })
const upcomingList = (page: Page) => page.getByRole('list', { name: 'Upcoming trips' })

/** One trip card, found by its listing's (unique) title. */
const cardFor = (list: Locator, title: string) =>
  list.getByRole('listitem').filter({ hasText: title })

/** Controls scoped to one card, so none can match a sibling trip's. */
const postButton = (card: Locator) => card.getByRole('button', { name: /^Post your review of / })
const deleteButton = (card: Locator) =>
  card.getByRole('button', { name: /^Delete your review of / })
const ratingRadio = (card: Locator, stars: number) =>
  card.getByRole('radio', { name: `${stars} ${stars === 1 ? 'star' : 'stars'}` })
const commentBox = (card: Locator) => card.getByLabel(/Tell other guests about it/)

// -----------------------------------------------------------------------------

test.describe('leaving a review', () => {
  test.use({ storageState: AUTH_STATE_FILE })

  test('a finished stay can be reviewed, and the listing picks the rating up', async ({
    page,
  }) => {
    const { listing, bookingId } = await completedStay()

    try {
      await page.goto('/trips')
      const card = cardFor(pastList(page), listing.title)
      await expect(card).toBeVisible()

      const post = postButton(card)
      await waitForHydration(post)
      // Disabled until a rating is chosen — the client's only real guard, since
      // there is no resolver here and `rating` has no sensible default.
      await expect(post).toBeDisabled()

      await ratingRadio(card, 4).check()
      await commentBox(card).fill('Quiet street, excellent coffee downstairs.')
      await expect(post).toBeEnabled()
      await post.click()

      // The oracle. `listingId` and `reviewerId` are the two fields the page
      // cannot show and the INSERT policy will not tolerate being wrong.
      await expect.poll(async () => (await readReviewForBooking(bookingId))?.rating).toBe(4)
      const stored = await readReviewForBooking(bookingId)
      expect(stored).toMatchObject({
        listingId: listing.id,
        reviewerId: await testUserId(),
        rating: 4,
        comment: 'Quiet street, excellent coffee downstairs.',
      })

      // The card swaps to reading it back, and the form is gone.
      await expect(card.getByText('Your review')).toBeVisible()
      await expect(card.getByLabel('Rated 4 out of 5')).toBeVisible()
      await expect(card).toContainText('Quiet street, excellent coffee downstairs.')
      await expect(postButton(card)).toHaveCount(0)

      // The listing picks it up on both surfaces, which are separate code paths
      // over the same `averageRating`: the header line switches off "New"...
      await page.goto(`/listings/${listing.id}`)
      await expect(page.getByText('(1 review)')).toBeVisible()

      // ...and the 64px `rating-display-card`, which renders only once a listing
      // has reviews at all — so its presence is itself the assertion.
      const reviews = page.getByRole('region', { name: 'Reviews' })
      await expect(reviews.getByText('4.0', { exact: true })).toBeVisible()
      await expect(reviews.getByLabel('Rated 4 out of 5')).toBeVisible()
      // The guest's words, now public. The trip card showed them back to their
      // own author; this is the surface everyone else reads.
      await expect(reviews).toContainText('Quiet street, excellent coffee downstairs.')
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a star-only review is allowed, and stores a null comment', async ({ page }) => {
    // `reviews.comment` is nullable and ReviewsSection renders around a missing
    // one. The schema normalises '' to null, so the column must not hold ''.
    const { listing, bookingId } = await completedStay()

    try {
      await page.goto('/trips')
      const card = cardFor(pastList(page), listing.title)

      const post = postButton(card)
      await waitForHydration(post)
      await ratingRadio(card, 5).check()
      await post.click()

      await expect
        .poll(async () => (await readReviewForBooking(bookingId))?.rating)
        .toBe(5)
      expect((await readReviewForBooking(bookingId))?.comment).toBeNull()
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a review can be deleted, which returns the form and frees the booking to be re-reviewed', async ({
    page,
  }) => {
    // Reviews are immutable — `0006` revokes UPDATE outright — so this IS the
    // edit path, and both halves have to work for the feature to be honest.
    const { listing, bookingId } = await completedStay()

    try {
      await page.goto('/trips')
      const card = cardFor(pastList(page), listing.title)

      const post = postButton(card)
      await waitForHydration(post)
      await ratingRadio(card, 2).check()
      await commentBox(card).fill('Not for us.')
      await post.click()

      await expect.poll(async () => (await readReviewForBooking(bookingId))?.rating).toBe(2)

      const remove = deleteButton(card)
      await waitForHydration(remove)
      await remove.click()
      await card.getByRole('button', { name: /^Confirm deleting your review of / }).click()

      await expect.poll(async () => await readReviewForBooking(bookingId)).toBeNull()
      await expect(postButton(card)).toBeVisible()

      // Re-post: the whole point of delete-and-re-post as the edit path.
      await ratingRadio(card, 5).check()
      await postButton(card).click()
      await expect.poll(async () => (await readReviewForBooking(bookingId))?.rating).toBe(5)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a stay cannot be reviewed twice — and the same card proves one review posts', async ({
    page,
  }) => {
    // **F11's rule: a refusal needs a paired proof that the thing succeeds when
    // it should**, or the "no form" assertion may be measuring the setup.
    //
    // **F12's rule applied too:** submitting twice would prove nothing about
    // this feature — `reviews.booking_id` is unique, so Postgres would refuse
    // the second insert whether or not `canReviewBooking` knew about existing
    // reviews. The gate has to sit on the UI rule instead, so what is asserted
    // is that the FORM IS GONE. Deleting `hasReview` from `canReviewBooking`
    // makes this fail while every table-level assertion stays green.
    const { listing, bookingId } = await completedStay()

    try {
      await page.goto('/trips')
      const card = cardFor(pastList(page), listing.title)

      const post = postButton(card)
      await waitForHydration(post)
      await ratingRadio(card, 3).check()
      await post.click()

      // The positive control.
      await expect.poll(async () => (await readReviewForBooking(bookingId))?.rating).toBe(3)

      // The refusal, on a fresh load so it cannot be local state.
      await page.reload()
      const reloaded = cardFor(pastList(page), listing.title)
      await expect(reloaded.getByText('Your review')).toBeVisible()
      await expect(postButton(reloaded)).toHaveCount(0)
      await expect(ratingRadio(reloaded, 5)).toHaveCount(0)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('deleting a review that is already gone says so instead of reporting success', async ({
    page,
  }) => {
    // **The gate proof for `deleteReview`'s zero-row branch**, which is the one
    // thing that action uniquely does. RLS *filters* a DELETE rather than
    // raising, so a delete matching nothing returns `{ error: null }` and is
    // indistinguishable from one that worked (F13). With the `!data` branch
    // removed, this page reports a successful deletion of a review that some
    // other tab had already removed — and would report the same for a review
    // that was never the caller's.
    //
    // Reached through the UI with no forged request: the review is removed out
    // of band while the page sits open, which is two tabs or an admin.
    const { listing, bookingId } = await completedStay()

    try {
      await page.goto('/trips')
      const card = cardFor(pastList(page), listing.title)

      const post = postButton(card)
      await waitForHydration(post)
      await ratingRadio(card, 4).check()
      await post.click()

      await expect(deleteButton(card)).toBeVisible()
      const posted = await readReviewForBooking(bookingId)
      expect(posted).not.toBeNull()

      // Behind this page's back.
      await deleteReviewRow(posted!.id)

      const remove = deleteButton(card)
      await remove.click()
      await card.getByRole('button', { name: /^Confirm deleting your review of / }).click()

      await expect(card.getByRole('alert')).toContainText('could not be removed')
    } finally {
      await deleteListing(listing.id)
    }
  })
})

test.describe('stays that cannot be reviewed', () => {
  test.use({ storageState: AUTH_STATE_FILE })

  test('an upcoming stay offers no review form', async ({ page }) => {
    const { listing } = await completedStay({
      checkIn: addDay(todayISO(), 60),
      checkOut: addDay(todayISO(), 65),
    })

    try {
      await page.goto('/trips')
      const card = cardFor(upcomingList(page), listing.title)
      await expect(card).toBeVisible()
      await expect(postButton(card)).toHaveCount(0)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a stay under way offers no review form', async ({ page }) => {
    // Upcoming by `tripSection` (the guest is on it) and not yet reviewable:
    // `check_out < current_date` has not happened.
    const { listing } = await completedStay({
      checkIn: addDay(todayISO(), -2),
      checkOut: addDay(todayISO(), 3),
    })

    try {
      await page.goto('/trips')
      const card = cardFor(upcomingList(page), listing.title)
      await expect(card).toBeVisible()
      await expect(postButton(card)).toHaveCount(0)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a stay checking out today offers no review form', async ({ page }) => {
    // The exact boundary. The INSERT policy is `check_out < current_date`, so
    // the day the guest leaves is one day too early — `canReviewBooking` mirrors
    // that rather than widening it, and this is where a widened cutoff would
    // start offering a form the database refuses.
    const { listing } = await completedStay({
      checkIn: addDay(todayISO(), -4),
      checkOut: todayISO(),
    })

    try {
      await page.goto('/trips')
      const card = cardFor(upcomingList(page), listing.title)
      await expect(card).toBeVisible()
      await expect(postButton(card)).toHaveCount(0)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a cancelled stay is Past but never reviewable', async ({ page }) => {
    // Nobody stayed. `tripSection` files it under Past on status alone, and the
    // INSERT policy requires `status = 'confirmed'` for the same reason.
    const hostId = await secondUserId()
    const guestId = await testUserId()
    const listing = await createDraftListing({ hostId })
    await addListingPhotoRow(listing.id, { isCover: true })
    await publishFixtureListing(listing.id, true)

    try {
      await createBookingRow(listing.id, {
        checkIn: addDay(todayISO(), -20),
        checkOut: addDay(todayISO(), -15),
        guestId,
        status: 'cancelled',
      })

      await page.goto('/trips')
      const card = cardFor(pastList(page), listing.title)
      await expect(card).toBeVisible()
      await expect(card).toContainText('Cancelled')
      await expect(postButton(card)).toHaveCount(0)
    } finally {
      await deleteListing(listing.id)
    }
  })

  test('a stay whose listing was unpublished is still reviewable', async ({ page }) => {
    // The INSERT policy carries no `is_published` condition, the stay happened,
    // and `createReview` derives `listing_id` from the booking rather than from
    // anything the page rendered — so a null `listings` embed costs the title,
    // not the review. F13's posture on the same card.
    const { listing, bookingId } = await completedStay()

    try {
      await publishFixtureListing(listing.id, false)
      await page.goto('/trips')

      const card = pastList(page)
        .getByRole('listitem')
        .filter({ hasText: 'This listing is no longer available' })
        .first()
      await expect(card).toBeVisible()

      const post = postButton(card)
      await waitForHydration(post)
      await ratingRadio(card, 5).check()
      await post.click()

      // The row still lands on the right listing, which is the half the page
      // could not have told us.
      await expect
        .poll(async () => (await readReviewForBooking(bookingId))?.listingId)
        .toBe(listing.id)
    } finally {
      await deleteListing(listing.id)
    }
  })
})
