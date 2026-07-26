'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  HOST_CONTROL,
  HOST_CONTROL_DANGER,
} from '@/components/host/hostControlStyles'
import { Button } from '@/components/ui/Button'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/DateRangePicker'
import { addBlock, removeBlock } from '@/lib/actions/blockedDates'
import { cn, formatInclusiveRange } from '@/lib/utils'
import { addBlockSchema } from '@/lib/validations/blockedDates'
import type { InclusiveRange } from '@/lib/utils'
import type { ListingBlock } from '@/lib/queries/listings'

type Props = {
  listingId: string
  blocks: ListingBlock[]
  bookedRanges: InclusiveRange[]
}

const EMPTY_RANGE: DateRangeValue = { start: null, end: null }

/**
 * The host's availability surface: a calendar of everything already taken, a
 * control to block a new range, and the list of blocks with a Remove each.
 *
 * **The calendar is inclusive here** (`bounds="inclusive"`), which is the whole
 * reason `DateRangePicker` grew that prop: a `blocked_dates` row occupies both
 * of its ends, so a single night is a valid selection and the last day picked
 * must itself be free. A stay is the other convention and the same component
 * still renders it for `SearchBar`.
 *
 * **Bookings and blocks are listed separately rather than drawn differently.**
 * Both grey out on the calendar — a taken night is a taken night — but only one
 * of them is the host's to undo, and a greyed cell cannot say which it is.
 * Splitting the lists is what makes "read-only for booked" legible without
 * teaching a `components/ui/` primitive the difference between the two.
 *
 * Actions run in a transition and then `router.refresh()`: they revalidate the
 * page being looked at, so the server is the fastest correct source of the new
 * state — `PhotoManager` and `ListingActions` are the same shape, and F08's
 * heart is the deliberate exception because it revalidates a different route.
 */
export function AvailabilityManager({ listingId, blocks, bookedRanges }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<DateRangeValue>(EMPTY_RANGE)

  const blockedRanges = useMemo<InclusiveRange[]>(
    () => blocks.map((block) => ({ start: block.startDate, end: block.endDate })),
    [blocks],
  )

  // One list for the calendar: it only needs to know a day is taken, not by whom.
  const unavailableRanges = useMemo(
    () => [...bookedRanges, ...blockedRanges],
    [bookedRanges, blockedRanges],
  )

  const selected =
    range.start && range.end ? { start: range.start, end: range.end } : null

  function onAdd() {
    if (!selected) return
    setError(null)

    // Validated with the same schema the action re-validates with, so the
    // 365-day ceiling and the ordering rule surface here rather than as a
    // refusal after the round trip. F09's rule is what makes this safe: the
    // schema accepts its own output, so posting the parsed result cannot fail.
    const parsed = addBlockSchema.safeParse({
      listingId,
      startDate: selected.start,
      endDate: selected.end,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check those dates.')
      return
    }

    startTransition(async () => {
      const result = await addBlock(parsed.data)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setRange(EMPTY_RANGE)
      router.refresh()
    })
  }

  function onRemove(blockId: string) {
    setError(null)
    startTransition(async () => {
      const result = await removeBlock({ listingId, blockId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4" aria-labelledby="block-dates-heading">
        <div>
          <h2 id="block-dates-heading" className="text-xl font-semibold text-ink">
            Block dates
          </h2>
          <p className="mt-1 text-sm text-muted">
            Pick the first and last night to block. Days already reserved or
            blocked cannot be selected.
          </p>
        </div>

        <div className="overflow-x-auto">
          <DateRangePicker
            value={range}
            onChange={setRange}
            unavailableRanges={unavailableRanges}
            bounds="inclusive"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onAdd} disabled={!selected || pending}>
            {pending ? 'Saving…' : 'Block these dates'}
          </Button>

          {range.start && (
            <button
              type="button"
              className={cn(HOST_CONTROL, 'border-hairline bg-canvas text-ink hover:bg-surface-soft')}
              disabled={pending}
              onClick={() => setRange(EMPTY_RANGE)}
            >
              Clear selection
            </button>
          )}
        </div>

        {/* Stated, not merely disabled — F09's precedent. A dead button with no
            reason is the thing users report as broken. */}
        <p className="text-sm text-muted" aria-live="polite">
          {selected
            ? `${formatInclusiveRange(selected)} selected.`
            : range.start
              ? 'Now pick the last night — or the same day again to block one night.'
              : 'Pick the first night to block.'}
        </p>

        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="blocked-heading">
        <h2 id="blocked-heading" className="text-xl font-semibold text-ink">
          Blocked by you{' '}
          <span className="text-base font-normal text-muted">({blocks.length})</span>
        </h2>

        {blocks.length === 0 ? (
          <p className="rounded-md border border-dashed border-hairline px-6 py-10 text-center text-base text-muted">
            No blocked dates. Your calendar is open apart from any reservations.
          </p>
        ) : (
          <ul className="divide-y divide-hairline border-y border-hairline">
            {blocks.map((block) => {
              const label = formatInclusiveRange({
                start: block.startDate,
                end: block.endDate,
              })

              return (
                <li
                  key={block.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <span className="text-base text-ink">{label}</span>
                  {/* Named for its range: one row per block means a bare
                      "Remove" would match every one of them, and naming the
                      control is also the correct accessibility answer (F10). */}
                  <button
                    type="button"
                    className={cn(HOST_CONTROL, HOST_CONTROL_DANGER)}
                    disabled={pending}
                    aria-label={`Unblock ${label}`}
                    onClick={() => onRemove(block.id)}
                  >
                    Unblock
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="reserved-heading">
        <h2 id="reserved-heading" className="text-xl font-semibold text-ink">
          Reserved{' '}
          <span className="text-base font-normal text-muted">
            ({bookedRanges.length})
          </span>
        </h2>

        {bookedRanges.length === 0 ? (
          <p className="text-base text-muted">No upcoming reservations.</p>
        ) : (
          <>
            <ul className="divide-y divide-hairline border-y border-hairline">
              {bookedRanges.map((booked) => (
                <li key={`${booked.start}-${booked.end}`} className="py-3">
                  <span className="text-base text-ink">
                    {formatInclusiveRange(booked)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted">
              Reserved nights are blocked automatically and cannot be removed
              here. To free them, cancel the reservation.
            </p>
          </>
        )}
      </section>
    </div>
  )
}
