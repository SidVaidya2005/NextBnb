'use client'

import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

type Options = {
  /** Whether the surface is currently open. */
  open: boolean
  /** Called when Escape is pressed, or a pointer lands outside `containerRef`. */
  onDismiss: () => void
  /** The surface itself — the trap's boundary and the outside-click test. */
  containerRef: RefObject<HTMLElement | null>
  /**
   * Cycle Tab within the surface, and move focus into it on open. Only for
   * `aria-modal="true"` surfaces — a non-modal popover must stay tabbable-past.
   */
  trapFocus?: boolean
  /** Dismiss on a pointer down outside the surface. Default `true`. */
  dismissOnOutsidePointer?: boolean
}

/**
 * Escape-to-close, focus restore, and (for modals only) a Tab cycle.
 *
 * **Why this exists at all:** before F18 there was no `.focus()` call anywhere in
 * `src/`. Two surfaces declared `aria-modal="true"` while Tab walked straight out
 * of them into the page behind, and closing any dismissable surface dropped focus
 * back to the top of the document — so a keyboard user who opened the booking
 * sheet and closed it had to tab through the entire nav again to get back.
 *
 * **The trigger is captured, not passed in.** On open this reads
 * `document.activeElement` and restores to it on close. The alternative —
 * threading a ref from each of five call sites — is more code at every one of
 * them and is *less* correct: the element that opened the surface is not always
 * the element a ref would name (`AccountMenu` closes on outside click, and
 * `BookingWidget`'s trigger unmounts when the sheet swaps to its confirmation
 * panel). Reading the live focus owner is the fact we actually want.
 *
 * @see useFocusWhen — the sibling for two-step confirm controls, which move focus
 * *forward* into a control that has just appeared rather than restoring it.
 */
export function useDismissable({
  open,
  onDismiss,
  containerRef,
  trapFocus = false,
  dismissOnOutsidePointer = true,
}: Options): void {
  // Held across renders so the close-effect can restore what the open-effect saw.
  const triggerRef = useRef<HTMLElement | null>(null)

  // `onDismiss` is typically an inline arrow, so a new identity every render.
  // Reading it through a ref keeps it out of the effect deps — otherwise every
  // render tears down and rebuilds the listeners, and a keydown arriving in that
  // window is dropped.
  const onDismissRef = useRef(onDismiss)
  useEffect(() => {
    onDismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    if (!open) return

    const container = containerRef.current
    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    // **A trap that only wraps Tab does nothing until focus is inside it.** On
    // open, focus stays on the trigger — which sits *behind* the scrim — so the
    // first Tab would leave through the page, never reaching the wrap logic.
    // Moving focus in is what makes the rest of this function true.
    if (trapFocus && container) {
      const first = focusableWithin(container)[0]
      ;(first ?? container).focus()
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onDismissRef.current()
        return
      }

      if (event.key !== 'Tab' || !trapFocus) return

      const surface = containerRef.current
      if (!surface) return

      const focusable = focusableWithin(surface)
      if (focusable.length === 0) {
        // **Yield rather than trap.** Both modal surfaces here are
        // `tablet:hidden`, so widening the viewport past 744px leaves them
        // mounted with `open` still true but nothing rendered. Preventing
        // default in that state would strand the user's focus against a surface
        // they cannot see and cannot tab into. An empty surface is not a trap.
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (event.shiftKey && (active === first || !surface.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !surface.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    function onPointerDown(event: MouseEvent) {
      if (!dismissOnOutsidePointer) return
      if (!containerRef.current?.contains(event.target as Node)) onDismissRef.current()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open, containerRef, trapFocus, dismissOnOutsidePointer])

  useEffect(() => {
    if (open) return
    const trigger = triggerRef.current
    triggerRef.current = null

    // `isConnected` is not defensive padding: `BookingWidget`'s sheet trigger is
    // genuinely unmounted by the time the sheet closes on a successful reserve,
    // and focusing a detached node silently moves focus to `<body>` — which is
    // the exact bug this hook exists to fix, reintroduced by its own cleanup.
    if (trigger?.isConnected) trigger.focus()
  }, [open])
}

/**
 * Focusable descendants in tab order.
 *
 * **`getClientRects().length` is the visibility test, not `offsetParent`.** Both
 * modal surfaces in this project are `position: fixed`, and `offsetParent` is
 * `null` for a fixed element — so an `offsetParent` check reports the entire
 * dialog as invisible and the trap silently degrades to nothing.
 */
function focusableWithin(root: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',')

  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (element) => element.getClientRects().length > 0,
  )
}
