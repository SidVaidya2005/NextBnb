'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'

import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/ui/DateRangePicker'
import { MAX_GUESTS } from '@/lib/constants'
import { homeHref, setOrDelete } from '@/lib/searchParams'
import { cn, formatDateRange } from '@/lib/utils'

/**
 * The DESIGN.md `search-bar-pill`: three segments (Where / When / Who) closed
 * by the Rausch `search-orb`, from `tablet:` up. Below 744px it collapses to a
 * single tappable pill that opens a full-screen overlay.
 *
 * Lives in the nav on every route and always navigates to `/?…`, so searching
 * from anywhere lands on the discovery surface.
 */
export function SearchBar() {
  // useSearchParams() suspends during prerender; the fallback is the pill's
  // resting shape so the nav never jumps.
  return (
    <Suspense fallback={<div className="h-12 tablet:w-[380px] desktop:w-[520px]" />}>
      <SearchBarWithParams />
    </Suspense>
  )
}

function SearchBarWithParams() {
  const searchParams = useSearchParams()

  // Remounting on every URL change re-seeds each field from the URL, so the
  // bar cannot drift out of sync with the results (browser back included).
  return <SearchBarFields key={searchParams.toString()} searchParams={searchParams} />
}

function SearchBarFields({ searchParams }: { searchParams: URLSearchParams }) {
  const router = useRouter()

  const [city, setCity] = useState(searchParams.get('city') ?? '')
  const [guests, setGuests] = useState(searchParams.get('guests') ?? '')
  // The picker speaks in `start`/`end` because it also serves the host's block
  // calendar; the URL contract is `checkIn`/`checkOut`. This is the one place
  // the two names meet.
  const [range, setRange] = useState<DateRangeValue>({
    start: searchParams.get('checkIn'),
    end: searchParams.get('checkOut'),
  })

  const [calendarOpen, setCalendarOpen] = useState(false)
  const [overlayOpen, setOverlayOpen] = useState(false)

  const dateLabel = formatDateRange(range.start ?? undefined, range.end ?? undefined)

  function submit() {
    const next = new URLSearchParams(searchParams)

    setOrDelete(next, 'city', city)
    setOrDelete(next, 'checkIn', range.start)
    // A lone check-in filters nothing, so it is not worth putting in the URL.
    setOrDelete(next, 'checkOut', range.start ? range.end : null)
    setOrDelete(next, 'guests', guests)

    setCalendarOpen(false)
    setOverlayOpen(false)
    router.push(homeHref(next))
  }

  function clearDates() {
    setRange({ start: null, end: null })
  }

  return (
    <>
      {/* ---- Mobile: a single pill that opens the overlay ------------------ */}
      <button
        type="button"
        onClick={() => setOverlayOpen(true)}
        // `min-w-0` is load-bearing, not tidying: a flex item defaults to
        // `min-width: auto`, so `flex-1` alone cannot shrink this below its
        // content width. It overflowed its wrapper and, because the wrapper
        // centres it, spilled equally over the logo and the account menu.
        // `px-3.5`/`gap-1.5` rather than the roomier `px-4`/`gap-2`: at 375px —
        // the most common phone width — the labels were clipped by a single
        // pixel, so 8px of chrome buys "Anywhere · Any week" in full. Narrower
        // phones still ellipsize, which is what `truncate` is there for.
        className="flex h-12 min-w-0 flex-1 items-center gap-1.5 rounded-full border border-hairline px-3.5 shadow-card tablet:hidden"
      >
        <Search className="size-4 shrink-0 text-ink" aria-hidden />
        <span className="truncate text-sm font-medium text-ink">
          {city || 'Anywhere'}
        </span>
        <span className="truncate text-sm text-muted">
          {dateLabel ?? 'Any week'}
        </span>
      </button>

      {/* ---- Tablet and up: the three-segment pill ------------------------- */}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="relative hidden h-16 items-center rounded-full border border-hairline pl-6 pr-2 shadow-card tablet:flex"
      >
        <Segment label="Where" htmlFor="search-city">
          <input
            id="search-city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="Search destinations"
            className="w-28 bg-transparent text-sm text-ink outline-none placeholder:text-muted desktop:w-36"
          />
        </Segment>

        <Divider />

        <Segment label="When">
          <button
            type="button"
            onClick={() => setCalendarOpen((open) => !open)}
            aria-expanded={calendarOpen}
            className={cn(
              'text-left text-sm',
              dateLabel ? 'text-ink' : 'text-muted',
            )}
          >
            {dateLabel ?? 'Add dates'}
          </button>
        </Segment>

        <Divider />

        <Segment label="Who" htmlFor="search-guests">
          <GuestSelect id="search-guests" value={guests} onChange={setGuests} />
        </Segment>

        <button
          type="submit"
          aria-label="Search"
          className="ml-2 flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary hover:bg-primary-active"
        >
          <Search className="size-5" aria-hidden />
        </button>

        {calendarOpen && (
          <div className="absolute left-0 top-[72px] z-50 rounded-md border border-hairline bg-canvas p-4 shadow-card">
            <DateRangePicker value={range} onChange={setRange} />
            <div className="flex justify-end gap-2 border-t border-hairline pt-3">
              <button
                type="button"
                onClick={clearDates}
                className="rounded-sm px-4 py-2.5 text-sm font-medium text-ink underline"
              >
                Clear dates
              </button>
              <button
                type="button"
                onClick={() => setCalendarOpen(false)}
                className="rounded-sm bg-ink px-4 py-2.5 text-sm font-medium text-canvas"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </form>

      {/* ---- Mobile overlay ------------------------------------------------ */}
      {overlayOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search stays"
          className="fixed inset-0 z-50 flex flex-col bg-canvas tablet:hidden"
        >
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <p className="text-base font-semibold text-ink">Search stays</p>
            <button
              type="button"
              onClick={() => setOverlayOpen(false)}
              aria-label="Close search"
              className="flex size-11 items-center justify-center rounded-full hover:bg-surface-soft"
            >
              <X className="size-5 text-ink" aria-hidden />
            </button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
            <label className="block">
              <span className="text-sm font-medium text-muted">Where</span>
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Search destinations"
                className="mt-2 h-14 w-full rounded-sm border border-hairline px-3 text-base text-ink outline-none placeholder:text-muted focus:border-ink"
              />
            </label>

            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-muted">When</span>
                {dateLabel && (
                  <button
                    type="button"
                    onClick={clearDates}
                    className="text-sm text-ink underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="mt-2 rounded-md border border-hairline p-2">
                <DateRangePicker value={range} onChange={setRange} />
              </div>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-muted">Who</span>
              <GuestSelect
                value={guests}
                onChange={setGuests}
                className="mt-2 h-14 w-full rounded-sm border border-hairline px-3 text-base"
              />
            </label>
          </div>

          <div className="border-t border-hairline px-4 py-3">
            <button
              type="button"
              onClick={submit}
              className="h-12 w-full rounded-sm bg-primary text-base font-medium text-on-primary"
            >
              Search
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Segment({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col justify-center px-2">
      <label htmlFor={htmlFor} className="text-xs font-medium text-ink">
        {label}
      </label>
      {children}
    </div>
  )
}

function Divider() {
  return <span className="h-8 w-px shrink-0 bg-hairline" aria-hidden />
}

function GuestSelect({
  id,
  value,
  onChange,
  className,
}: {
  id?: string
  value: string
  onChange: (next: string) => void
  className?: string
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Guests"
      className={cn(
        'bg-transparent text-sm outline-none',
        value ? 'text-ink' : 'text-muted',
        className,
      )}
    >
      <option value="">Add guests</option>
      {Array.from({ length: MAX_GUESTS }, (_, index) => index + 1).map((count) => (
        <option key={count} value={count}>
          {count} {count === 1 ? 'guest' : 'guests'}
        </option>
      ))}
    </select>
  )
}
