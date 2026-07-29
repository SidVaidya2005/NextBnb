'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  HOST_CONTROL,
  HOST_CONTROL_DANGER,
  HOST_CONTROL_DEFAULT,
} from '@/components/host/hostControlStyles'
import { adminDeleteListing, adminUnpublishListing } from '@/lib/actions/admin'
import { useFocusWhen } from '@/lib/hooks/useFocusWhen'
import { cn } from '@/lib/utils'

type Props = {
  listingId: string
  /** Every accessible name carries it — one of these renders per row. */
  listingTitle: string
  isPublished: boolean
  /** `deletionImpact().sentence` — null when the delete costs nothing. */
  impact: string | null
  /** Drives the sharper warning: these are stays that have not happened yet. */
  upcomingStays: number
}

/**
 * Unpublish and delete, for one listing, as an admin.
 *
 * **The delete refuses nothing, and the confirm step is what pays for that.**
 * `deleteListing` (the host's) blocks while an upcoming confirmed stay exists;
 * this one deliberately does not, because F10 left `listings_delete_own_or_admin`
 * open so moderation keeps a hard-delete escape hatch for spam. What replaces the
 * refusal is the count: `bookings.listing_id` is `on delete cascade`, so those
 * stays are **erased**, not cancelled — no `cancelled_at`, no row, nothing in the
 * guest's Trips explaining where their booking went. F10's Key Decision calls that
 * a destructive path with no error, no test and no type pointing at it. This is
 * the sentence that points at it, before the click rather than after.
 *
 * **Unpublish is offered inside the confirm**, not only beside it. The moment an
 * operator learns the delete erases three reservations is the moment to offer the
 * reversible verb, and making them back out to find it is how the destructive one
 * gets chosen by default.
 *
 * Two steps inline rather than a dialog: F10 and F13 each rejected one (DESIGN.md
 * specs no dialog, `window.confirm` is unstyleable and blocks the event loop, and
 * F12's sheet already ships without a focus trap — F18 owns that). Inline is
 * keyboard-accessible for free.
 */
export function AdminListingActions({
  listingId,
  listingTitle,
  isPublished,
  impact,
  upcomingStays,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const confirmRef = useRef<HTMLButtonElement>(null)
  const deleteRef = useRef<HTMLButtonElement>(null)

  // **The sharpest case of the five.** This confirm step also renders the
  // `role="alert"` naming what the delete erases — reservations that vanish with
  // no cancellation. Without focus moving here, a keyboard admin presses Delete,
  // loses focus to `<body>`, and cannot reach the copy that exists to make the
  // blast radius reconsiderable. The alert is announced either way; being able
  // to go back and *re-read* it is what this restores.
  useFocusWhen(confirming, confirmRef)
  useFocusWhen(!confirming, deleteRef)

  function onUnpublish() {
    setError(null)
    startTransition(async () => {
      const result = await adminUnpublishListing({ listingId })
      if (!result.ok) {
        setError(result.error)
        setConfirming(false)
        return
      }
      setConfirming(false)
      router.refresh()
    })
  }

  function onDelete() {
    setError(null)
    startTransition(async () => {
      const result = await adminDeleteListing({ listingId })
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
        {/* One direction only — there is no admin republish, because publishing
            carries a >= 1 photo guard that lives in setListingPublished. A host
            republishes their own listing. */}
        {isPublished && !confirming && (
          <button
            type="button"
            className={cn(HOST_CONTROL, HOST_CONTROL_DEFAULT)}
            disabled={pending}
            aria-label={`Unpublish ${listingTitle}`}
            onClick={onUnpublish}
          >
            {pending ? 'Working…' : 'Unpublish'}
          </button>
        )}

        {confirming ? (
          <>
            <button
              ref={confirmRef}
              type="button"
              className={cn(HOST_CONTROL, HOST_CONTROL_DANGER)}
              disabled={pending}
              aria-label={`Confirm deleting ${listingTitle}`}
              onClick={onDelete}
            >
              {pending ? 'Deleting…' : 'Confirm delete'}
            </button>
            {isPublished && (
              <button
                type="button"
                className={cn(HOST_CONTROL, HOST_CONTROL_DEFAULT)}
                disabled={pending}
                aria-label={`Unpublish ${listingTitle} instead of deleting it`}
                onClick={onUnpublish}
              >
                Unpublish instead
              </button>
            )}
            <button
              type="button"
              className={cn(HOST_CONTROL, HOST_CONTROL_DEFAULT)}
              disabled={pending}
              aria-label={`Keep ${listingTitle}`}
              onClick={() => setConfirming(false)}
            >
              Keep
            </button>
          </>
        ) : (
          <button
            ref={deleteRef}
            type="button"
            className={cn(HOST_CONTROL, HOST_CONTROL_DANGER)}
            disabled={pending}
            aria-label={`Delete ${listingTitle}`}
            onClick={() => setConfirming(true)}
          >
            Delete
          </button>
        )}
      </div>

      {confirming && (
        <div role="alert" className="max-w-prose space-y-1 text-sm">
          <p className="font-medium text-error">
            {impact ?? 'This deletes the listing and its photos.'}
          </p>
          {upcomingStays > 0 && (
            <p className="text-body">
              Guests see no cancellation — those reservations are erased, not
              cancelled, and nothing is left in their trips to explain it.
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  )
}
