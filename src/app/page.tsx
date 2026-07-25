import { Suspense } from 'react'

import { ListingGrid } from '@/components/listings/ListingGrid'
import { ListingGridSkeleton } from '@/components/listings/ListingGridSkeleton'
import { SignInBanner } from '@/components/navigation/SignInBanner'
import { FilterPanel } from '@/components/search/FilterPanel'
import { safeNextPath } from '@/lib/utils'
import {
  parseListingFilters,
  type RawSearchParams,
} from '@/lib/validations/listings'

// Next 16: searchParams is async and must be awaited.
type Props = {
  searchParams: Promise<RawSearchParams>
}

/**
 * Home — the discovery surface, and the search-results page. Every filter lives
 * in the URL (`code-standards.md`), so this reads `searchParams` and nothing is
 * mirrored into client state.
 *
 * The page itself must never await the listings query: the shell (banner,
 * heading, filters) is what a redirected user needs to see first, so only
 * <ListingGrid> suspends and the rest streams immediately.
 */
export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams
  const filters = parseListingFilters(params)

  const signin = firstValue(params.signin)
  const next = firstValue(params.next)

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
          {filters.city ? `Stays in ${filters.city}` : 'Stays for your next trip'}
        </h1>
        <p className="mt-2 text-base text-body">
          Browse places to stay around the world.
        </p>

        <div className="mt-8">
          <FilterPanel filters={filters} />
        </div>

        <div className="mt-8">
          {/* Keyed on the filters so a new search shows the skeleton again
              instead of leaving the previous results on screen while it loads. */}
          <Suspense key={JSON.stringify(filters)} fallback={<ListingGridSkeleton />}>
            <ListingGrid filters={filters} />
          </Suspense>
        </div>
      </div>
    </>
  )
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
