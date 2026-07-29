'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { cancelBooking } from '@/lib/actions/bookings'
import { useFocusWhen } from '@/lib/hooks/useFocusWhen'

type Props = {
  bookingId: string
  /** Every control names its trip — see the note below. */
  tripLabel: string
}

/**
 * The two-step cancel control on a trip card, and the only client component on
 * `/trips`.
 *
 * **Two steps, inline.** F10 set the precedent and the reasons still hold: no
 * `window.confirm` (unstyleable, and it blocks the event loop), no modal
 * primitive (DESIGN.md specs no dialog, and F12's sheet already ships without a
 * focus trap — F18 owns that). Inline is keyboard-accessible for free.
 *
 * **Every control names its trip.** `/trips` renders one of these per booking,
 * so a bare "Cancel" would match N times and any spec locating it would be a
 * strict-mode violation — the same trap F05, F07, F08, F09 and F10 each met.
 * Naming them is also the correct accessibility answer.
 *
 * **`router.refresh()` rather than local state**, matching `ListingActions`:
 * `cancelBooking` revalidates `/trips`, the page being looked at, so the server
 * is the fastest correct source of the new state and a cancelled stay has to
 * move sections anyway — which is not something optimistic local state can do.
 * (F08's heart is the opposite case: it revalidates a *different* route.)
 *
 * **DESIGN.md `button-secondary` at 48px**, not the host row's 44px
 * `HOST_CONTROL`. That compromise exists because four controls share one row at
 * 320px; a trip card has one, so it gets the full spec. The error tone on the
 * confirm step is DESIGN.md's `#c13515`, never the Rausch accent — which is
 * reserved for primary CTAs, the search orb and the saved heart.
 */
export function CancelTripButton({ bookingId, tripLabel }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const confirmRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // The confirm swap replaces the button the user just pressed, so without this
  // their focus falls to `<body>` and they tab back from the top of the page to
  // reach a confirmation they asked for. Both directions, so backing out of the
  // confirm returns focus to "Cancel reservation" rather than losing it again.
  useFocusWhen(confirming, confirmRef)
  useFocusWhen(!confirming, triggerRef)

  function onCancel() {
    setError(null)
    startTransition(async () => {
      const result = await cancelBooking({ bookingId })
      if (!result.ok) {
        // The refusal the zero-row guard produces lands here — most often
        // "that stay can no longer be cancelled" because check-in passed while
        // the page was open. Showing it beats a silent no-op.
        setError(result.error)
        setConfirming(false)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            ref={confirmRef}
            variant="secondary"
            className="border-error text-error"
            disabled={pending}
            aria-label={`Confirm cancelling ${tripLabel}`}
            onClick={onCancel}
          >
            {pending ? 'Cancelling…' : 'Confirm cancellation'}
          </Button>
          <Button
            variant="secondary"
            disabled={pending}
            aria-label={`Keep ${tripLabel}`}
            onClick={() => setConfirming(false)}
          >
            Keep it
          </Button>
        </div>
      ) : (
        <Button
          ref={triggerRef}
          variant="secondary"
          disabled={pending}
          aria-label={`Cancel ${tripLabel}`}
          onClick={() => setConfirming(true)}
        >
          Cancel reservation
        </Button>
      )}

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  )
}
