import { EyeOff } from 'lucide-react'

/**
 * Shown when the viewer is looking at their own unpublished listing.
 *
 * Reaching this page at all means the `listings` SELECT policy returned an
 * unpublished row, which it does only for the host and for admins — so the
 * notice is driven by RLS's answer, not by an application-side role check.
 *
 * Styled on `surface-soft` and hairline rather than Rausch: the accent is
 * reserved for primary CTAs, the search orb and the saved heart, and a draft is
 * information, not an error.
 */
export function DraftNotice() {
  return (
    <div
      role="status"
      className="mb-6 flex items-center gap-3 rounded-md border border-hairline bg-surface-soft px-4 py-3"
    >
      <EyeOff className="size-5 shrink-0 text-muted" aria-hidden />
      <p className="text-sm text-body">
        <span className="font-medium text-ink">Draft</span> — only you can see this
        listing. Publish it to make it bookable.
      </p>
    </div>
  )
}
