import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { coverPhotoOf, threadPartner, unreadCount } from '@/lib/utils'

/**
 * One participant, as a thread names them.
 *
 * Hand-written `| null` on the embed that produces this (see `ThreadRow`) for
 * F08's reason — postgrest-js types a to-one embed on a NOT NULL FK as
 * never-null and TypeScript will never ask — even though `profiles` is publicly
 * readable and so genuinely cannot be filtered away here.
 */
export type ThreadParticipant = {
  id: string
  /** Falls back to a neutral label rather than rendering an empty line. */
  name: string
  avatarUrl: string | null
}

/**
 * The listing a conversation is about, or `null`.
 *
 * **This embed is nullable twice over, and only one of them is in the types.**
 * `message_threads.listing_id` is itself nullable and `on delete set null`, so a
 * host deleting a listing leaves the conversation standing with no subject —
 * TypeScript does ask about that one. The second way is RLS: the `listings`
 * SELECT policy hides an unpublished listing from everyone but its host and
 * admins, so the *guest's* copy of a thread loses this embed the moment the host
 * unpublishes, while the host's copy keeps it.
 *
 * Either way the thread renders without it. F13's posture on a null `listings`
 * embed: the conversation is what the user came for, and dropping it to hide a
 * missing subject line would take the messages with it.
 */
export type ThreadListing = {
  id: string
  title: string
  coverUrl: string | null
  /** Cloudinary id of the cover, or null for an external (seed) photo. */
  coverPublicId: string | null
}

/** One conversation as the `/messages` inbox renders it. */
export type ThreadSummary = {
  id: string
  /** Ordering key — bumped by `sendMessage`, since no trigger maintains it. */
  lastMessageAt: string
  listing: ThreadListing | null
  /** The *other* person: guest and host are roles on the thread, not on a user. */
  partner: ThreadParticipant
  /** The most recent message's body, or null while the thread is still empty. */
  snippet: string | null
  /** Incoming and unread. Never counts the viewer's own messages — see `unreadCount`. */
  unread: number
}

/** One message in an open thread. */
export type ThreadMessage = {
  id: string
  senderId: string
  body: string
  createdAt: string
  readAt: string | null
}

/** One conversation as `/messages/[threadId]` renders it. */
export type ThreadDetail = {
  id: string
  listing: ThreadListing | null
  partner: ThreadParticipant
  /**
   * Who is looking. The thread view is a client component that has to tell its
   * own messages from the other person's, and it must not re-derive the session
   * in the browser to do it.
   */
  viewerId: string
  /** Oldest first — reading order. */
  messages: ThreadMessage[]
}

// Defensive ceilings, not pagination — the same posture as `MAX_TRIPS` and
// `MAX_RESERVATIONS`.
const MAX_THREADS = 100
const MAX_MESSAGES = 200

const PARTICIPANTS =
  'guest:profiles!message_threads_guest_id_fkey(id, full_name, avatar_url), host:profiles!message_threads_host_id_fkey(id, full_name, avatar_url)'

const THREAD_LISTING =
  'listings(id, title, listing_photos(url, public_id, is_cover, position))'

/**
 * Every conversation the current user is part of, most recently active first.
 *
 * **There is deliberately no participant filter, and this is the inverse of
 * `/trips`.** `message_threads_select_participant` is exactly
 *
 *     guest_id = auth.uid() OR host_id = auth.uid()
 *
 * which is precisely the question an inbox asks — so the policy alone already
 * returns exactly the right rows, and a filter would restate it. That is
 * `getFavorites`' situation, **not** `getGuestBookings`': the `bookings` policy
 * admits guest **OR** the listing's host **OR** `is_admin()`, three principals
 * asking three different questions, so those queries must say which reader they
 * are for. F13's rule is to ask that per table rather than per project. Asked
 * here, and the answer is no filter.
 *
 * **Messages are nested rather than aggregated**, because both things the inbox
 * needs — the snippet and the unread count — are pure functions of the same rows
 * (F05's precedent: aggregation is application code, so it stays unit-testable
 * without a database). The cost is that a long conversation ships in full to
 * render one line of it.
 *
 * TODO: replace the nested `messages` select with an aggregate once a single
 * thread can plausibly hold hundreds of messages — a view or a `security definer`
 * function returning (thread_id, snippet, unread) would keep the inbox flat.
 */
export async function getThreads(): Promise<ThreadSummary[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  // `src/proxy.ts` guards /messages, so this is belt-and-braces — but a query
  // whose scoping depends on knowing who is asking must not depend on the proxy
  // being correct.
  if (!user) return []

  const { data, error } = await supabase
    .from('message_threads')
    .select(
      `id, last_message_at, ${THREAD_LISTING}, ${PARTICIPANTS}, messages(id, sender_id, body, created_at, read_at)`,
    )
    .order('last_message_at', { ascending: false })
    .limit(MAX_THREADS)

  if (error) {
    console.error('[queries/messages] getThreads failed:', error.message)
    return []
  }

  return (data ?? []).map((row) => toSummary(row, user.id))
}

