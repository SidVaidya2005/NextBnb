import type { Metadata } from 'next'
import Link from 'next/link'

import { HostListingCard } from '@/components/host/HostListingCard'
import { getOwnListings } from '@/lib/queries/listings'

export const metadata: Metadata = {
  title: 'Your listings · NextBnb',
}

/**
 * Every listing this user hosts — published and drafts alike.
 *
 * **No auth check here.** `src/proxy.ts` already bounces a signed-out visitor
 * away from `/host/**`, and this route cannot 404 (a host with nothing yet is an
 * empty state, not a missing page).
 *
 * **No `loading.tsx` AND no `<Suspense>`, and the second half of that is a
 * correctness fix, not a preference.** F05's reasoning put the grid behind a
 * `<Suspense>` so the heading and the "List your place" CTA paint before the
 * query resolves. That is a real benefit and it was deliberately given up here,
 * because a Suspense boundary on this route makes the **`router.refresh()` after
 * a mutation** silently fail in a production build:
 *
 * - `ListingActions` runs its server action inside `startTransition` and then
 *   calls `router.refresh()`, so React holds `isPending` until that refresh
 *   commits — every control on the row stays `disabled` meanwhile.
 * - With a Suspense boundary the refresh's RSC response is **streamed**. Against
 *   `next build && next start` that stream is aborted after its 200 and before
 *   the boundary content arrives (`net::ERR_ABORTED` on
 *   `/host/listings?_rsc=…`), so the transition never commits. The database
 *   write has already succeeded; the screen just keeps showing the old row, with
 *   "Deleting…" and disabled buttons, for tens of seconds.
 * - **`next dev` never streams it that way, so this is invisible in
 *   development** — the whole suite is green against the dev server and fails
 *   only against a production build. That gap is why it survived from F10 to
 *   F18 as "a flaky test".
 *
 * Removing the boundary makes the refresh a single non-streamed response and the
 * transition commits normally: `host-manage.spec.ts` goes from 3–4 failed to
 * 20/20 against a production build, with this as the only change.
 *
 * **The same shape still exists on other routes** (`/trips`, `/admin`,
 * `/listings/[id]`, the other `/host/listings/[id]/*` pages) — a `<Suspense>`
 * page plus a client component calling `router.refresh()`. None of them
 * reproduces it today, so they are left alone rather than changed on
 * speculation; `context/build-journal.md` → F19 carries the repro recipe if one
 * of them ever does.
 */
export default function HostListingsPage() {
  return (
    <div className="mx-auto max-w-content px-6 py-10 tablet:px-10 tablet:py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink tablet:text-[28px]">
            Your listings
          </h1>
          <p className="mt-2 text-base text-body">
            Everything you host, published and draft.
          </p>
        </div>

        <Link
          href="/host/listings/new"
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-sm bg-primary px-6 text-base font-medium text-on-primary transition hover:bg-primary-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          List your place
        </Link>
      </div>

      <div className="mt-10">
        <HostListings />
      </div>
    </div>
  )
}

async function HostListings() {
  const listings = await getOwnListings()

  if (listings.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-hairline px-6 py-16 text-center text-base text-muted">
        You have not listed a place yet. Start with “List your place”.
      </p>
    )
  }

  return (
    // Semantic list, not test ids — the same reasoning as the home grid: it *is*
    // a list, and the correct markup also gives specs a stable scoped selector.
    <ul aria-label="Your listings" className="space-y-4">
      {listings.map((listing) => (
        <HostListingCard key={listing.id} listing={listing} />
      ))}
    </ul>
  )
}
