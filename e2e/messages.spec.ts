import { test, expect, type Page } from '@playwright/test'

import { AUTH_STATE_FILE, SECOND_AUTH_STATE_FILE } from './constants'
import {
  OTHER_USER_ID,
  addListingPhotoRow,
  createDraftListing,
  createMessageRow,
  createThreadRow,
  deleteListing,
  deleteThreads,
  publishFixtureListing,
  readMessages,
  readThread,
  readThreadsFor,
  secondUserId,
  testUserId,
} from './fixtures'
import { waitForHydration } from './hydration'

/**
 * Guest ↔ host messaging (F16).
 *
 * **The oracle is the `messages` / `message_threads` tables, never the page.**
 * Two of this feature's claims are invisible on screen: that a thread carries the
 * right two participants (`getOrCreateThread` derives both, because the INSERT
 * policy is an OR and would accept a stranger), and that a read receipt is an
 * *asymmetry* — incoming messages stamped, your own left alone.
 *
 * **Geometry: the second fixture account hosts, the primary one messages.**
 * `reviews.spec.ts`' arrangement, inherited for the same reason — a host cannot
 * message their own listing, so the two ends must be different principals.
 *
 * **Threads need explicit cleanup.** Unlike every other fixture row in this
 * suite they do not cascade with their listing (`on delete set null`), so each
 * spec deletes its own and `global-teardown.ts` sweeps the rest. Deleting the
 * thread takes its messages with it.
 */

/** A published listing owned by the second fixture account, ready to be messaged about. */
async function hostedListing() {
  const hostId = await secondUserId()
  const listing = await createDraftListing({ hostId, minNights: 30 })
  await addListingPhotoRow(listing.id, { isCover: true })
  await publishFixtureListing(listing.id, true)
  return listing
}

const threadList = (page: Page) => page.getByRole('list', { name: 'Conversations' })
const composer = (page: Page) => page.getByLabel(/^Message /)
const sendButton = (page: Page) => page.getByRole('button', { name: 'Send' })

/**
 * The message bubbles, scoped.
 *
 * **Unscoped `getByText` on a message body is a strict-mode violation waiting to
 * happen**, and it fires intermittently rather than always: at `desktop:` the
 * inbox rail sits beside the thread rendering the same text as that
 * conversation's snippet, so whether there are one or two matches depends on
 * whether `revalidatePath('/messages')` has landed. Scoping asserts the thing
 * that was meant — the message is in the conversation — and the rail is asserted
 * separately where that is the point.
 */
const messageList = (page: Page) => page.getByRole('list', { name: 'Messages' })

/**
 * Where two known conversations sit relative to each other in the inbox.
 *
 * **Deliberately not `.first()`.** `/messages` is per-user global state and the
 * suite runs `fullyParallel` against one shared account, so a sibling worker's
 * conversation can legitimately hold the top row — the same trap
 * `favorites.spec.ts` records for "the first card". Both indices come from one
 * DOM snapshot, so the comparison cannot straddle a re-render.
 */
async function inboxOrder(page: Page, first: string, second: string) {
  await expect(threadList(page)).toBeVisible()
  const rows = await threadList(page).getByRole('listitem').allTextContents()

  const at = (title: string) => {
    const index = rows.findIndex((row) => row.includes(title))
    expect(index, `no conversation for ${title}`).toBeGreaterThanOrEqual(0)
    return index
  }

  return { first: at(first), second: at(second) }
}

/** The thread id from `/messages/<uuid>`. */
function threadIdFromUrl(page: Page): string {
  const id = new URL(page.url()).pathname.split('/').pop()
  if (!id) throw new Error(`no thread id in ${page.url()}`)
  return id
}

// -----------------------------------------------------------------------------

