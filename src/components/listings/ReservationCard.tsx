import { formatPrice } from '@/lib/utils'

type Props = {
  /** Integer **cents**. */
  pricePerNight: number
  /** Integer **cents**; zero for the listings that charge none. */
  cleaningFee: number
  minNights: number
  maxGuests: number
}

/**
 * DESIGN.md `reservation-card` — a sticky right rail from `tablet:` up, and a
 * sticky bottom bar below it, per the spec's collapsing strategy.
 *
 * **This is F07's shell: it reads no availability and creates no booking.** The
 * date fields and Reserve are inert on purpose. Filling them needs to know which
 * nights are taken, and `bookings` has no `anon` RLS policy at all — a signed-out
 * visitor reads zero booking rows, so any app-side date check would report every
 * night as free, silently and successfully. F12 adds the `security definer`
 * function that answers it properly, the way F06 did for search.
 *
 * Both renderings live in this one component because they must never disagree
 * about the price.
 */
export function ReservationCard({
  pricePerNight,
  cleaningFee,
  minNights,
  maxGuests,
}: Props) {
  const price = formatPrice(pricePerNight)

  return (
    <>
      <aside
        aria-label="Reservation"
        // `self-start` is load-bearing: a grid item stretches to its cell by
        // default, which leaves `sticky` no room to travel. top-24 clears the
        // 80px nav.
        className="hidden tablet:sticky tablet:top-24 tablet:block tablet:self-start"
      >
        <div className="rounded-md border border-hairline bg-canvas p-6 shadow-card">
          <p className="text-ink">
            <span className="text-xl font-semibold">{price}</span>{' '}
            <span className="text-base text-body">night</span>
          </p>

          {/* Inert until F12 — rendered as text, not disabled inputs, so nothing
              here is focusable and promising an interaction it cannot deliver. */}
          <div className="mt-4 overflow-hidden rounded-sm border border-hairline">
            <div className="grid grid-cols-2 divide-x divide-hairline">
              <ReservationField label="Check-in" value="Add dates" />
              <ReservationField label="Checkout" value="Add dates" />
            </div>
            <div className="border-t border-hairline">
              <ReservationField label="Guests" value="1 guest" />
            </div>
          </div>

          <button
            type="button"
            disabled
            className="mt-4 h-12 w-full cursor-not-allowed rounded-sm bg-primary-disabled text-base font-medium text-on-primary"
          >
            Reserve
          </button>
          <p className="mt-2 text-center text-sm text-muted">
            Reservations open soon.
          </p>

          {/* No line total: without dates there are no nights to multiply by,
              and inventing one would be the price breakdown F12 owns. The
              nightly rate is already the headline above. */}
          <dl className="mt-6 space-y-2 border-t border-hairline pt-4 text-base text-body">
            {cleaningFee > 0 && (
              <ReservationRow term="Cleaning fee" value={formatPrice(cleaningFee)} />
            )}
            <ReservationRow
              term="Minimum stay"
              value={`${minNights} ${minNights === 1 ? 'night' : 'nights'}`}
            />
            <ReservationRow
              term="Maximum guests"
              value={`${maxGuests} ${maxGuests === 1 ? 'guest' : 'guests'}`}
            />
          </dl>
        </div>
      </aside>

      {/* Below tablet the rail becomes a bar pinned to the bottom of the
          viewport, carrying only price and the CTA. */}
      <div
        aria-label="Reservation summary"
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-hairline bg-canvas px-6 py-3 tablet:hidden"
      >
        <p className="text-ink">
          <span className="text-base font-semibold">{price}</span>{' '}
          <span className="text-sm text-body">night</span>
        </p>
        <button
          type="button"
          disabled
          className="h-12 cursor-not-allowed rounded-sm bg-primary-disabled px-6 text-base font-medium text-on-primary"
        >
          Reserve
        </button>
      </div>
    </>
  )
}

function ReservationField({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink">{label}</p>
      <p className="mt-0.5 text-sm text-muted">{value}</p>
    </div>
  )
}

function ReservationRow({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt>{term}</dt>
      <dd className="shrink-0">{value}</dd>
    </div>
  )
}
