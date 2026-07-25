import { describe, it, expect } from 'vitest'
import {
  averageRating,
  coverPhotoOf,
  formatPrice,
  nightsBetween,
  safeNextPath,
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
