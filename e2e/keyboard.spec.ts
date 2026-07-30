import { test, expect, type Page } from '@playwright/test'

import { AUTH_STATE_FILE } from './constants'
import {
  addListingPhotoRow,
  createDraftListing,
  deleteListing,
  publishFixtureListing,
  secondUserId,
} from './fixtures'
import { waitForHydration } from './hydration'

/**
 * Keyboard operability and focus management — F18's accessibility pass.
 *
 * **What this file exists to catch, stated plainly:** before F18 there was no
 * `.focus()` call anywhere in `src/`. Two surfaces declared `aria-modal="true"`
 * while Tab walked straight out of them into the page behind, closing any
 * dismissable surface dropped focus to the top of the document, and the five
 * two-step confirms replaced the button under the user's focus with no
 * successor. None of that is visible in a screenshot, and none of it is
 * measurable by the responsive specs, which is why it survived seventeen
 * features.
 *
 * **Why hand-written rather than `@axe-core/playwright`** (agreed before build):
 * axe finds *static* ARIA violations and structurally cannot see "the dialog
 * never restores focus", which is the entirety of the debt here. A green axe run
 * over these surfaces before F18 would have told us nothing was wrong.
 *
 * **The trap test asserts the cycle, not the position.** Asserting merely that
 * focus is *somewhere inside* the dialog passes against no trap at all, because
 * focus starts inside. F08's rule: ask what a green assertion would still accept.
 * So the test tabs to the last control, presses Tab once more, and requires
 * focus to have wrapped to the first.
 *
 * **This file deliberately does not touch `profiles.is_admin`.** `admin.spec.ts`
 * owns that flag exclusively — `playwright.config.ts` sets `fullyParallel: true`,
 * which orders nothing *between* files, so a second file granting and revoking it
 * would race and the failure would read as a flaky redirect (F17's finding).
 *
 * **Consequence, stated rather than glossed:** the two admin confirm controls
 * (`AdminListingActions`, `AdminCancelBookingButton`) have **no focus assertion of
 * their own**. They use the identical `useFocusWhen(active, ref)` /
 * `useFocusWhen(!active, ref)` pairing gate-proved below on `ListingActions`, so
 * the *hook* is covered — but "the hook works and these components call it" is an
 * argument, not a test. Adding one belongs inside `admin.spec.ts`, next to the
 * flag that makes those controls reachable. Recorded in
 * `progress-tracker.md` → Untested branches.
 *
 * Every test here was gate-proved by reverting the hook call it covers — see
 * `build-journal.md` → F18.
 */

// -----------------------------------------------------------------------------
// The search overlay — `aria-modal="true"`, so it gets the full treatment.
// -----------------------------------------------------------------------------

test.describe('the mobile search overlay', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('Escape closes it and focus returns to the pill that opened it', async ({
    page,
  }) => {
    await page.goto('/')

    const pill = page.getByRole('button', { name: /Anywhere/ })
    await waitForHydration(pill)
    await pill.click()

    const overlay = page.getByRole('dialog', { name: 'Search stays' })
    await expect(overlay).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(overlay).toBeHidden()

    // The whole point: not merely closed, but closed with the user still where
    // they were. Before F18 this landed on BODY.
    await expect(pill).toBeFocused()
  })

  test('opening it moves focus inside, and Tab cycles without escaping', async ({
    page,
  }) => {
    await page.goto('/')

    const pill = page.getByRole('button', { name: /Anywhere/ })
    await waitForHydration(pill)
    await pill.click()

    const overlay = page.getByRole('dialog', { name: 'Search stays' })
    await expect(overlay).toBeVisible()

    // A trap that only wraps Tab does nothing until focus is inside it — if
    // focus stayed on the pill behind the overlay, the first Tab would leave
    // through the page and never reach the wrap logic.
    await expect(page.getByRole('button', { name: 'Close search' })).toBeFocused()

    // Walk to the last focusable control in the overlay, then one Tab past it.
    const focusable = overlay.locator(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
    )
    const count = await focusable.count()
    expect(count, 'the overlay should contain focusable controls').toBeGreaterThan(1)

    await focusable.nth(count - 1).focus()
    await page.keyboard.press('Tab')

    // Wrapped to the first control rather than falling through to the page.
    await expect(focusable.first()).toBeFocused()

    // And the same in reverse.
    await page.keyboard.press('Shift+Tab')
    await expect(focusable.nth(count - 1)).toBeFocused()
  })
})

// -----------------------------------------------------------------------------
// The desktop search calendar — a NON-modal popover, so Escape and restore only.
// -----------------------------------------------------------------------------

