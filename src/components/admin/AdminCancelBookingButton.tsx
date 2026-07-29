'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  HOST_CONTROL,
  HOST_CONTROL_DANGER,
  HOST_CONTROL_DEFAULT,
} from '@/components/host/hostControlStyles'
import { adminCancelBooking } from '@/lib/actions/admin'
import { cn } from '@/lib/utils'

type Props = {
  bookingId: string
  /** Names this reservation — one control renders per row. */
  bookingLabel: string
}

/**
 * Cancel one reservation as an admin.
 *
 * **Two steps, like every other destructive control in this project** (F10's
 * delete, F13's cancel), but the thing being confirmed is milder: a cancellation
 * is reversible in effect — the dates free up, the row survives carrying
 * `cancelled_at`, and the guest can see what happened. That is exactly why the
 * build plan reserves hard deletes for the Listings table and gives Bookings only
 * this.
 *
 * **An admin can cancel a stay its own guest could not.** The guest branch of
 * `bookings_update_cancel_own_or_admin` requires `check_in >= current_date`; the
 * admin branch carries no window, so an in-progress stay is cancellable from
 * here. `canCancel` on the row is therefore `status === 'confirmed'` and
 * deliberately not `canCancelBooking`, which mirrors the guest branch.
 */
export function AdminCancelBookingButton({ bookingId, bookingLabel }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  function onCancel() {
    setError(null)
    startTransition(async () => {
      const result = await adminCancelBooking({ bookingId })
      if (!result.ok) {
        setError(result.error)
        setConfirming(false)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <button
              type="button"
              className={cn(HOST_CONTROL, HOST_CONTROL_DANGER)}
              disabled={pending}
              aria-label={`Confirm cancelling ${bookingLabel}`}
              onClick={onCancel}
            >
              {pending ? 'Cancelling…' : 'Confirm cancel'}
            </button>
            <button
              type="button"
              className={cn(HOST_CONTROL, HOST_CONTROL_DEFAULT)}
              disabled={pending}
              aria-label={`Keep ${bookingLabel}`}
              onClick={() => setConfirming(false)}
            >
              Keep
            </button>
          </>
        ) : (
          <button
            type="button"
            className={cn(HOST_CONTROL, HOST_CONTROL_DANGER)}
            disabled={pending}
            aria-label={`Cancel ${bookingLabel}`}
            onClick={() => setConfirming(true)}
          >
            Cancel
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  )
}
