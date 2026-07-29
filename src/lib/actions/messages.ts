'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import {
  markThreadReadSchema,
  sendMessageSchema,
  startThreadSchema,
} from '@/lib/validations/messages'
import type { ThreadMessage } from '@/lib/queries/messages'
import type { ActionResult } from '@/lib/utils'

/**
 * Find the conversation between this guest and a listing's host, creating it if
 * it does not exist yet.
 *
 * **Both participants are derived, never accepted**, and here that is a real
 * guard rather than a tidiness rule. `message_threads_insert_participant` is
 *
 *     guest_id = auth.uid() OR host_id = auth.uid()
 *
 * — an **OR**, so the policy would happily accept a row naming the caller as host
 * and an arbitrary stranger as guest, planting a conversation in someone else's
 * inbox. This action never builds such a row: `guest_id` comes from the session
 * and `host_id` from the listing. The policy is looser than the app, which is the
 * opposite of the usual arrangement and is recorded in `build-plan.md` as
 * needing a migration to fix properly.
 *
 * **Reading the listing is not F06's trap.** The `listings` SELECT policy returns
 * published listings to anyone plus drafts to their owner, so a listing this
 * caller cannot see comes back as zero rows and is refused. Absence infers a
 * restriction here, not a permission — F15's reasoning for deriving a review's
 * `listing_id` from its booking.
 *
 * **Idempotent by construction.** `message_threads_unique_participants` is
 * `unique nulls not distinct (guest_id, host_id, listing_id)`, so a second click
 * cannot make a second thread: the select finds it, and if two clicks race past
 * that select the insert's `23505` sends the loser back to read the winner's row.
 * Two clicks converge, the way F08's `setFavorite` does.
 */
export async function getOrCreateThread(
  input: unknown,
): Promise<ActionResult<{ threadId: string }>> {
  const parsed = startThreadSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'That stay could not be found.' }
  }

  const { listingId } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to message a host.' }

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('id, host_id')
    .eq('id', listingId)
    .maybeSingle()

  if (listingError) {
    console.error('[actions/messages] getOrCreateThread listing read failed:', listingError.message)
    return { ok: false, error: 'That conversation could not be opened. Please try again.' }
  }
  // No row: the listing does not exist, or RLS hid it because it is an unpublished
  // draft belonging to someone else. Which one is not the caller's business.
  if (!listing) return { ok: false, error: 'That stay could not be found.' }

  // `message_threads_participants_differ` would raise 23514 anyway, but a host
  // deserves a sentence rather than a generic failure. The button is not rendered
  // for them either — this is the third layer, not the first.
  if (listing.host_id === user.id) {
    return { ok: false, error: 'This is your own listing.' }
  }

  const existing = await findThread(supabase, user.id, listing.host_id, listing.id)
  if (existing) return { ok: true, data: { threadId: existing } }

  const { data: created, error } = await supabase
    .from('message_threads')
    .insert({
      guest_id: user.id,
      host_id: listing.host_id,
      listing_id: listing.id,
    })
    .select('id')
    .single()

  if (error) {
    // 23505 is the unique constraint: a concurrent click won the race. Its thread
    // is the one we wanted, so read it back rather than reporting a failure.
    if (error.code === '23505') {
      const raced = await findThread(supabase, user.id, listing.host_id, listing.id)
      if (raced) return { ok: true, data: { threadId: raced } }
    }
    console.error('[actions/messages] getOrCreateThread insert failed:', error.message)
    return { ok: false, error: 'That conversation could not be opened. Please try again.' }
  }

  revalidatePath('/messages')

  return { ok: true, data: { threadId: created.id } }
}

/**
 * The thread for one (guest, host, listing) triple, or null.
 *
 * Extracted because `getOrCreateThread` runs it twice — once before inserting and
 * once after losing the race — and the two lookups must ask the identical
 * question for the retry to be sound.
 */
async function findThread(
  supabase: Awaited<ReturnType<typeof createClient>>,
  guestId: string,
  hostId: string,
  listingId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('message_threads')
    .select('id')
    .eq('guest_id', guestId)
    .eq('host_id', hostId)
    .eq('listing_id', listingId)
    .maybeSingle()

  if (error) {
    console.error('[actions/messages] findThread failed:', error.message)
    return null
  }

  return data?.id ?? null
}

/**
 * Post a message into a conversation.
 *
 * **Two writes, and the second one has no database behind it.** The insert is
 * guarded by `messages_insert_own_in_thread`; the `last_message_at` bump is
 * guarded by nothing at all, because **no trigger maintains that column** — this
 * action is the only thing in the system that keeps the inbox in order. If the
 * bump fails the message is still delivered, so the send reports success and the
 * failure is logged: telling a user their message did not send, when it did, is
 * the worse of the two wrong answers.
 *
 * **A refused INSERT raises; it does not filter.** That is F15's rule, and it is
 * why the insert below maps error codes to sentences and has no zero-row branch,
 * while `markThreadRead` — an UPDATE whose filters make emptiness normal — has
 * neither. **The bump is the third case and it needs both**: it is an UPDATE, so
 * a refusal arrives as zero rows rather than as an error, but unlike
 * `markThreadRead` nothing legitimate makes it match nothing. See the note on the
 * bump itself.
 *
 * > Added at F17 (2026-07-29). The bump previously checked only `bumpError`, so a
 * > refused or lost UPDATE was silently indistinguishable from a successful one —
 * > the single write in the project that did not apply F13's rule. It surfaced as
 * > an intermittent failure of `messages.spec.ts`' inbox-ordering spec under
 * > full-suite load: the message sent, the timestamp did not move, and nothing
 * > anywhere said so.
 *
 * The created row is returned so the composer can paint it immediately. The
 * sender is subscribed to the same Realtime channel and will receive their own
 * INSERT moments later, which is why the thread view dedupes by `id`.
 */