test.describe('the desktop search calendar', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('Escape closes it and focus returns to the date trigger', async ({ page }) => {
    await page.goto('/')

    const trigger = page.getByRole('button', { name: 'Add dates' })
    await waitForHydration(trigger)
    await trigger.click()

    const done = page.getByRole('button', { name: 'Done' })
    await expect(done).toBeVisible()

    // **This focus() is load-bearing — do not delete it as redundant.** Clicking
    // the trigger leaves focus *on* the trigger, and a non-modal popover never
    // moves it, so pressing Escape from here would land back on the trigger with
    // or without the restore. Written that way first, this test passed against a
    // build with the restore deleted (F08's rule, caught in F18's own gate
    // proof). Moving focus into the popover is what makes the assertion mean
    // "restored" rather than "never left".
    await done.focus()

    await page.keyboard.press('Escape')
    await expect(done).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('is not trapped — Tab may still leave it', async ({ page }) => {
    await page.goto('/')

    const trigger = page.getByRole('button', { name: 'Add dates' })
    await waitForHydration(trigger)
    await trigger.click()
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible()

    // Deliberate inverse of the overlay test. A popover is not modal, so
    // trapping it would strand a user who only meant to move on to the guest
    // select — this asserts we did NOT over-apply the trap.
    //
    // **The assertion is containment, not identity, and that distinction is the
    // whole test.** Written first as `expect(landed).not.toBe('Done')`, it
    // passed against a build with `trapFocus: true` wrongly set on this popover
    // — because a wrapped Tab lands on the popover's *first* control, which is
    // also not "Done". Asking "did focus leave the popover" is the only form of
    // this question that a trap can fail.
    await page.getByRole('button', { name: 'Done' }).focus()
    await page.keyboard.press('Tab')

    const stillInside = await page.evaluate(() => {
      const done = Array.from(document.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Done',
      )
      const popover = done?.closest('[class*="absolute"]')
      if (!popover) return null
      return popover.contains(document.activeElement)
    })

    expect(stillInside, 'focus should be able to leave a non-modal popover').toBe(false)
  })
})

// -----------------------------------------------------------------------------
// The account menu — `role="menu"`. Had Escape before F18; lacked the restore.
// -----------------------------------------------------------------------------

test.describe('the account menu', () => {
  test('Escape closes it and focus returns to the trigger', async ({ page }) => {
    await page.goto('/')

    const trigger = page.getByRole('button', { name: 'Account menu' })
    await waitForHydration(trigger)
    await trigger.click()

    const menu = page.getByRole('menu', { name: 'Account' })
    await expect(menu).toBeVisible()

    // Load-bearing, for the reason spelled out on the desktop calendar test:
    // without moving focus into the menu first, this assertion passes against a
    // build with no restore at all, because focus never left the trigger.
    await menu.getByRole('menuitem').first().focus()

    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()

    // Escape already closed the menu before F18 — the restore is what is new,
    // and it is the half a keyboard user actually notices.
    await expect(trigger).toBeFocused()
  })
})

// -----------------------------------------------------------------------------
// The booking surfaces on a real seeded listing.
// -----------------------------------------------------------------------------

/**
 * The reservation surfaces are located exactly as `booking-responsive.spec.ts`
 * does — by ARIA role on the `<aside>`, not by button text. An unscoped
 * `getByRole('button', { name: 'Add dates' })` matches the **nav search bar**
 * first, because `SearchBar` renders on every route and comes earlier in the
 * DOM. The first draft of this file did exactly that and tested the wrong
 * component on the right page.
 */
const rail = (page: Page) =>
  page.getByRole('complementary', { name: 'Reservation', exact: true })
const bar = (page: Page) =>
  page.getByRole('complementary', { name: 'Reservation summary', exact: true })

/**
 * A listing the fixture user can actually book: hosted by the *second* account,
 * because a host cannot book their own listing and the widget renders
 * differently when it spots one.
 */
async function bookableListing() {
  const hostId = await secondUserId()
  const listing = await createDraftListing({ hostId })
  await addListingPhotoRow(listing.id, { isCover: true })
  await publishFixtureListing(listing.id, true)
  return listing
}

test.describe('the booking widget calendar', () => {
  test.use({ storageState: AUTH_STATE_FILE, viewport: { width: 1280, height: 900 } })

  test('Escape closes the rail calendar and restores focus', async ({ page }) => {
    const listing = await bookableListing()

    try {
      await page.goto(`/listings/${listing.id}`)

      const trigger = rail(page).locator('button:has-text("Check-in")')
      await waitForHydration(trigger)
      await trigger.click()

      const done = rail(page).getByRole('button', { name: 'Done' })
      await expect(done).toBeVisible()

      // Load-bearing — see the desktop calendar test for why.
      await done.focus()

      await page.keyboard.press('Escape')
      await expect(done).toBeHidden()
      await expect(trigger).toBeFocused()
    } finally {
      await deleteListing(listing.id)
    }
  })
})

test.describe('the mobile reserve sheet', () => {
  test.use({ storageState: AUTH_STATE_FILE, viewport: { width: 375, height: 812 } })

  test('Escape closes it, focus restores, and Tab cycles inside', async ({ page }) => {
    const listing = await bookableListing()

    try {
      await page.goto(`/listings/${listing.id}`)

      const opener = bar(page).getByRole('button', { name: /Reserve|Add dates/ })
      await waitForHydration(opener)
      await opener.click()

      const sheet = page.getByRole('dialog', { name: /^Reserve / })
      await expect(sheet).toBeVisible()

      // Focus moved into the sheet on open.
      await expect(
        page.getByRole('button', { name: 'Close reservation' }),
      ).toBeFocused()

      const focusable = sheet.locator(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      )
      const count = await focusable.count()
      expect(count).toBeGreaterThan(1)

      await focusable.nth(count - 1).focus()
      await page.keyboard.press('Tab')
      await expect(focusable.first()).toBeFocused()

      await page.keyboard.press('Escape')
      await expect(sheet).toBeHidden()
      await expect(opener).toBeFocused()
    } finally {
      await deleteListing(listing.id)
    }
  })
})

// -----------------------------------------------------------------------------
// The two-step confirm pattern, asserted on the host's listing delete.
//
// The other four confirms (`CancelTripButton`, `TripReview`,
// `AdminListingActions`, `AdminCancelBookingButton`) use the identical
// `useFocusWhen(active, ref)` / `useFocusWhen(!active, ref)` pairing. This is
// the one whose confirm step is most consequential, and the one reachable
// without touching `profiles.is_admin` — see the file docblock on why that
// matters.
// -----------------------------------------------------------------------------

test.describe('a two-step confirm control', () => {
  test.use({ storageState: AUTH_STATE_FILE })

  test('focus follows the swap in both directions', async ({ page }) => {
    const listing = await createDraftListing({ title: `E2E keyboard ${Date.now()}` })

    try {
      await page.goto('/host/listings')

      const trigger = page.getByRole('button', { name: `Delete ${listing.title}` })
      await waitForHydration(trigger)
      await trigger.click()

      // Forward: the confirm that replaced the trigger now owns focus. Before
      // F18 the button vanished under the user and focus fell to BODY, leaving
      // them to tab back from the top of the page.
      const confirm = page.getByRole('button', {
        name: `Confirm deleting ${listing.title}`,
      })
      await expect(confirm).toBeFocused()

      // Back: dismissing returns focus to the control that opened it.
      await page.getByRole('button', { name: `Keep ${listing.title}` }).click()
      await expect(trigger).toBeFocused()
    } finally {
      await deleteListing(listing.id)
    }
  })
})

// -----------------------------------------------------------------------------
// Layout landmarks — the skip link and the main navigation region (F21).
//
// These two additions live in markup shared by all 16 routes, and one of them
// (the skip link) is invisible until Tab is pressed. That is the same class of
// state that let F18's focus bugs survive seventeen features and F20's
// `StarRating` announce silence from F15 to F19 — so it is asserted here rather
// than eyeballed once.
// -----------------------------------------------------------------------------

test.describe('layout landmarks', () => {
  test('the main navigation is an exposed landmark', async ({ page }) => {
    await page.goto('/')

    // `getByRole`, never `getByLabel`. F20: `getByLabel()` matches the
    // `aria-label` *attribute* rather than the computed accessible name, so it
    // resolves against markup no screen reader can read — which is exactly how
    // two specs asserted `StarRating`'s label and both passed the whole time.
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  })

  test('the skip link is the first Tab stop', async ({ page }) => {
    await page.goto('/')

    await page.keyboard.press('Tab')

    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  })

  test('activating the skip link moves focus past the navigation', async ({ page }) => {
    await page.goto('/')

    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to content' })
    await expect(skip).toBeFocused()

    // Enter, not `.click()` — this is the keyboard journey the feature exists
    // for, and a click would move focus by a different route than the one a
    // real user takes.
    await page.keyboard.press('Enter')

    // **This is the assertion that gates `tabIndex={-1}`.** Without it, <main>
    // never becomes document.activeElement — measured as BODY. A screen reader
    // announces arrival only at a genuinely focused element, so this is the line
    // that separates a working skip link from a bare scroll.
    await expect(page.locator('#main')).toBeFocused()

    // **Kept deliberately, and it does NOT gate `tabIndex={-1}`.** Chromium
    // implements the HTML Standard's "sequential focus navigation starting
    // point" fixup for fragment links: activating href="#main" moves the Tab
    // origin to #main whether or not that element is focusable, so this passes
    // with tabIndex present or absent. Measured, not assumed — with tabIndex
    // deleted, activeElement after Enter was BODY and the next Tab still landed
    // on a <summary> inside <main>.
    //
    // It stays because it documents the outcome a keyboard user actually gets,
    // and because WebKit has historically not implemented the same fixup — so it
    // would gate there if this suite ever grows a second browser project.
    await page.keyboard.press('Tab')

    const landedInsideMain = await page.evaluate(() => {
      const main = document.getElementById('main')
      const active = document.activeElement
      // `Node.contains` is true for the node itself, so `active !== main` is
      // what separates "moved into the content" from "still parked on the
      // target element".
      return !!(main && active && active !== main && main.contains(active))
    })

    expect(landedInsideMain, 'Tab after the skip link should land inside <main>').toBe(true)
  })
})
