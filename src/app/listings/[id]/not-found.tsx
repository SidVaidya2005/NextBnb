import Link from 'next/link'

/**
 * The 404 for `/listings/[id]` — the project's first, because this is the first
 * route that can legitimately fail to resolve.
 *
 * It is reached three ways, all ordinary: the id is not a uuid, no such listing
 * exists, or the listing is an unpublished draft belonging to someone else. The
 * three are deliberately indistinguishable — telling a stranger that a draft
 * exists at an id would leak exactly what the `listings` SELECT policy hides.
 *
 * Scoped to this route rather than the app root so it renders inside the layout,
 * with the nav and search still available.
 */
export default function ListingNotFound() {
  return (
    <div className="mx-auto max-w-content px-6 py-16 tablet:px-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink tablet:text-[28px]">
        We can&apos;t find that listing
      </h1>
      <p className="mt-3 max-w-prose text-base text-body">
        It may have been removed by its host, or the link may be incorrect.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-12 items-center rounded-sm bg-primary px-6 text-base font-medium text-on-primary transition-colors hover:bg-primary-active"
      >
        Browse other stays
      </Link>
    </div>
  )
}