export async function sendMessage(input: unknown): Promise<ActionResult<ThreadMessage>> {
  const parsed = sendMessageSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'Write a message before sending.' }
  }

  const { threadId, body } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to send a message.' }

  const { data, error } = await supabase
    .from('messages')
    .insert({ thread_id: threadId, sender_id: user.id, body })
    .select('id, sender_id, body, created_at, read_at')
    .single()

  if (error) {
    // 42501 is the INSERT policy: not a participant in this thread. 23503 is the
    // foreign key: no such thread. Both mean "this conversation is not yours to
    // post in", and neither confirms whether the thread exists.
    if (error.code === '42501' || error.code === '23503') {
      return { ok: false, error: 'You can no longer post in this conversation.' }
    }
    console.error('[actions/messages] sendMessage failed:', error.message)
    return { ok: false, error: 'That message could not be sent. Please try again.' }
  }

  // `last_message_at` is the only column `authenticated` may write on this table
  // (migration 0003), so this update is as narrow as the grant.
  //
  // **`.select()` is what makes a refusal visible, and this bump is the one place
  // in the project that was missing it.** F13's rule: RLS refuses an UPDATE by
  // *filtering*, so a bump that matched no row comes back `{ error: null }` and
  // is indistinguishable from one that worked. Checking `bumpError` alone
  // therefore cannot see the failure mode this code most needs to see.
  //
  // **Zero rows here can only mean the bump was refused or lost**, which is what
  // separates it from `markThreadRead` below: that statement filters to unread
  // incoming messages, so matching nothing is its ordinary outcome and a zero-row
  // branch would false-alarm on most opens (F16's finding). Here the row is known
  // to exist and the caller is known to be a participant — the INSERT above just
  // succeeded under a policy that requires exactly that — so nothing legitimate
  // produces an empty result.
  //
  // Still not surfaced to the user, for the reason above: the message *was*
  // delivered, and only the inbox's ordering is stale until the next send repairs
  // it. Telling someone their message did not send, when it did, remains the worse
  // of the two wrong answers. The point of the branch is that the miss reaches the
  // log at all.
  const { data: bumped, error: bumpError } = await supabase
    .from('message_threads')
    .update({ last_message_at: data.created_at })
    .eq('id', threadId)
    .select('id')
    .maybeSingle()

  if (bumpError) {
    console.error('[actions/messages] sendMessage bump failed:', bumpError.message)
  } else if (!bumped) {
    console.error(
      '[actions/messages] sendMessage bump matched no row for thread',
      threadId,
      '— the inbox ordering for this conversation is now stale.',
    )
  }

  revalidatePath('/messages')
  revalidatePath(`/messages/${threadId}`)

  return {
    ok: true,
    data: {
      id: data.id,
      senderId: data.sender_id,
      body: data.body,
      createdAt: data.created_at,
      readAt: data.read_at,
    },
  }
}

/**
 * Stamp `read_at` on the messages the viewer did **not** send in this thread.
 *
 * **This is the one RLS-scoped UPDATE in the project with no zero-row branch, and
 * the omission is the point.** F13 established that RLS refuses a write by
 * filtering rather than raising, so `cancelBooking` has to treat zero rows as a
 * refusal — there, zero rows could mean nothing else. Here it is the *ordinary*
 * outcome: `read_at is null` narrows the update to genuinely new messages, so
 * every open of an already-read thread legitimately matches nothing. Reporting
 * that as a failure would cry wolf on most opens. F15 flagged this as the next
 * place the INSERT/UPDATE distinction bites; the answer turned out to be the
 * opposite of F13's, which is why it is spelled out here.
 *
 * `sender_id <> auth.uid()` is restated as `.neq()` even though
 * `messages_update_read_receipt` enforces it, because without it the statement
 * would ask to stamp rows the policy then filters out — the same work with a
 * misleading intent. The policy is what makes it true; this makes it *say* so.
 *
 * Fire-and-forget by design: a failed receipt must not stop a thread rendering,
 * so a genuine database error is logged and swallowed rather than returned.
 */
export async function markThreadRead(input: unknown): Promise<ActionResult> {
  const parsed = markThreadReadSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'That conversation could not be found.' }
  }

  const { threadId } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to read your messages.' }

  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('thread_id', threadId)
    .neq('sender_id', user.id)
    .is('read_at', null)

  if (error) {
    console.error('[actions/messages] markThreadRead failed:', error.message)
    // Swallowed deliberately — see the docblock. The caller renders regardless.
    return { ok: true, data: undefined }
  }

  // The inbox's unread indicator moved even though this page did not.
  revalidatePath('/messages')

  return { ok: true, data: undefined }
}
