import { describe, it, expect } from 'vitest'
import {
  averageRating,
  coverPhotoOf,
  formatCapacity,
  formatDateRange,
  formatMonthYear,
  formatPrice,
  formatTimeOfDay,
  humanizeToken,
  nightsBetween,
  orderedPhotos,
  safeNextPath,
  toFavoriteCards,
  toISODate,
} from '@/lib/utils'

describe('formatPrice', () => {
  it('formats whole-dollar cents', () => {
    expect(formatPrice(9500)).toBe('$95.00')
  })

  it('formats thousands with a separator', () => {
    expect(formatPrice(123400)).toBe('$1,234.00')
  })

  it('formats zero', () => {
    expect(formatPrice(0)).toBe('$0.00')
  })

  it('formats sub-dollar cents without floating drift', () => {
    expect(formatPrice(7)).toBe('$0.07')
  })
})

describe('nightsBetween', () => {
  it('counts half-open nights [checkIn, checkOut) — checkout day excluded', () => {
    expect(
      nightsBetween(new Date('2026-08-01'), new Date('2026-08-05')),
    ).toBe(4)
  })

  it('is a single night for consecutive days', () => {
    expect(
      nightsBetween(new Date('2026-08-01'), new Date('2026-08-02')),
    ).toBe(1)
  })

  it('is zero when check-in and check-out are the same day', () => {
    expect(
      nightsBetween(new Date('2026-08-01'), new Date('2026-08-01')),
    ).toBe(0)
  })
})

describe('averageRating', () => {
  it('returns null for a listing with no reviews — the "New" signal', () => {
    expect(averageRating([])).toBeNull()
  })

  it('returns the rating itself for a single review', () => {
    expect(averageRating([4])).toBe(4)
  })

  it('averages several ratings', () => {
    expect(averageRating([5, 4, 3])).toBe(4)
  })

  it('does not round — precision is the display layer’s decision', () => {
    expect(averageRating([5, 4])).toBe(4.5)
    expect(averageRating([5, 5, 4])).toBeCloseTo(4.6667, 4)
  })

  it('never returns 0 for an empty set, since 0 is not a valid rating', () => {
    expect(averageRating([])).not.toBe(0)
  })
})

describe('coverPhotoOf', () => {
  const photo = (position: number, is_cover: boolean) => ({
    position,
    is_cover,
    url: `photo-${position}`,
  })

  it('returns null when the listing has no photos', () => {
    expect(coverPhotoOf([])).toBeNull()
  })

  it('prefers the photo flagged is_cover, wherever it sits in the array', () => {
    const photos = [photo(0, false), photo(1, true), photo(2, false)]
    expect(coverPhotoOf(photos)?.url).toBe('photo-1')
  })

  it('falls back to the lowest position when no photo is flagged', () => {
    const photos = [photo(3, false), photo(1, false), photo(2, false)]
    expect(coverPhotoOf(photos)?.url).toBe('photo-1')
  })

  it('returns the only photo when there is exactly one, flagged or not', () => {
    expect(coverPhotoOf([photo(7, false)])?.url).toBe('photo-7')
  })
})

describe('orderedPhotos', () => {
  const photo = (position: number, is_cover: boolean) => ({
    position,
    is_cover,
    url: `photo-${position}`,
  })

  const urls = (photos: { url: string }[]) => photos.map((p) => p.url)

  it('returns an empty array for a listing with no photos', () => {
    expect(orderedPhotos([])).toEqual([])
  })

  it('leads with the cover, then orders the rest by position', () => {
    const photos = [photo(1, false), photo(3, true), photo(0, false), photo(2, false)]
    expect(urls(orderedPhotos(photos))).toEqual([
      'photo-3',
      'photo-0',
      'photo-1',
      'photo-2',
    ])
  })

  it('orders purely by position when no photo is flagged as cover', () => {
    const photos = [photo(4, false), photo(1, false), photo(2, false)]
    expect(urls(orderedPhotos(photos))).toEqual(['photo-1', 'photo-2', 'photo-4'])
  })

  it('does not mutate the array it was given', () => {
    const photos = [photo(2, false), photo(0, true)]
    orderedPhotos(photos)
    expect(urls(photos)).toEqual(['photo-2', 'photo-0'])
  })

  it('agrees with coverPhotoOf on which photo leads — flagged or not', () => {
    const flagged = [photo(0, false), photo(2, true), photo(1, false)]
    expect(orderedPhotos(flagged)[0]).toBe(coverPhotoOf(flagged))

    const unflagged = [photo(3, false), photo(1, false), photo(2, false)]
    expect(orderedPhotos(unflagged)[0]).toBe(coverPhotoOf(unflagged))
  })
})