test.describe('starting and holding a conversation', () => {
  test.use({ storageState: AUTH_STATE_FILE })

  test('a guest messages a host from the listing, and the message lands on the right thread', async ({
    page,
  }) => {
    const listing = await hostedListing()
    let threadId: string | null = null

    try {
      await page.goto(`/listings/${listing.id}`)

      const open = page.getByRole('button', { name: /^Message / })
      await waitForHydration(open)
      await open.click()

      await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}$/)
      threadId = threadIdFromUrl(page)

      // The half the page cannot show: both participants are derived, never sent
      // by the client. `guest_id` comes from the session and `host_id` from the
      // listing — the INSERT policy alone would have accepted anything.
      expect(await readThread(threadId)).toMatchObject({
        guestId: await testUserId(),
        hostId: await secondUserId(),
        listingId: listing.id,
      })

      await expect(page.getByText('No messages yet.')).toBeVisible()

      const box = composer(page)
      await waitForHydration(box)
      await box.fill('Is there parking nearby?')
      await sendButton(page).click()

      // The oracle. `senderId` is stamped from the session, so a wrong one is a
      // refused insert rather than a cosmetic slip.
      await expect.poll(async () => (await readMessages(threadId!)).length).toBe(1)
      expect(await readMessages(threadId)).toMatchObject([
        { senderId: await testUserId(), body: 'Is there parking nearby?' },
      ])

      // Painted immediately from the action's return value, and the composer clears.
      await expect(messageList(page).getByText('Is there parking nearby?')).toBeVisible()
      await expect(box).toHaveValue('')
      // Exactly once — the sender receives their own INSERT back over Realtime
      // after already painting it, so this is `appendUnique`'s gate.
      await expect(messageList(page).getByRole('listitem')).toHaveCount(1)
    } finally {
      if (threadId) await deleteThreads([threadId])
      await deleteListing(listing.id)
    }
  })

  test('messaging the same host about the same listing twice reuses one conversation', async ({
    page,
  }) => {
    // Idempotency, which only the row count can show — the page renders one
    // conversation either way. `message_threads_unique_participants` makes the
    // second insert impossible; `getOrCreateThread` is what turns that from an
    // error into the same thread.
    const listing = await hostedListing()
    const scope = {
      guestId: await testUserId(),
      hostId: await secondUserId(),
      listingId: listing.id,
    }

    try {
      await page.goto(`/listings/${listing.id}`)
      const open = page.getByRole('button', { name: /^Message / })
      await waitForHydration(open)
      await open.click()
      await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}$/)
      const first = threadIdFromUrl(page)

      // Back to the listing and again — a real user losing their place, not a
      // forged double submit.
      await page.goto(`/listings/${listing.id}`)
      const again = page.getByRole('button', { name: /^Message / })
      await waitForHydration(again)
      await again.click()
      await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}$/)

      expect(threadIdFromUrl(page)).toBe(first)
      expect(await readThreadsFor(scope)).toHaveLength(1)
    } finally {
      await deleteThreads(await readThreadsFor(scope))
      await deleteListing(listing.id)
    }
  })

  test('a message from the host arrives without a reload', async ({ page }) => {
    // Live delivery. Inserted out of band, because the point is that it arrives
    // from someone who is not driving this browser — and Realtime applies RLS per
    // subscriber, so receiving it at all is also proof the policy admits us.
    const listing = await hostedListing()
    const thread = await createThreadRow({
      guestId: await testUserId(),
      hostId: await secondUserId(),
      listingId: listing.id,
    })

    try {
      await page.goto(`/messages/${thread.id}`)
      await waitForHydration(composer(page))
      await expect(page.getByText('No messages yet.')).toBeVisible()

      // **Wait for the channel, not for hydration.** Subscribing is a round trip
      // — read the session, hand the socket its token, join — so the page is
      // interactive well before it is listening, and Postgres Changes does not
      // replay what it missed. Inserting in that window makes this spec fail
      // for a reason that has nothing to do with delivery working.
      await expect(messageList(page)).toHaveAttribute('data-live', 'live')

      await createMessageRow({
        threadId: thread.id,
        senderId: await secondUserId(),
        body: 'Yes — one space behind the building.',
      })

      // No reload anywhere in this spec. A generous timeout because this is a
      // websocket round trip through Supabase, not a local render.
      await expect(
        messageList(page).getByText('Yes — one space behind the building.'),
      ).toBeVisible({ timeout: 20_000 })
    } finally {
      await deleteThreads([thread.id])
      await deleteListing(listing.id)
    }
  })
})

