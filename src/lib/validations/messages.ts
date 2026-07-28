import { z } from 'zod'

// -----------------------------------------------------------------------------
// Feature 16 — Guest ↔ host messaging
//
// Three inputs, three shapes, and the differences between them are the feature:
//
// - Starting a conversation names a LISTING, never a thread or a counterpart.
//   `getOrCreateThread` derives `host_id` from the listing and `guest_id` from
//   the session, so neither participant is a value the client can choose. That
//   matters more here than it did for F15's `listing_id`, because the
//   `message_threads` INSERT policy is `guest_id = uid OR host_id = uid` — it
//   would happily accept a thread naming an arbitrary stranger as the guest.
//   The policy is looser than this app; the action is what keeps it honest.
//
// - Sending names a THREAD. Participation is `messages_insert_own_in_thread`'s
//   business, and `sender_id` is stamped from the session, so the only thing
//   left to validate is the body.
//
// - Marking read names a thread and nothing else, for the same reason
//   `deleteReviewSchema` is just an id: which rows may be stamped is
//   `messages_update_read_receipt`'s USING clause, and a schema cannot see who
//   sent what.
// -----------------------------------------------------------------------------

/**
 * The message length cap. Local to this module rather than `constants.ts`,
 * following `MAX_REVIEW_COMMENT` and `MAX_BLOCK_DAYS`: `constants.ts` holds
 * values the *database* also depends on, while a text length is this schema's
 * own business.
 *
 * Exported because the composer sets its textarea's `maxLength` from it. That
 * form has no Zod resolver (F15's precedent — one field, no error surface worth
 * mounting a form instance for), so the attribute is what stops a client
 * producing input this schema would reject. One number, both places.
 */
export const MAX_MESSAGE_BODY = 2_000

/** A thread id from a route segment or a form field. */
export const threadIdSchema = z.uuid()

/**
 * Opening a conversation about a listing.
 *
 * Just the listing: see the module note. The action refuses self-messaging
 * before the insert, though `message_threads_participants_differ` would raise
 * `23514` anyway — the check exists so the guest reads a sentence rather than a
 * generic failure.
 */
export const startThreadSchema = z.object({
  listingId: z.uuid(),
})

export type StartThreadInput = z.output<typeof startThreadSchema>

/**
 * A message as the composer posts it and `sendMessage` re-validates it.
 *
 * **The trim is load-bearing twice over.** `messages.body` carries
 * `check (length(trim(body)) > 0)`, so a whitespace-only send would otherwise
 * reach the database and come back as `23514` — a constraint violation standing
 * in for "type something". Trimming here means the schema refuses it with a
 * sentence, and the constraint stays the backstop it was meant to be.
 *
 * It also keeps the schema **idempotent** (F09's rule): the composer validates,
 * posts the result, and the action validates that result with this same schema,
 * so `parse(parse(x))` has to succeed. Trimming an already-trimmed string is a
 * no-op, which is exactly why this is safe — and the unit tests assert it rather
 * than trusting it stays true.
 */
export const sendMessageSchema = z.object({
  threadId: z.uuid(),
  body: z
    .string()
    .trim()
    .min(1, 'Write a message before sending.')
    .max(MAX_MESSAGE_BODY, `Keep your message under ${MAX_MESSAGE_BODY} characters.`),
})

export type SendMessageInput = z.output<typeof sendMessageSchema>

/**
 * Identifies the thread whose incoming messages are being stamped read.
 *
 * **Deliberately just the id**, like `deleteReviewSchema`. Which rows are
 * eligible — participant, and not the sender — is
 * `messages_update_read_receipt`'s, and the action narrows further to
 * `read_at is null` so the update is a no-op when there is nothing new. That
 * no-op is the *normal* outcome here, which is why this action, alone among the
 * project's UPDATEs, has no zero-row branch. See `markThreadRead`.
 */
export const markThreadReadSchema = z.object({
  threadId: z.uuid(),
})

export type MarkThreadReadInput = z.output<typeof markThreadReadSchema>
