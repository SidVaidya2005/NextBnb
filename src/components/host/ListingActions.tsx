'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  HOST_CONTROL,
  HOST_CONTROL_DANGER,
  HOST_CONTROL_DEFAULT,
} from '@/components/host/hostControlStyles'
import { deleteListing, setListingPublished } from '@/lib/actions/listings'
import { useFocusWhen } from '@/lib/hooks/useFocusWhen'
import { cn } from '@/lib/utils'

type Props = {
  listingId: string
  /** Every accessible name carries it — see the note on scoping below. */
  listingTitle: string
  isPublished: boolean
  /** False while a confirmed stay is still upcoming. */
  canDelete: boolean
}

/**
 * The publish toggle and the delete control for one listing.
 *
 * **Every control names its listing.** `/host/listings` renders one of these per
 * row, so a bare "Delete" would match N times and any spec locating it would be
 * a strict-mode violation — the fifth time this project has met a locator
 * coupled to something outside the thing under test (F05's `getByText('0.0')`
 * matching prices, F07's `circle-user-round` counting the nav, F08's
 * `input[name="next"]` matching hearts, F09's `getByLabel('Guests')` matching
 * the SearchBar). Naming them is also the correct accessibility answer.
 *
 * Actions run in a transition and then `router.refresh()`, the same shape as
 * `PhotoManager` — both actions revalidate the page being looked at, so the
 * server is the fastest correct source of the new state and there is no
 * "wrong for a moment" worth inventing. (F08's heart is the opposite case: it
 * revalidates a *different* route, which is why it holds local state instead.)
 */
export function ListingActions({
  listingId,
  listingTitle,
  isPublished,
  canDelete,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const confirmRef = useRef<HTMLButtonElement>(null)
  const deleteRef = useRef<HTMLButtonElement>(null)

  // Focus follows the swap in both directions. Without it the Delete button the
  // host just pressed is replaced under their focus and it falls to `<body>`.
  useFocusWhen(confirming, confirmRef)
  useFocusWhen(!confirming, deleteRef)

  function onTogglePublished() {
    setError(null)
    startTransition(async () => {
      // The state we want, not an instruction to flip: two clicks in flight
      // then converge instead of resolving against the same stale "before".
      const result = await setListingPublished({
        listingId,
        published: !isPublished,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function onDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteListing({ listingId })
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
        <button
          type="button"
          className={cn(HOST_CONTROL, HOST_CONTROL_DEFAULT)}
          disabled={pending}
          aria-label={`${isPublished ? 'Unpublish' : 'Publish'} ${listingTitle}`}
          onClick={onTogglePublished}
        >
          {isPublished ? 'Unpublish' : 'Publish'}
        </button>

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
            <button
              type="button"
              className={cn(HOST_CONTROL, HOST_CONTROL_DEFAULT)}
              disabled={pending}
              aria-label={`Keep ${listingTitle}`}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            ref={deleteRef}
            type="button"
            className={cn(HOST_CONTROL, HOST_CONTROL_DANGER)}
            disabled={pending || !canDelete}
            aria-label={`Delete ${listingTitle}`}
            onClick={() => setConfirming(true)}
          >
            Delete
          </button>
        )}
      </div>

      {/* Stated, not merely disabled — a dead button with no reason is the thing
          users report as broken (F09's publish control set the precedent). */}
      {!canDelete && !error && (
        <p className="text-sm text-muted">
          This listing has upcoming reservations. Unpublish it instead.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  )
}
