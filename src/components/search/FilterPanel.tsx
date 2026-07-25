import Link from 'next/link'
import { SlidersHorizontal } from 'lucide-react'

import { AMENITIES, PROPERTY_TYPES } from '@/lib/constants'
import { homeHref, setOrDelete } from '@/lib/searchParams'
import { humanizeToken } from '@/lib/utils'
import type { ListingFilters } from '@/lib/validations/listings'

type Props = {
  filters: ListingFilters
}

/**
 * Price / property type / amenities, as a plain `<form method="get">` inside a
 * native `<details>` disclosure.
 *
 * Deliberately a Server Component with no JavaScript: submitting navigates to
 * `/?…`, which keeps the URL the source of truth and means the filters work
 * with JS disabled and survive a page refresh for free.
 *
 * It shows no result count on purpose — that number costs an awaited query, and
 * this panel renders in the page shell that must paint before the grid resolves.
 * The count lives with the grid, inside the Suspense boundary.
 */
export function FilterPanel({ filters }: Props) {
  const activeCount = countActive(filters)

  return (
    <details className="group rounded-md border border-hairline">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium text-ink">
          <SlidersHorizontal className="size-4" aria-hidden />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-canvas">
              {activeCount}
            </span>
          )}
        </span>
        <span className="text-sm text-muted group-open:hidden">Show</span>
        <span className="hidden text-sm text-muted group-open:inline">Hide</span>
      </summary>

      <form action="/" method="get" className="border-t border-hairline px-4 py-5">
        {/* The search bar's state rides along so applying a filter cannot wipe
            the destination, dates or guest count the user already chose. */}
        <input type="hidden" name="city" value={filters.city ?? ''} />
        <input type="hidden" name="checkIn" value={filters.checkIn ?? ''} />
        <input type="hidden" name="checkOut" value={filters.checkOut ?? ''} />
        <input type="hidden" name="guests" value={filters.guests ?? ''} />

        <div className="grid gap-6 tablet:grid-cols-2 desktop:grid-cols-3">
          <fieldset>
            <legend className="text-sm font-semibold text-ink">
              Price per night
            </legend>
            <div className="mt-3 flex items-center gap-3">
              <PriceInput
                name="minPrice"
                label="Minimum price in dollars"
                placeholder="Min"
                cents={filters.minPriceCents}
              />
              <span className="text-muted" aria-hidden>
                –
              </span>
              <PriceInput
                name="maxPrice"
                label="Maximum price in dollars"
                placeholder="Max"
                cents={filters.maxPriceCents}
              />
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="filter-type"
              className="text-sm font-semibold text-ink"
            >
              Property type
            </label>
            <select
              id="filter-type"
              name="type"
              defaultValue={filters.propertyType ?? ''}
              className="mt-3 h-12 w-full rounded-sm border border-hairline px-3 text-sm text-ink focus:border-ink focus:outline-none"
            >
              <option value="">Any type</option>
              {PROPERTY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {humanizeToken(type)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-ink">Amenities</legend>
          <p className="mt-1 text-sm text-muted">
            Stays must offer every amenity you select.
          </p>
          <div className="mt-3 grid gap-x-4 tablet:grid-cols-2 desktop:grid-cols-3">
            {AMENITIES.map((amenity) => (
              <label
                key={amenity}
                className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-body"
              >
                <input
                  type="checkbox"
                  name="amenities"
                  value={amenity}
                  defaultChecked={filters.amenities.includes(amenity)}
                  className="size-4 shrink-0 accent-primary"
                />
                {humanizeToken(amenity)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 flex items-center gap-4 border-t border-hairline pt-5">
          <button
            type="submit"
            className="h-12 rounded-sm bg-primary px-6 text-base font-medium text-on-primary hover:bg-primary-active"
          >
            Show stays
          </button>
          <Link
            href={clearFiltersHref(filters)}
            className="flex min-h-11 items-center text-sm font-medium text-ink underline"
          >
            Clear filters
          </Link>
        </div>
      </form>
    </details>
  )
}

function PriceInput({
  name,
  label,
  placeholder,
  cents,
}: {
  name: string
  label: string
  placeholder: string
  cents: number | undefined
}) {
  return (
    <label className="flex-1">
      <span className="sr-only">{label}</span>
      <div className="flex h-12 items-center rounded-sm border border-hairline px-3 focus-within:border-ink">
        <span className="text-sm text-muted" aria-hidden>
          $
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          name={name}
          placeholder={placeholder}
          // The URL carries whole dollars; cents are an internal concern.
          defaultValue={cents === undefined ? '' : Math.round(cents / 100)}
          className="w-full bg-transparent pl-1 text-sm text-ink outline-none placeholder:text-muted"
        />
      </div>
    </label>
  )
}

/**
 * Clearing the *filters* keeps the search. Someone who narrowed "Kyoto, 2
 * guests" down to a treehouse with a pool wants the treehouse and pool gone,
 * not Kyoto.
 */
function clearFiltersHref(filters: ListingFilters): string {
  const params = new URLSearchParams()

  setOrDelete(params, 'city', filters.city)
  setOrDelete(params, 'checkIn', filters.checkIn)
  setOrDelete(params, 'checkOut', filters.checkOut)
  setOrDelete(params, 'guests', filters.guests)

  return homeHref(params)
}

function countActive(filters: ListingFilters): number {
  return (
    (filters.minPriceCents === undefined ? 0 : 1) +
    (filters.maxPriceCents === undefined ? 0 : 1) +
    (filters.propertyType ? 1 : 0) +
    filters.amenities.length
  )
}
