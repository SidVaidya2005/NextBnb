import { Suspense } from 'react'
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
 * **No `loading.tsx`, and no auth check here.** `src/proxy.ts` already bounces a
 * signed-out visitor away from `/host/**`, and this route cannot 404 (a host
 * with nothing yet is an empty state, not a missing page). The grid streams
 * behind a `<Suspense>` rather than a route-level `loading.tsx` for F05's
 * reason: the heading and the "List your place" CTA are what a host arriving
 * here wants first, and a `loading.tsx` would blank them too.
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
        <Suspense fallback={<HostListingsSkeleton />}>
          <HostListings />
        </Suspense>
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

function HostListingsSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="flex animate-pulse flex-col gap-4 rounded-md border border-hairline p-4 tablet:flex-row"
        >
          <div className="aspect-[4/3] w-full shrink-0 rounded-md bg-surface-soft tablet:w-56" />
          <div className="flex-1 space-y-3 py-1">
            <div className="h-4 w-1/2 rounded-sm bg-surface-soft" />
            <div className="h-3 w-1/3 rounded-sm bg-surface-soft" />
            <div className="h-11 w-2/3 rounded-sm bg-surface-soft" />
          </div>
        </div>
      ))}
    </div>
  )
}