test.describe('the inbox', () => {
  test.use({ storageState: AUTH_STATE_FILE })

  test('a reply moves its conversation to the top of the inbox', async ({ page }) => {
    // **GATE PROOF for `sendMessage`'s `last_message_at` bump.** No trigger
    // maintains that column — this action is the only thing in the system that
    // orders the inbox, so deleting the bump makes this spec fail and nothing
    // below it would notice. `createMessageRow` deliberately does not bump it
    // either, or the fixture would hide the defect.
    const older = await hostedListing()
    const newer = await hostedListing()
    const guestId = await testUserId()
    const hostId = await secondUserId()

    const olderThread = await createThreadRow({ guestId, hostId, listingId: older.id })
    const newerThread = await createThreadRow({ guestId, hostId, listingId: newer.id })

    try {
      // `newerThread` was created second, so it starts above the older one.
      await page.goto('/messages')
      const before = await inboxOrder(page, newer.title, older.title)
      expect(before.first).toBeLessThan(before.second)

      // Reply into the OLDER conversation through the real composer.
      await page.goto(`/messages/${olderThread.id}`)
      const box = composer(page)
      await waitForHydration(box)
      await box.fill('Following up on this one.')
      await sendButton(page).click()
      await expect.poll(async () => (await readMessages(olderThread.id)).length).toBe(1)

      // The column moved...
      //
      // **Polled, not read once — and the message arriving is NOT the signal that
      // the bump has.** `sendMessage` INSERTs the message and *then* UPDATEs
      // `last_message_at`, two separate statements. The poll above gates on the
      // first one, so it goes green the instant the message commits and a bare
      // read here races the second. Measured: the bump lands ~130-220ms after the
      // message, and reading immediately caught it unbumped in 1 of 8 low-load
      // runs — under full-suite load the window widens, which is the intermittent
      // failure this spec carried from F16 to F19.
      //
      // **This is still a gate proof, not a tautology.** Deleting the bump from
      // `sendMessage` does not make the poll pass slowly — it makes it time out,
      // because nothing else in the system writes this column. Verified by doing
      // exactly that.
      await expect
        .poll(async () => {
          const [b, u] = await Promise.all([
            readThread(olderThread.id),
            readThread(newerThread.id),
          ])
          return b!.lastMessageAt > u!.lastMessageAt
        })
        .toBe(true)

      // ...and so did the ordering the column exists for. They have swapped.
      await page.goto('/messages')
      const after = await inboxOrder(page, older.title, newer.title)
      expect(after.first).toBeLessThan(after.second)
    } finally {
      await deleteThreads([olderThread.id, newerThread.id])
      await deleteListing(older.id)
      await deleteListing(newer.id)
    }
  })

  test('opening a conversation clears its unread badge but leaves your own messages unread', async ({
    page,
  }) => {
    // **GATE PROOF for `markThreadRead`**, which nothing below the action does:
    // remove the call and the badge never clears.
    //
    // The second half is the asymmetry `messages_update_read_receipt` enforces —
    // `sender_id <> auth.uid()` — and it is invisible on screen, so the table is
    // the only place it can be asserted. It is also why `unreadCount` must
    // exclude your own messages: they stay `read_at = null` indefinitely.
    const listing = await hostedListing()
    const guestId = await testUserId()
    const hostId = await secondUserId()
    const thread = await createThreadRow({ guestId, hostId, listingId: listing.id })

    try {
      await createMessageRow({ threadId: thread.id, senderId: hostId, body: 'Incoming one.' })
      await createMessageRow({ threadId: thread.id, senderId: hostId, body: 'Incoming two.' })
      await createMessageRow({ threadId: thread.id, senderId: guestId, body: 'My own reply.' })

      await page.goto('/messages')
      const row = threadList(page).getByRole('listitem').filter({ hasText: listing.title })
      // Two, not three: the guest's own message is never their own unread mail.
      // Located by the badge's accessible text rather than the bare digit, which
      // would also match a timestamp or a listing title containing a "2".
      await expect(row.getByText('2 unread messages')).toBeVisible()

      await row.getByRole('link').click()
      await expect(page).toHaveURL(`/messages/${thread.id}`)
      await waitForHydration(composer(page))

      await expect
        .poll(async () =>
          (await readMessages(thread.id)).filter((m) => m.readAt !== null).length,
        )
        .toBe(2)

      const stored = await readMessages(thread.id)
      // The two incoming ones are stamped...
      expect(stored.filter((m) => m.senderId === hostId).every((m) => m.readAt !== null)).toBe(
        true,
      )
      // ...and the guest's own is untouched, because the policy forbids it.
      expect(stored.find((m) => m.senderId === guestId)?.readAt).toBeNull()

      // The badge is gone on return.
      await page.goto('/messages')
      const cleared = threadList(page).getByRole('listitem').filter({ hasText: listing.title })
      await expect(cleared).toBeVisible()
      await expect(cleared.getByText(/unread messages$/)).toHaveCount(0)
    } finally {
      await deleteThreads([thread.id])
      await deleteListing(listing.id)
    }
  })
})