/**
 * One conversation with its messages, or `null` when the viewer is not in it.
 *
 * **The null is the 404**, exactly as `getListingById`'s is: no participant
 * filter is applied, so it is `message_threads_select_participant` that returns
 * nothing to a stranger, and the page turns that into `notFound()`. A thread
 * that does not exist and a thread that is not yours are indistinguishable from
 * the outside, which is the point.
 */
export async function getThreadById(id: string): Promise<ThreadDetail | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('message_threads')
    .select(
      `id, last_message_at, ${THREAD_LISTING}, ${PARTICIPANTS}, messages(id, sender_id, body, created_at, read_at)`,
    )
    .eq('id', id)
    // Newest first at the database so `MAX_MESSAGES` truncates the *start* of a
    // long conversation rather than its most recent turn — `MAX_RESERVATIONS`'
    // reasoning. Reversed below into reading order.
    .order('created_at', { referencedTable: 'messages', ascending: false })
    .limit(MAX_MESSAGES, { referencedTable: 'messages' })
    .maybeSingle()

  if (error) {
    console.error('[queries/messages] getThreadById failed:', error.message)
    return null
  }
  if (!data) return null

  return {
    id: data.id,
    listing: toThreadListing(data.listings),
    partner: toPartner(data, user.id),
    viewerId: user.id,
    messages: (data.messages ?? [])
      .map((message) => ({
        id: message.id,
        senderId: message.sender_id,
        body: message.body,
        createdAt: message.created_at,
        readAt: message.read_at,
      }))
      .reverse(),
  }
}

/** A profile as either FK embed returns it. See `ThreadParticipant` for the null. */
type ProfileEmbed = {
  id: string
  full_name: string | null
  avatar_url: string | null
} | null

/** The row shape both queries select. */
type ThreadRow = {
  id: string
  last_message_at: string
  listings: {
    id: string
    title: string
    listing_photos: {
      url: string
      public_id: string | null
      is_cover: boolean
      position: number
    }[]
  } | null
  guest: ProfileEmbed
  host: ProfileEmbed
  messages: {
    id: string
    sender_id: string
    body: string
    created_at: string
    read_at: string | null
  }[]
}

function toSummary(row: ThreadRow, viewerId: string): ThreadSummary {
  // The newest message, found rather than assumed: `getThreads` does not order
  // the nested rows, because it needs all of them for the unread count anyway.
  const latest = row.messages.reduce<ThreadRow['messages'][number] | null>(
    (newest, message) =>
      newest === null || message.created_at > newest.created_at ? message : newest,
    null,
  )

  return {
    id: row.id,
    lastMessageAt: row.last_message_at,
    listing: toThreadListing(row.listings),
    partner: toPartner(row, viewerId),
    // Null, not '', while a thread is still empty — `getOrCreateThread` creates
    // the row on the first click, so an unused conversation is an ordinary state.
    snippet: latest?.body ?? null,
    unread: unreadCount(row.messages, viewerId),
  }
}

function toThreadListing(listing: ThreadRow['listings']): ThreadListing | null {
  if (!listing) return null

  const cover = coverPhotoOf(listing.listing_photos)

  return {
    id: listing.id,
    title: listing.title,
    coverUrl: cover?.url ?? null,
    coverPublicId: cover?.public_id ?? null,
  }
}

/**
 * The counterpart, with the fallbacks a missing profile needs.
 *
 * `threadPartner` needs both sides to carry an `id`, so a null embed is filled
 * with an empty one first. That case is unreachable — `profiles` is publicly
 * readable — but the empty id is what keeps the fallback *correct* if it ever
 * happens: it can never accidentally equal `viewerId` and name the viewer as
 * their own counterpart.
 */
function toPartner(
  row: Pick<ThreadRow, 'guest' | 'host'>,
  viewerId: string,
): ThreadParticipant {
  const partner = threadPartner(
    {
      guest: row.guest ?? EMPTY_PROFILE,
      host: row.host ?? EMPTY_PROFILE,
    },
    viewerId,
  )

  return {
    id: partner.id,
    // A missing name loses their identity, not the conversation — F14's posture
    // on a reservation's guest.
    name: partner.full_name?.trim() || 'NextBnb member',
    avatarUrl: partner.avatar_url,
  }
}

const EMPTY_PROFILE = { id: '', full_name: null, avatar_url: null }
