import { differenceInCalendarDays, parseISO } from 'date-fns'
import { z } from 'zod'

// -----------------------------------------------------------------------------
// Feature 11 — host-managed availability
//
// `blocked_dates` ranges are INCLUSIVE [start_date, end_date]: both ends are
// blocked, and a one-day block is legal (`end_date >= start_date` is the table's
// own check constraint). That is the opposite convention to a booking, which is
// half-open — see `architecture.md` → Availability Rules, and `bookedNightsRange`
// in `lib/utils.ts`, which is where the two models meet.
// -----------------------------------------------------------------------------

/**
 * A sanity bound on a hostile or fat-fingered payload, not a product rule — the
 * same kind of local ceiling as `MAX_MIN_NIGHTS` in `validations/listings.ts`.
 * A host wanting a place off the market indefinitely unpublishes it.
 */
const MAX_BLOCK_DAYS = 365

/**
 * **Deliberately no "not in the past" rule here, and that is decision 6.**
 *
 * This schema validates on the client and the client posts its *result* to an
 * action that validates again — so it must accept its own output (F09's
 * finding). A `startDate >= today` rule would satisfy that in shape while
 * failing in *time*: `todayISO()` is evaluated once in the browser and again on
 * the server, so a range submitted at 23:59:59 would be refused at 00:00:01 with
 * a message naming a field the host filled in correctly.
 *
 * The floor therefore lives in two places that cannot disagree with each other:
 * the calendar only offers today onward, and `addBlock` refuses a block whose
 * *end* is already past — which is lenient enough that the server never rejects
 * what the client accepted, and strict enough to refuse a block that would do
 * nothing. Same reasoning as F10's one-day-wide delete cutoff: when a comparison
 * straddles two clocks, pick the direction whose error is harmless.
 */
export const addBlockSchema = z
  .object({
    listingId: z.uuid(),
    // Zod 4: `z.iso.date()`, not v3's `z.string().date()`. It rejects
    // 2026-02-31, which a plain format regex would happily accept.
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  })
  .refine((block) => block.endDate >= block.startDate, {
    message: 'The last blocked night cannot be before the first.',
    path: ['endDate'],
  })
  .refine(
    (block) =>
      differenceInCalendarDays(parseISO(block.endDate), parseISO(block.startDate)) + 1 <=
      MAX_BLOCK_DAYS,
    {
      message: `A block can cover at most ${MAX_BLOCK_DAYS} days.`,
      path: ['endDate'],
    },
  )

export type AddBlockInput = z.output<typeof addBlockSchema>

/** Identifies one block of one listing. The listing id is what scopes the
 *  delete to a listing the caller hosts, so it is required alongside the row. */
export const removeBlockSchema = z.object({
  listingId: z.uuid(),
  blockId: z.uuid(),
})

export type RemoveBlockInput = z.output<typeof removeBlockSchema>
