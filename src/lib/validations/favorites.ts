import { z } from 'zod'

/**
 * Input to `setFavorite`. Deliberately carries the state the caller **wants**,
 * not an instruction to flip.
 *
 * A `toggle(listingId)` action has to read the current row and invert it, so two
 * clicks in flight resolve against the same "before" state and can land on the
 * opposite answer to the one the heart is showing. Sending the desired state
 * makes the write idempotent: whatever order the requests arrive in, the last
 * one wins and it is the one the user asked for.
 *
 * `z.uuid()` is Zod 4's top-level form (the installed 4.4.3), matching
 * `listingIdSchema` — see `library-docs.md` on the v3/v4 delta.
 */
export const setFavoriteSchema = z.object({
  listingId: z.uuid(),
  saved: z.boolean(),
})

export type SetFavoriteInput = z.infer<typeof setFavoriteSchema>
