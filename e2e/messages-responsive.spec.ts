import { test, expect, type Page } from '@playwright/test'

import { AUTH_STATE_FILE } from './constants'
import {
  addListingPhotoRow,
  createDraftListing,
  createMessageRow,
  createThreadRow,
  deleteListing,
  deleteThreads,
  publishFixtureListing,
  secondUserId,
  testUserId,
} from './fixtures'
import { waitForHydration } from './hydration'

/**
 * `/messages` and `/messages/[threadId]` at the DESIGN.md breakpoints.
 *
 * Widths are each band's **lower boundary**, where a row is tightest — sampling
 * band middles is how `nav-responsive.spec.ts` missed two real nav defects for a
 * whole feature (build-journal.md → F07).
 *
 * Two collapses matter here and neither is polish:
 * - The inbox **rail** appears only from `desktop:`; below it the thread owns the
 *   screen and the back link is the way out. 1128px is the boundary that decides
 *   both, so it is asserted in both directions rather than only its own.
 * - The **composer** is a textarea and a Send button on one row, which is the
 *   thing most likely to push a 320px column out.
 */
const WIDTHS = [
  { name: 'mobile-narrow', width: 320, height: 720 },
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 744, height: 1024 },
  { name: 'desktop', width: 1128, height: 720 },
  { name: 'wide', width: 1440, height: 900 },
]

/** The project's hard floor from code-standards.md — not DESIGN.md's 32px. */
const TAP_FLOOR = 44

test.use({ storageState: AUTH_STATE_FILE })

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, 'the page scrolls horizontally').toBeLessThanOrEqual(0)
}

/** A conversation this account holds, with messages long enough to test wrapping. */
async function conversation() {
  const hostId = await secondUserId()
  const guestId = await testUserId()
  const listing = await createDraftListing({ hostId, minNights: 30 })
  await addListingPhotoRow(listing.id, { isCover: true })
  await publishFixtureListing(listing.id, true)

  const thread = await createThreadRow({ guestId, hostId, listingId: listing.id })

  await createMessageRow({
    threadId: thread.id,
    senderId: hostId,
    // Deliberately unbroken: a long single "word" is what defeats a naive wrap
    // and pushes a bubble past its container.
    body: 'Absolutely—the-space-is-yours-from-three-onwards-and-there-is-parking-behind.',
  })
  await createMessageRow({
    threadId: thread.id,
    senderId: guestId,
    body: 'Perfect, thank you.',
  })

  return { listing, thread }
}

for (const { name, width, height } of WIDTHS) {
  test.describe(`${name} (${width}px)`, () => {
    test.use({ viewport: { width, height } })

    test('the inbox fits and a conversation row is tappable', async ({ page }) => {
      const { listing, thread } = await conversation()

      try {
        await page.goto('/messages')

        const row = page
          .getByRole('list', { name: 'Conversations' })
          .getByRole('listitem')
          .filter({ hasText: listing.title })

        await expect(row).toBeVisible()
        await expectNoHorizontalScroll(page)

        // The whole row is the target, so it is the row that has to clear the floor.
        const box = await row.getByRole('link').boundingBox()
        expect(box, 'the conversation row has no box').not.toBeNull()
        expect(
          box!.height,
          'the conversation row is below the tap floor',
        ).toBeGreaterThanOrEqual(TAP_FLOOR)
      } finally {
        await deleteThreads([thread.id])
        await deleteListing(listing.id)
      }
    })

    test('the thread fits, wraps long messages, and its composer is tappable', async ({
      page,
    }) => {
      const { listing, thread } = await conversation()

      try {
        await page.goto(`/messages/${thread.id}`)

        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        // Scoped to the message list: at `desktop:` the rail renders the same
        // text as this conversation's snippet, so an unscoped match resolves to
        // two elements and fails strict mode.
        await expect(
          page.getByRole('list', { name: 'Messages' }).getByText('Perfect, thank you.'),
        ).toBeVisible()
        // The unbroken-word bubble is on screen — this is the assertion the
        // fixture's long body exists for.
        await expectNoHorizontalScroll(page)

        const send = page.getByRole('button', { name: 'Send' })
        const box = await send.boundingBox()
        expect(box, 'the send control has no box').not.toBeNull()
        expect(
          Math.min(box!.width, box!.height),
          'the send control is below the tap floor',
        ).toBeGreaterThanOrEqual(TAP_FLOOR)

        // Typing grows nothing that overflows.
        const composer = page.getByLabel(/^Message /)
        await waitForHydration(composer)
        await composer.fill('A reply long enough to run past one line on a narrow screen.')
        await expectNoHorizontalScroll(page)
      } finally {
        await deleteThreads([thread.id])
        await deleteListing(listing.id)
      }
    })

    test(`the rail and back link swap at the desktop boundary`, async ({ page }) => {
      // **The collapse itself, asserted in both directions at every width.** The
      // rail is `desktop:`-only and the back link is its inverse, so exactly one
      // of them is on screen at any width — a rule that would otherwise be
      // verified only by looking.
      const { listing, thread } = await conversation()

      try {
        await page.goto(`/messages/${thread.id}`)

        const rail = page.getByRole('list', { name: 'Conversations' })
        const back = page.getByRole('link', { name: 'Back to inbox' })
        const isDesktop = width >= 1128

        if (isDesktop) {
          await expect(rail).toBeVisible()
          await expect(back).toBeHidden()
          // The open conversation is marked in the rail — the thing a shared
          // `layout.tsx` could not have done.
          await expect(rail.getByRole('link', { name: new RegExp(listing.title) })).toHaveAttribute(
            'aria-current',
            'page',
          )
        } else {
          await expect(rail).toBeHidden()
          await expect(back).toBeVisible()
        }

        await expectNoHorizontalScroll(page)
      } finally {
        await deleteThreads([thread.id])
        await deleteListing(listing.id)
      }
    })

    test('the empty state fits', async ({ page }) => {
      // No fixture: whatever this shared account currently holds, the shell and
      // its heading must fit. Asserting on emptiness itself would race the
      // parallel workers messaging on this same account.
      await page.goto('/messages')

      await expect(page.getByRole('heading', { name: 'Messages', level: 1 })).toBeVisible()
      await expectNoHorizontalScroll(page)
    })
  })
}
