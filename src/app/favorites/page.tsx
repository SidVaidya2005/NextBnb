import Link from 'next/link'

import { ListingCard } from '@/components/listings/ListingCard'
import { LISTING_GRID_CLASSES } from '@/components/listings/ListingGrid'
import { getFavorites } from '@/lib/queries/favorites'

/**
 * The stays the signed-in user has saved, most recently saved first.
 *
 * `src/proxy.ts` guards the route, so anyone reaching this component has a
 * session — which is why the cards are always rendered with `isSignedIn`.
 *
 * The page awaits its one query directly: no `<Suspense>` (there is no shell
 * worth painting before a personal list) and no `loading.tsx` (unnecessary here,
 * and F07's precedent is to reach for it only where a route can never 404 —
 * this one cannot, but neither does it benefit).
 */
export default async function FavoritesPage() {
  const favorites = await getFavorites()

  return (
    <div className="mx-auto max-w-wide px-6 py-10 tablet:px-10">
      <h1 className="text-2xl font-bold tracking-tight text-ink tablet:text-[28px]">
        Favorites
      </h1>

      {favorites.length === 0 ? (
        <NoFavorites />
      ) : (
        <>
          <p className="mt-2 pb-5 text-base text-body">
            {favorites.length} saved{' '}
            {favorites.length === 1 ? 'stay' : 'stays'}
          </p>

          <ul aria-label="Saved stays" className={LISTING_GRID_CLASSES}>
            {favorites.map((listing, index) => (
              <li key={listing.id}>
                <ListingCard
                  listing={listing}
                  isSignedIn
                  priority={index < 4}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/** Also the failed-read state: getFavorites logs and returns [] rather than throwing. */
function NoFavorites() {
  return (
    <div className="mt-8 rounded-md border border-hairline px-6 py-16 text-center">
      <p className="text-base font-semibold text-ink">No saved stays yet</p>
      <p className="mt-2 text-sm text-muted">
        Tap the heart on any stay and it will show up here.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-12 items-center rounded-sm bg-primary px-6 text-base font-medium text-on-primary hover:bg-primary-active"
      >
        Browse stays
      </Link>
    </div>
  )
}