describe('formatCapacity', () => {
  it('renders the full line with plurals', () => {
    expect(
      formatCapacity({ maxGuests: 5, bedrooms: 2, beds: 3, bathrooms: 2 }),
    ).toBe('5 guests · 2 bedrooms · 3 beds · 2 baths')
  })

  it('uses singular forms for a count of one', () => {
    expect(
      formatCapacity({ maxGuests: 1, bedrooms: 1, beds: 1, bathrooms: 1 }),
    ).toBe('1 guest · 1 bedroom · 1 bed · 1 bath')
  })

  it('renders zero bedrooms as "Studio", not "0 bedrooms"', () => {
    expect(
      formatCapacity({ maxGuests: 2, bedrooms: 0, beds: 1, bathrooms: 1 }),
    ).toBe('2 guests · Studio · 1 bed · 1 bath')
  })

  it('pluralizes a half bath — numeric(3,1) makes 1.5 a real value', () => {
    expect(
      formatCapacity({ maxGuests: 4, bedrooms: 2, beds: 2, bathrooms: 1.5 }),
    ).toBe('4 guests · 2 bedrooms · 2 beds · 1.5 baths')
  })

  it('renders a whole numeric bathroom count without a trailing decimal', () => {
    expect(
      formatCapacity({ maxGuests: 2, bedrooms: 1, beds: 1, bathrooms: 1.0 }),
    ).toContain('1 bath')
  })
})

describe('formatTimeOfDay', () => {
  it('converts a 24-hour column value to a 12-hour label', () => {
    expect(formatTimeOfDay('15:00')).toBe('3:00 PM')
    expect(formatTimeOfDay('10:00')).toBe('10:00 AM')
    expect(formatTimeOfDay('16:30')).toBe('4:30 PM')
  })

  it('renders both midnights as 12, not 0', () => {
    expect(formatTimeOfDay('00:00')).toBe('12:00 AM')
    expect(formatTimeOfDay('12:00')).toBe('12:00 PM')
  })

  it('returns null for null or empty, so the caller omits the row', () => {
    expect(formatTimeOfDay(null)).toBeNull()
    expect(formatTimeOfDay('')).toBeNull()
  })

  it('returns null rather than throwing on a malformed text column', () => {
    // These are `text` columns, not `time` — the database guarantees nothing.
    expect(formatTimeOfDay('afternoon')).toBeNull()
    expect(formatTimeOfDay('25:00')).toBeNull()
    expect(formatTimeOfDay('12:75')).toBeNull()
    expect(formatTimeOfDay('3pm')).toBeNull()
  })
})

describe('formatMonthYear', () => {
  it('renders a timestamptz as a month and year', () => {
    expect(formatMonthYear('2025-03-14T09:26:53.000Z')).toBe('March 2025')
  })

  it('accepts a plain date string', () => {
    expect(formatMonthYear('2026-01-09')).toBe('January 2026')
  })

  it('returns null for an unparseable value instead of throwing', () => {
    expect(formatMonthYear('not-a-date')).toBeNull()
    expect(formatMonthYear('')).toBeNull()
  })
})

