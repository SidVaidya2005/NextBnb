// Shared classes for the compact controls on a host listing row, in one place
// because both the links (`HostListingCard`, a Server Component) and the action
// buttons (`ListingActions`, a Client Component) render to them — and a copy in
// each would be two chances to drift. It lives in its own directive-free module
// for exactly that reason: neither component can import a const from the other
// without dragging its whole module into the wrong graph. Same arrangement as
// `ui/fieldStyles.ts`.
//
// `h-11` is 44px — `code-standards.md`'s hard tap-target floor rather than
// DESIGN.md's 48px `button-primary`. Four controls sit on one row here, and at
// 320px the full-height buttons cannot fit; the floor is the part that is
// non-negotiable.
export const HOST_CONTROL =
  'inline-flex h-11 shrink-0 items-center justify-center rounded-sm border px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed'

export const HOST_CONTROL_DEFAULT =
  'border-hairline bg-canvas text-ink hover:bg-surface-soft disabled:border-hairline disabled:text-muted'

/** Destructive. `#c13515` is DESIGN.md's error tone, not the Rausch accent —
 *  the accent is reserved for primary CTAs, the search orb and the saved heart. */
export const HOST_CONTROL_DANGER =
  'border-hairline bg-canvas text-error hover:bg-surface-soft disabled:border-hairline disabled:text-muted'
