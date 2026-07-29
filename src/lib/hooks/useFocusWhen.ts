'use client'

import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

/**
 * Move focus to `ref` when `active` transitions from false to true.
 *
 * **For controls that appear, not surfaces that open.** The five two-step
 * confirms in this project (`ListingActions`, `CancelTripButton`, `TripReview`,
 * `AdminListingActions`, `AdminCancelBookingButton`) all swap one button for two
 * or three on click. Before F18 nothing moved focus when that happened, so a
 * keyboard user pressed "Delete", the button under their focus was replaced, and
 * focus fell to `<body>` — leaving them to tab back in from the top of the page
 * to reach a confirmation they had just asked for. `AdminListingActions` is the
 * sharpest case: its confirm step also renders the `role="alert"` naming what the
 * delete would erase, which a keyboard user could not reach to re-read.
 *
 * **The transition matters, not the value.** Firing on `active` alone would steal
 * focus on mount — every trip card on `/trips` would fight for it on load. The
 * `previous` ref is what makes this a *transition* trigger, and it is seeded from
 * the initial `active` so a control that mounts already-open does not grab focus
 * either.
 *
 * Pair two calls to cover both directions:
 *
 * ```ts
 * useFocusWhen(confirming, confirmRef)   // forward: into the confirm
 * useFocusWhen(!confirming, triggerRef)  // back: to the control that opened it
 * ```
 *
 * @see useDismissable — the sibling for Escape-dismissable surfaces, which
 * restores focus to a *captured* trigger rather than a named ref.
 */
export function useFocusWhen(
  active: boolean,
  ref: RefObject<HTMLElement | null>,
): void {
  const previous = useRef(active)

  useEffect(() => {
    if (active && !previous.current) ref.current?.focus()
    previous.current = active
  }, [active, ref])
}
