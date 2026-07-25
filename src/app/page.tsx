import { Suspense } from 'react'

import { ListingGrid } from '@/components/listings/ListingGrid'
import { ListingGridSkeleton } from '@/components/listings/ListingGridSkeleton'
import { SignInBanner } from '@/components/navigation/SignInBanner'
import { safeNextPath } from '@/lib/utils'

// Next 16: searchParams is async and must be awaited.
type Props = {
  searchParams: Promise<{ signin?: string; next?: string }>
}

/**
 * Home — the discovery surface. Renders every published listing (Feature 05);
 * the search bar and filters that narrow it arrive in Feature 06.
 *
 * The page itself must never await the listings query: the shell (banner +
 * heading) is what a redirected user needs to see first, so only <ListingGrid>
 * suspends and the rest streams immediately.
 */
export default async function HomePage({ searchParams }: Props) {
  const { signin, next } = await searchParams

  return (
    <>
      {(signin === 'required' || signin === 'error') && (
        <SignInBanner
          variant={signin === 'error' ? 'error' : 'required'}
          next={safeNextPath(next)}
        />
      )}

      <div className="mx-auto max-w-wide px-6 py-10 tablet:px-10">
        <h1 className="text-2xl font-bold tracking-tight text-ink tablet:text-[28px]">
          Stays for your next trip
        </h1>
        <p className="mt-2 text-base text-body">
          Browse places to stay around the world.
        </p>

        <div className="mt-8">
          <Suspense fallback={<ListingGridSkeleton />}>
            <ListingGrid />
          </Suspense>
        </div>
      </div>
    </>
  )
}