test.describe('conversations that are not yours', () => {
  const strangers = async () => {
    const listing = await hostedListing()
    // Between the SECOND account and a seeded guest — the primary fixture user
    // is in neither role, which is the whole point.
    const thread = await createThreadRow({
      guestId: OTHER_USER_ID,
      hostId: await secondUserId(),
      listingId: listing.id,
    })
    return { listing, thread }
  }

  test('a thread the viewer is not in is a 404 — and the same thread serves 200 to a participant', async ({
    browser,
  }) => {
    // **F11's rule: a refusal needs a paired proof that the thing succeeds when
    // it should.** Without the positive control this spec would pass just as
    // happily against a thread id that does not exist, measuring the setup
    // rather than `message_threads_select_participant`.
    const { listing, thread } = await strangers()

    try {
      const outsider = await browser.newContext({ storageState: AUTH_STATE_FILE })
      const outsiderPage = await outsider.newPage()
      const refused = await outsiderPage.goto(`/messages/${thread.id}`)
      expect(refused?.status()).toBe(404)
      await outsider.close()

      // The positive control: its host, the second account, gets the page.
      const participant = await browser.newContext({ storageState: SECOND_AUTH_STATE_FILE })
      const participantPage = await participant.newPage()
      const allowed = await participantPage.goto(`/messages/${thread.id}`)
      expect(allowed?.status()).toBe(200)
      await expect(participantPage.getByLabel(/^Message /)).toBeVisible()
      await participant.close()
    } finally {
      await deleteThreads([thread.id])
      await deleteListing(listing.id)
    }
  })

  test('a malformed thread id is a 404 rather than a logged Postgres error', async ({ page }) => {
    const context = await page.context().browser()!.newContext({ storageState: AUTH_STATE_FILE })
    const signedIn = await context.newPage()

    try {
      const response = await signedIn.goto('/messages/not-a-uuid')
      expect(response?.status()).toBe(404)
    } finally {
      await context.close()
    }
  })
})

test.describe('signed out', () => {
  test('the inbox bounces to sign-in', async ({ page }) => {
    await page.goto('/messages')
    await expect(page).toHaveURL('/?signin=required&next=%2Fmessages')
  })

  test('"Message host" is a sign-in form that returns to the listing', async ({ page }) => {
    // `project-overview.md`: a protected action taken while signed out sends the
    // user through Google and returns them where they were. `SaveButton`'s
    // arrangement, reused — so the control is present, not hidden.
    const listing = await hostedListing()

    try {
      await page.goto(`/listings/${listing.id}`)

      const button = page.getByRole('button', { name: /^Sign in to message/ })
      await expect(button).toBeVisible()

      const next = button.locator('xpath=ancestor::form').locator('input[name="next"]')
      await expect(next).toHaveValue(`/listings/${listing.id}`)
    } finally {
      await deleteListing(listing.id)
    }
  })
})

test.describe('a host viewing their own listing', () => {
  test.use({ storageState: SECOND_AUTH_STATE_FILE })

  test('is offered no way to message themselves', async ({ page }) => {
    // `message_threads_participants_differ` would raise 23514, and the action
    // refuses before that — this asserts the control is not rendered at all, so
    // the rule is not left to a refusal the user has to read.
    const listing = await hostedListing()

    try {
      await page.goto(`/listings/${listing.id}`)
      await expect(page.getByText(/Hosted by/)).toBeVisible()
      await expect(page.getByRole('button', { name: /^Message / })).toHaveCount(0)
      await expect(page.getByRole('button', { name: /^Sign in to message/ })).toHaveCount(0)
    } finally {
      await deleteListing(listing.id)
    }
  })
})