describe('safeNextPath', () => {
  it('passes a plain rooted path through', () => {
    expect(safeNextPath('/trips')).toBe('/trips')
  })

  it('preserves nested paths and query strings', () => {
    expect(safeNextPath('/host/listings?status=draft')).toBe(
      '/host/listings?status=draft',
    )
  })

  it('rejects a protocol-relative URL — the open redirect a naive startsWith("/") lets through', () => {
    expect(safeNextPath('//evil.com')).toBe('/')
  })

  it('rejects the backslash variant of a protocol-relative URL', () => {
    expect(safeNextPath('/\\evil.com')).toBe('/')
  })

  it('rejects an absolute URL', () => {
    expect(safeNextPath('https://evil.com/steal')).toBe('/')
  })

  it('rejects a control character that could split the Location header', () => {
    expect(safeNextPath('/trips\nLocation: https://evil.com')).toBe('/')
  })

  it('falls back to root for null, undefined, and empty input', () => {
    expect(safeNextPath(null)).toBe('/')
    expect(safeNextPath(undefined)).toBe('/')
    expect(safeNextPath('')).toBe('/')
  })
})

describe('toISODate', () => {
  it('renders a local calendar date, not a UTC instant', () => {
    // Constructed with local-time components, so the ISO date must match them
    // regardless of the machine's zone — a UTC-based format would shift.
    expect(toISODate(new Date(2026, 7, 5))).toBe('2026-08-05')
  })

  it('zero-pads month and day so string order is chronological order', () => {
    expect(toISODate(new Date(2026, 0, 9))).toBe('2026-01-09')
    expect('2026-01-09' < '2026-01-10').toBe(true)
  })
})

describe('formatDateRange', () => {
  it('collapses the month when both ends share one', () => {
    expect(formatDateRange('2026-08-05', '2026-08-09')).toBe('Aug 5 – 9')
  })

  it('keeps both months when the range crosses one', () => {
    expect(formatDateRange('2026-08-28', '2026-09-02')).toBe('Aug 28 – Sep 2')
  })

  it('returns null for an incomplete range so the caller can show a placeholder', () => {
    expect(formatDateRange('2026-08-05', undefined)).toBeNull()
    expect(formatDateRange(undefined, '2026-08-09')).toBeNull()
    expect(formatDateRange(undefined, undefined)).toBeNull()
  })
})

describe('humanizeToken', () => {
  it('renders a snake_case constant as a label', () => {
    expect(humanizeToken('tiny_home')).toBe('Tiny home')
    expect(humanizeToken('air_conditioning')).toBe('Air conditioning')
  })

  it('leaves a single word capitalized', () => {
    expect(humanizeToken('pool')).toBe('Pool')
  })
})

describe('toFavoriteCards', () => {
  const identity = <T,>(listing: T) => listing

  it('returns nothing for no favorites', () => {
    expect(toFavoriteCards([], identity)).toEqual([])
  })

  it('unwraps the embedded listing from each row', () => {
    expect(
      toFavoriteCards(
        [{ listings: { id: 'a' } }, { listings: { id: 'b' } }],
        identity,
      ),
    ).toEqual([{ id: 'a' }, { id: 'b' }])
  })

  it('drops a row whose listing RLS hid, and keeps the rest', () => {
    // The case the type system cannot warn about: listing_id is NOT NULL, so
    // the embed is typed as always-present, but an unpublished listing comes
    // back null to anyone who is not its host.
    expect(
      toFavoriteCards(
        [{ listings: { id: 'a' } }, { listings: null }, { listings: { id: 'c' } }],
        identity,
      ),
    ).toEqual([{ id: 'a' }, { id: 'c' }])
  })

  it('preserves the order the query returned', () => {
    expect(
      toFavoriteCards(
        [{ listings: { id: 'newest' } }, { listings: { id: 'oldest' } }],
        (listing) => listing.id,
      ),
    ).toEqual(['newest', 'oldest'])
  })

  it('applies the mapper to every surviving listing', () => {
    expect(
      toFavoriteCards(
        [{ listings: { id: 'a' } }, { listings: null }],
        (listing) => `card:${listing.id}`,
      ),
    ).toEqual(['card:a'])
  })
})
