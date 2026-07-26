'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { parseISO } from 'date-fns'
import { Minus, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/DateRangePicker'
import { signInWithGoogle } from '@/lib/actions/auth'
import { createBooking } from '@/lib/actions/bookings'
import {
  cn,
  formatDateRange,
  formatInclusiveRange,
  formatPrice,
  nightsBetween,
  priceBreakdown,
} from '@/lib/utils'
import type { InclusiveRange, PriceBreakdown } from '@/lib/utils'

type Props = {
  listingId: string
  /** Names the mobile sheet, so a screen reader hears what is being reserved. */
  title: string
  /** Integer **cents**. */
  pricePerNight: number
  /** Integer **cents**; zero for the listings that charge none. */
  cleaningFee: number
  minNights: number
  maxGuests: number
  /**
   * Nights already taken, both ends inclusive — or **null** when the availability
   * check failed. Null is not `[]`: an empty list means "verified free", null
   * means "unknown", and the widget refuses to take a booking on the second.
   */
  unavailableRanges: InclusiveRange[] | null
  isPublished: boolean
  /** The viewer hosts this listing, so the DB would refuse the insert anyway. */
  isOwnListing: boolean
  isSignedIn: boolean
  /** Dates carried over from the search URL, when they were valid. */
  initialRange: { start: string; end: string } | null
  /** Guests carried over from the search URL, clamped to this listing. */
  initialGuests: number
}

type Confirmed = { id: string; total: number }

/**
 * The reservation surface: DESIGN.md `reservation-card` as a sticky rail from
 * `tablet:` up, and a sticky bottom bar below it that opens a full-screen sheet.
 *
 * **All three placements live in one component, and that is F07's reason kept.**
 * They share one range, one guest count and one price, so they cannot disagree
 * about what is being booked or what it costs. Splitting them would mean two
 * copies of the breakdown maths on screen at the same breakpoint.
 *
 * **The bar never books.** Its button opens the sheet — labelled "Reserve" once a
 * stay is selected and "Add dates" before that — and the sheet holds the actual
 * Reserve. A bottom bar that charges nothing but commits a stay in one tap, with
 * the total off screen, is the wrong shape for the one irreversible action here.
 *
 * Signed out, Reserve is a sign-in form rather than a hidden control (F08's
 * heart), and the `next` it carries includes the selected dates and guests, so
 * the guest comes back to the stay they had chosen.
 *
 * On success it swaps to a confirmation in place — `/trips` is F13's, and sending
 * a guest to a placeholder is worse than telling them here — and calls
 * `router.refresh()`, which re-reads occupancy (those nights are now taken) while
 * preserving this component's state.
 */
export function BookingWidget({
  listingId,
  title,
  pricePerNight,
  cleaningFee,
  minNights,
  maxGuests,
  unavailableRanges,
  isPublished,
  isOwnListing,
  isSignedIn,
  initialRange,
  initialGuests,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [guests, setGuests] = useState(initialGuests)
  const [range, setRange] = useState<DateRangeValue>({
    start: initialRange?.start ?? null,
    end: initialRange?.end ?? null,
  })

  const stay =
    range.start && range.end ? { start: range.start, end: range.end } : null
  const nights = stay ? nightsBetween(parseISO(stay.start), parseISO(stay.end)) : 0
  const price = stay
    ? priceBreakdown({ nights, pricePerNight, cleaningFee })
    : null

  // Why this listing cannot be booked at all, if it cannot. Ordered as the action
  // orders its refusals, so the widget and the server say the same thing first.
  const unbookable = isOwnListing
    ? 'You cannot book your own listing.'
    : !isPublished
      ? 'This listing is not accepting reservations yet.'
      : unavailableRanges === null
        ? 'Availability could not be loaded just now. Please refresh the page.'
        : null

  const tooShort = stay !== null && nights < minNights
  const canReserve = !unbookable && stay !== null && !tooShort && !pending

  function onReserve() {
    if (!stay || !canReserve) return
    setError(null)

    startTransition(async () => {
      const result = await createBooking({
        listingId,
        checkIn: stay.start,
        checkOut: stay.end,
        guests,
      })

      if (!result.ok) {
        setError(result.error)
        return
      }

      setConfirmed(result.data)
      setCalendarOpen(false)
      // Re-reads the listing's occupancy so the calendar greys the nights just
      // taken. Client state (including `confirmed`) survives a refresh.
      router.refresh()
    })
  }

  const dateLabel = formatDateRange(range.start ?? undefined, range.end ?? undefined)

  const calendar = (
    <DateRangePicker
      value={range}
      onChange={setRange}
      unavailableRanges={unavailableRanges ?? []}
    />
  )

  const reserveControl = (
    <ReserveControl
      canReserve={canReserve}
      pending={pending}
      hasStay={stay !== null}
      isSignedIn={isSignedIn}
      unbookable={unbookable}
      stay={stay}
      guests={guests}
      onReserve={onReserve}
    />
  )

  const notices = (
    <>
      {tooShort && (
        <p className="text-sm text-muted">
          This place has a {minNights}-night minimum stay.
        </p>
      )}
      {unbookable && <p className="text-sm text-muted">{unbookable}</p>}
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </>
  )

  return (
    <>
      {/* ---- Rail: tablet and up -------------------------------------------- */}
      <aside
        aria-label="Reservation"
        // `self-start` is load-bearing: a grid item stretches to its cell by
        // default, which leaves `sticky` no room to travel. top-24 clears the
        // 80px nav.
        className="hidden tablet:sticky tablet:top-24 tablet:block tablet:self-start"
      >
        <div className="relative rounded-md border border-hairline bg-canvas p-6 shadow-card">
          {confirmed ? (
            <Confirmation
              stay={stay}
              guests={guests}
              total={confirmed.total}
            />
          ) : (
            <div className="space-y-4">
              <PriceLine pricePerNight={pricePerNight} />

              <div className="overflow-hidden rounded-sm border border-hairline">
                <button
                  type="button"
                  onClick={() => setCalendarOpen((open) => !open)}
                  aria-expanded={calendarOpen}
                  className="grid w-full grid-cols-2 divide-x divide-hairline text-left hover:bg-surface-soft"
                >
                  <Field
                    label="Check-in"
                    value={range.start ? formatDay(range.start) : 'Add dates'}
                  />
                  <Field
                    label="Checkout"
                    value={range.end ? formatDay(range.end) : 'Add dates'}
                  />
                </button>
                <div className="border-t border-hairline px-3 py-2">
                  <GuestStepper
                    guests={guests}
                    maxGuests={maxGuests}
                    onChange={setGuests}
                  />
                </div>
              </div>

              {calendarOpen && (
                // Opens to the LEFT of the card, top-aligned — the way DESIGN.md's
                // reference does it, and not a style preference. Hanging it below
                // the card (`top-full`) puts its footer at ~810px, and because the
                // rail is `sticky` the page cannot scroll it into view: on a
                // 720px-tall viewport "Clear dates" and "Done" were unreachable
                // for a real user, not just for Playwright. `max-h`/`overflow`
                // is the floor for shorter viewports still.
                <div className="absolute right-full top-0 z-50 mr-2 max-h-[70vh] overflow-y-auto rounded-md border border-hairline bg-canvas p-4 shadow-card">
                  {calendar}
                  <div className="flex justify-end gap-2 border-t border-hairline pt-3">
                    <button
                      type="button"
                      onClick={() => setRange({ start: null, end: null })}
                      className="rounded-sm px-4 py-2.5 text-sm font-medium text-ink underline"
                    >
                      Clear dates
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarOpen(false)}
                      className="rounded-sm bg-ink px-4 py-2.5 text-sm font-medium text-canvas"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              {reserveControl}
              {notices}

              <Breakdown
                pricePerNight={pricePerNight}
                nights={nights}
                price={price}
                minNights={minNights}
                maxGuests={maxGuests}
              />
            </div>
          )}
        </div>
      </aside>

      {/* ---- Bar: below tablet. Opens the sheet; never books. ---------------
          An `<aside>`, not a `<div>`: ARIA ignores an accessible name on a
          generic element, so `aria-label` on a bare div is announced by nothing
          and matchable by nothing. F07's shell had the same latent problem. Two
          `complementary` landmarks are correct here — only one is ever on
          screen, and each names what it is. */}
      <aside
        aria-label="Reservation summary"
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-hairline bg-canvas px-6 py-3 tablet:hidden"
      >
        {confirmed ? (
          <>
            <p className="text-base font-semibold text-ink">Reserved</p>
            <Link
              href="/trips"
              className="text-sm font-medium text-ink underline underline-offset-2"
            >
              View in Trips
            </Link>
          </>
        ) : (
          <>
            <div>
              <p className="text-ink">
                <span className="text-base font-semibold">
                  {price ? formatPrice(price.total) : formatPrice(pricePerNight)}
                </span>{' '}
                <span className="text-sm text-body">{price ? 'total' : 'night'}</span>
              </p>
              {dateLabel && <p className="text-xs text-muted">{dateLabel}</p>}
            </div>
            <Button onClick={() => setSheetOpen(true)} className="shrink-0">
              {stay && !tooShort ? 'Reserve' : 'Add dates'}
            </Button>
          </>
        )}
      </aside>

      {/* ---- Sheet: the mobile booking surface ------------------------------ */}
      {sheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Reserve ${title}`}
          className="fixed inset-0 z-50 flex flex-col bg-canvas tablet:hidden"
        >
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <p className="text-base font-semibold text-ink">
              {confirmed ? 'Reservation confirmed' : 'Reserve'}
            </p>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              aria-label="Close reservation"
              className="flex size-11 items-center justify-center rounded-full hover:bg-surface-soft"
            >
              <X className="size-5 text-ink" aria-hidden />
            </button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
            {confirmed ? (
              <Confirmation stay={stay} guests={guests} total={confirmed.total} />
            ) : (
              <>
                <PriceLine pricePerNight={pricePerNight} />

                <div className="overflow-x-auto rounded-md border border-hairline p-2">
                  {calendar}
                </div>

                <div className="rounded-sm border border-hairline px-3 py-2">
                  <GuestStepper
                    guests={guests}
                    maxGuests={maxGuests}
                    onChange={setGuests}
                  />
                </div>

                <Breakdown
                  pricePerNight={pricePerNight}
                  nights={nights}
                  price={price}
                  minNights={minNights}
                  maxGuests={maxGuests}
                />
              </>
            )}
          </div>

          {!confirmed && (
            <div className="space-y-3 border-t border-hairline px-4 py-3">
              {notices}
              {reserveControl}
            </div>
          )}
        </div>
      )}
    </>
  )
}

/**
 * Reserve, or the sign-in that has to happen first.
 *
 * The `next` carries the chosen dates and guests, so signing in returns the guest
 * to the stay they had picked rather than to an empty widget — the same reasoning
 * as F08's heart carrying the search query.
 */
function ReserveControl({
  canReserve,
  pending,
  hasStay,
  isSignedIn,
  unbookable,
  stay,
  guests,
  onReserve,
}: {
  canReserve: boolean
  pending: boolean
  hasStay: boolean
  isSignedIn: boolean
  unbookable: string | null
  stay: { start: string; end: string } | null
  guests: number
  onReserve: () => void
}) {
  const pathname = usePathname()

  if (!isSignedIn) {
    const query = new URLSearchParams()
    if (stay) {
      query.set('checkIn', stay.start)
      query.set('checkOut', stay.end)
    }
    query.set('guests', String(guests))
    const search = query.toString()

    return (
      <form action={signInWithGoogle}>
        <input
          type="hidden"
          name="next"
          value={`${pathname ?? '/'}${search ? `?${search}` : ''}`}
        />
        <Button type="submit" fullWidth disabled={Boolean(unbookable)}>
          Sign in to book
        </Button>
      </form>
    )
  }

  return (
    <Button onClick={onReserve} disabled={!canReserve} fullWidth>
      {pending ? 'Reserving…' : hasStay ? 'Reserve' : 'Add dates to reserve'}
    </Button>
  )
}

/**
 * The in-page confirmation. Instant Book means there is nothing to wait for, so
 * this is the whole acknowledgement — and it reports the **stored** total, which
 * differs from the widget's own arithmetic only if the host edited the price
 * while the guest was deciding.
 */
function Confirmation({
  stay,
  guests,
  total,
}: {
  stay: { start: string; end: string } | null
  guests: number
  total: number
}) {
  return (
    <div className="space-y-3" role="status">
      <p className="text-xl font-semibold text-ink">Your stay is confirmed</p>
      <dl className="space-y-2 text-base text-body">
        {stay && (
          <Row term="Dates" value={formatDateRange(stay.start, stay.end) ?? ''} />
        )}
        <Row term="Guests" value={`${guests} ${guests === 1 ? 'guest' : 'guests'}`} />
        <Row term="Total paid" value={formatPrice(total)} />
      </dl>
      <p className="text-sm text-muted">
        No payment was taken — this is a simulated booking.
      </p>
      <Link
        href="/trips"
        className="inline-block text-base font-medium text-ink underline underline-offset-2"
      >
        View this in Trips
      </Link>
    </div>
  )
}

function PriceLine({ pricePerNight }: { pricePerNight: number }) {
  return (
    <p className="text-ink">
      <span className="text-xl font-semibold">{formatPrice(pricePerNight)}</span>{' '}
      <span className="text-base text-body">night</span>
    </p>
  )
}

/**
 * The four lines the guest reads, or the listing's limits before dates are picked.
 *
 * Every figure comes from `priceBreakdown`, the same function `createBooking`
 * snapshots onto the row — so the total here is the total charged.
 */
function Breakdown({
  pricePerNight,
  nights,
  price,
  minNights,
  maxGuests,
}: {
  pricePerNight: number
  nights: number
  price: PriceBreakdown | null
  minNights: number
  maxGuests: number
}) {
  if (!price) {
    return (
      <dl className="space-y-2 border-t border-hairline pt-4 text-base text-body">
        <Row
          term="Minimum stay"
          value={`${minNights} ${minNights === 1 ? 'night' : 'nights'}`}
        />
        <Row
          term="Maximum guests"
          value={`${maxGuests} ${maxGuests === 1 ? 'guest' : 'guests'}`}
        />
      </dl>
    )
  }

  return (
    <dl className="space-y-2 border-t border-hairline pt-4 text-base text-body">
      <Row
        term={`${formatPrice(pricePerNight)} × ${nights} ${nights === 1 ? 'night' : 'nights'}`}
        value={formatPrice(price.subtotal)}
      />
      {price.cleaningFee > 0 && (
        <Row term="Cleaning fee" value={formatPrice(price.cleaningFee)} />
      )}
      <Row term="Service fee" value={formatPrice(price.serviceFee)} />
      <div className="flex items-baseline justify-between gap-4 border-t border-hairline pt-2 font-semibold text-ink">
        <dt>Total</dt>
        <dd className="shrink-0">{formatPrice(price.total)}</dd>
      </div>
    </dl>
  )
}

/**
 * DESIGN.md `reservation-card` specifies a stepper rather than a select.
 *
 * Capped at the **listing's** `max_guests`, not the global 16 — and the action
 * re-checks it, because that cap has no constraint behind it.
 */
function GuestStepper({
  guests,
  maxGuests,
  onChange,
}: {
  guests: number
  maxGuests: number
  onChange: (next: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-ink">Guests</p>
        {/* Announced on change, since the number is the only thing that moves. */}
        <p className="mt-0.5 text-sm text-ink" aria-live="polite">
          {guests} {guests === 1 ? 'guest' : 'guests'}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <StepperButton
          label="Remove a guest"
          disabled={guests <= 1}
          onClick={() => onChange(guests - 1)}
        >
          <Minus className="size-4" aria-hidden />
        </StepperButton>
        <StepperButton
          label="Add a guest"
          disabled={guests >= maxGuests}
          onClick={() => onChange(guests + 1)}
        >
          <Plus className="size-4" aria-hidden />
        </StepperButton>
      </div>
    </div>
  )
}

function StepperButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      // 44px, the code-standards floor, over DESIGN.md's smaller icon circles.
      className={cn(
        'flex size-11 items-center justify-center rounded-full border border-hairline text-ink',
        'hover:border-ink disabled:border-hairline disabled:text-muted-soft',
      )}
    >
      {children}
    </button>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink">{label}</p>
      <p className="mt-0.5 text-sm text-muted">{value}</p>
    </div>
  )
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt>{term}</dt>
      <dd className="shrink-0">{value}</dd>
    </div>
  )
}

/**
 * "Aug 12" — the single date a reservation field shows.
 *
 * `formatInclusiveRange`, not `formatDateRange`: the latter renders a *range* and
 * would print "Aug 12 – 12" for one day, which is exactly the case the former was
 * written to collapse.
 */
function formatDay(iso: string): string {
  return formatInclusiveRange({ start: iso, end: iso })
}
