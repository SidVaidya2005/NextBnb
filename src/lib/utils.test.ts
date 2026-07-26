import { describe, it, expect } from 'vitest'
import {
  averageRating,
  blocksListingDeletion,
  bookedNightsRange,
  canCancelBooking,
  coverPhotoOf,
  findBlockConflict,
  formatCapacity,
  formatDateRange,
  formatInclusiveRange,
  formatMonthYear,
  formatPrice,
  formatTimeOfDay,
  hostEarnings,
  humanizeToken,
  nextPhotoPosition,
  nightsBetween,
  orderedPhotos,
  priceBreakdown,
  rangesOverlap,
  reorderedPositions,
  safeNextPath,
  toFavoriteCards,
  toISODate,
  tripSection,
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

describe('nextPhotoPosition', () => {
  it('starts at 0 for the first photo', () => {
    expect(nextPhotoPosition([])).toBe(0)
  })

  it('appends past the highest position, not the count', () => {
    // A delete leaves a gap, so length is not a safe next index — it would
    // collide with an existing row.
    expect(nextPhotoPosition([{ position: 0 }, { position: 4 }])).toBe(5)
  })

  it('is unaffected by the order rows arrive in', () => {
    expect(nextPhotoPosition([{ position: 7 }, { position: 2 }])).toBe(8)
  })
})

describe('reorderedPositions', () => {
  const photo = (id: string, position: number, is_cover = false) => ({
    id,
    position,
    is_cover,
  })

  // Cover first, then ascending position — the order orderedPhotos produces
  // and therefore the order the host sees.
  const strip = [
    photo('a', 0, true),
    photo('b', 1),
    photo('c', 2),
    photo('d', 3),
  ]

  it('moves a photo one step earlier', () => {
    expect(reorderedPositions(strip, 'c', 'earlier')).toEqual([
      { id: 'a', position: 0 },
      { id: 'c', position: 1 },
      { id: 'b', position: 2 },
      { id: 'd', position: 3 },
    ])
  })

  it('moves a photo one step later', () => {
    expect(reorderedPositions(strip, 'b', 'later')).toEqual([
      { id: 'a', position: 0 },
      { id: 'c', position: 1 },
      { id: 'b', position: 2 },
      { id: 'd', position: 3 },
    ])
  })

  it('moves a photo to the front for "Make cover"', () => {
    expect(reorderedPositions(strip, 'd', 'front')).toEqual([
      { id: 'd', position: 0 },
      { id: 'a', position: 1 },
      { id: 'b', position: 2 },
      { id: 'c', position: 3 },
    ])
  })

  it('returns null at the ends rather than a no-op write', () => {
    expect(reorderedPositions(strip, 'a', 'earlier')).toBeNull()
    expect(reorderedPositions(strip, 'd', 'later')).toBeNull()
    expect(reorderedPositions(strip, 'a', 'front')).toBeNull()
  })

  it('returns null for a photo that is not in the list', () => {
    expect(reorderedPositions(strip, 'missing', 'earlier')).toBeNull()
  })

  it('heals gaps and duplicate positions by renumbering everything', () => {
    // Nothing in the schema forbids two rows sharing a position, and a delete
    // leaves a gap. A swap built on `position - 1` would compound both.
    const messy = [photo('x', 5), photo('y', 5), photo('z', 9)]

    expect(reorderedPositions(messy, 'z', 'earlier')).toEqual([
      { id: 'x', position: 0 },
      { id: 'z', position: 1 },
      { id: 'y', position: 2 },
    ])
  })

  it('reads gallery order, not raw position', () => {
    // `p` holds the LOWEST position but is not first on screen: orderedPhotos
    // floats the cover `q` ahead of it. So "earlier" is a legal move for `p`
    // even though its position is already 0, and it is `q` that cannot move up.
    // Renumbering afterwards is what stops the two orders drifting again.
    const coverInMiddle = [photo('p', 0), photo('q', 1, true), photo('r', 2)]

    expect(reorderedPositions(coverInMiddle, 'q', 'earlier')).toBeNull()
    expect(reorderedPositions(coverInMiddle, 'p', 'earlier')).toEqual([
      { id: 'p', position: 0 },
      { id: 'q', position: 1 },
      { id: 'r', position: 2 },
    ])
    expect(reorderedPositions(coverInMiddle, 'p', 'later')).toEqual([
      { id: 'q', position: 0 },
      { id: 'r', position: 1 },
      { id: 'p', position: 2 },
    ])
  })

  it('leaves a single photo alone in every direction', () => {
    const one = [photo('solo', 0, true)]

    expect(reorderedPositions(one, 'solo', 'earlier')).toBeNull()
    expect(reorderedPositions(one, 'solo', 'later')).toBeNull()
    expect(reorderedPositions(one, 'solo', 'front')).toBeNull()
  })

  it('does not mutate the array it was given', () => {
    const original = [...strip]
    reorderedPositions(strip, 'd', 'front')

    expect(strip).toEqual(original)
  })
})

describe('blocksListingDeletion', () => {
  // Fixed so the assertions describe the rule rather than the day they run.
  const TODAY = new Date('2026-07-26T12:00:00')

  const booking = (status: string, check_out: string) => ({ status, check_out })

  it('does not block a listing nobody has booked', () => {
    expect(blocksListingDeletion([], TODAY)).toBe(false)
  })

  it('blocks a confirmed stay that has not happened yet', () => {
    expect(blocksListingDeletion([booking('confirmed', '2026-08-10')], TODAY)).toBe(
      true,
    )
  })

  it('does not block a stay that finished long ago', () => {
    expect(blocksListingDeletion([booking('confirmed', '2026-06-01')], TODAY)).toBe(
      false,
    )
  })

  it('does not block a cancelled stay, however far in the future', () => {
    // A cancelled booking frees its dates and holds nobody's plans — the same
    // rule the exclusion constraint applies.
    expect(blocksListingDeletion([booking('cancelled', '2026-12-25')], TODAY)).toBe(
      false,
    )
  })

  it('still blocks a stay that checked out yesterday', () => {
    // The deliberate one-day widening: the comparison happens in JS against a
    // `date` column, so around midnight "today" can sit either side of the
    // database's current_date. Erring here refuses a delete; erring the other
    // way erases a stay that is still in progress.
    expect(blocksListingDeletion([booking('confirmed', '2026-07-25')], TODAY)).toBe(
      true,
    )
  })

  it('stops blocking two days out', () => {
    expect(blocksListingDeletion([booking('confirmed', '2026-07-24')], TODAY)).toBe(
      false,
    )
  })

  it('blocks on any one upcoming stay among many that do not', () => {
    expect(
      blocksListingDeletion(
        [
          booking('confirmed', '2026-01-05'),
          booking('cancelled', '2026-09-09'),
          booking('confirmed', '2026-08-30'),
        ],
        TODAY,
      ),
    ).toBe(true)
  })

  it('does not block when every stay is past or cancelled', () => {
    expect(
      blocksListingDeletion(
        [booking('confirmed', '2026-01-05'), booking('cancelled', '2026-09-09')],
        TODAY,
      ),
    ).toBe(false)
  })
})

// The four temporal states seed.sql deliberately covers, pinned to a fixed
// "today" so the assertions describe the rule rather than the day they run.
// See supabase/seed.sql — 8 past-confirmed, 5 upcoming, 1 in-progress, 2 cancelled.
const TRIP_TODAY = new Date('2026-07-26T12:00:00')

const trip = (status: string, check_in: string, check_out: string) => ({
  status,
  check_in,
  check_out,
})

const PAST_CONFIRMED = trip('confirmed', '2026-06-01', '2026-06-05')
const UPCOMING = trip('confirmed', '2026-08-07', '2026-08-12')
const IN_PROGRESS = trip('confirmed', '2026-07-24', '2026-07-29')
const CANCELLED_FUTURE = trip('cancelled', '2026-08-12', '2026-08-16')

describe('tripSection', () => {
  it('files a stay that has not happened yet under upcoming', () => {
    expect(tripSection(UPCOMING, TRIP_TODAY)).toBe('upcoming')
  })

  it('files a finished stay under past', () => {
    expect(tripSection(PAST_CONFIRMED, TRIP_TODAY)).toBe('past')
  })

  it('files a stay the guest is currently on under upcoming', () => {
    // Not "past": the guest is physically there. It is not cancellable either,
    // which is canCancelBooking's job, not this one's.
    expect(tripSection(IN_PROGRESS, TRIP_TODAY)).toBe('upcoming')
  })

  it('files a cancelled stay under past however far in the future', () => {
    // "Upcoming" means still going to happen. A cancelled booking is not.
    expect(tripSection(CANCELLED_FUTURE, TRIP_TODAY)).toBe('past')
  })

  it('keeps a stay checking out today in upcoming', () => {
    // check_out is the half-open end — the guest is still leaving.
    expect(
      tripSection(trip('confirmed', '2026-07-20', '2026-07-26'), TRIP_TODAY),
    ).toBe('upcoming')
  })

  it('moves a stay that checked out yesterday to past', () => {
    expect(
      tripSection(trip('confirmed', '2026-07-20', '2026-07-25'), TRIP_TODAY),
    ).toBe('past')
  })
})

describe('canCancelBooking', () => {
  it('allows cancelling a stay that has not started', () => {
    expect(canCancelBooking(UPCOMING, TRIP_TODAY)).toBe(true)
  })

  it('refuses a stay already in progress', () => {
    // bookings_update_cancel_own_or_admin requires check_in >= current_date, so
    // the database would refuse this write regardless of what the UI offered.
    expect(canCancelBooking(IN_PROGRESS, TRIP_TODAY)).toBe(false)
  })

  it('refuses a finished stay', () => {
    expect(canCancelBooking(PAST_CONFIRMED, TRIP_TODAY)).toBe(false)
  })

  it('refuses an already-cancelled booking', () => {
    // The policy's USING clause also requires status = 'confirmed', which is
    // what makes a cancellation un-reversible.
    expect(canCancelBooking(CANCELLED_FUTURE, TRIP_TODAY)).toBe(false)
  })

  it('allows cancelling on the check-in day itself', () => {
    // The policy boundary is `check_in >= current_date`, inclusive. Matching it
    // exactly is the point — see the note on not widening this cutoff.
    expect(
      canCancelBooking(trip('confirmed', '2026-07-26', '2026-07-30'), TRIP_TODAY),
    ).toBe(true)
  })

  it('refuses one day past check-in', () => {
    expect(
      canCancelBooking(trip('confirmed', '2026-07-25', '2026-07-30'), TRIP_TODAY),
    ).toBe(false)
  })

  it('agrees with tripSection that an in-progress stay is upcoming but locked', () => {
    // The pair the /trips card renders: in the upcoming list, no cancel control.
    expect(tripSection(IN_PROGRESS, TRIP_TODAY)).toBe('upcoming')
    expect(canCancelBooking(IN_PROGRESS, TRIP_TODAY)).toBe(false)
  })
})

describe('bookedNightsRange', () => {
  it('drops the checkout day — a stay occupies [check_in, check_out)', () => {
    // Aug 5 -> Aug 10 is four nights: the 5th, 6th, 7th and 8th... and the 9th.
    // The 10th is the day the guest leaves, and another guest may check in on it.
    expect(bookedNightsRange({ check_in: '2026-08-05', check_out: '2026-08-10' })).toEqual({
      start: '2026-08-05',
      end: '2026-08-09',
    })
  })

  it('renders a single-night stay as one occupied day', () => {
    expect(bookedNightsRange({ check_in: '2026-08-05', check_out: '2026-08-06' })).toEqual({
      start: '2026-08-05',
      end: '2026-08-05',
    })
  })

  it('crosses a month boundary', () => {
    expect(bookedNightsRange({ check_in: '2026-07-31', check_out: '2026-08-02' })).toEqual({
      start: '2026-07-31',
      end: '2026-08-01',
    })
  })

  it('crosses a year boundary', () => {
    expect(bookedNightsRange({ check_in: '2026-12-31', check_out: '2027-01-02' })).toEqual({
      start: '2026-12-31',
      end: '2027-01-01',
    })
  })
})

describe('rangesOverlap', () => {
  const august = (start: string, end: string) => ({
    start: `2026-08-${start}`,
    end: `2026-08-${end}`,
  })

  it('is true for identical ranges', () => {
    expect(rangesOverlap(august('05', '09'), august('05', '09'))).toBe(true)
  })

  it('is false for ranges that do not touch', () => {
    expect(rangesOverlap(august('05', '09'), august('15', '19'))).toBe(false)
  })

  it('is true when they share a single day', () => {
    expect(rangesOverlap(august('05', '09'), august('09', '12'))).toBe(true)
  })

  it('is false for adjacent ranges — both ends are inclusive, so end + 1 is free', () => {
    expect(rangesOverlap(august('05', '09'), august('10', '12'))).toBe(false)
  })

  it('is true when one range contains the other', () => {
    expect(rangesOverlap(august('01', '31'), august('14', '15'))).toBe(true)
  })

  it('is symmetric — argument order cannot change the answer', () => {
    const a = august('05', '09')
    const b = august('08', '12')
    expect(rangesOverlap(a, b)).toBe(rangesOverlap(b, a))
  })

  it('catches a one-day range sitting inside a longer one', () => {
    expect(rangesOverlap(august('07', '07'), august('05', '09'))).toBe(true)
  })

  it('compares across months, since the format sorts chronologically', () => {
    expect(
      rangesOverlap(
        { start: '2026-07-28', end: '2026-08-02' },
        { start: '2026-08-01', end: '2026-08-03' },
      ),
    ).toBe(true)
  })
})

describe('findBlockConflict', () => {
  const NOTHING_OCCUPIED = { booked: [], blocked: [] }

  it('accepts a range with nothing in its way', () => {
    expect(
      findBlockConflict({ start: '2026-08-05', end: '2026-08-09' }, NOTHING_OCCUPIED),
    ).toBeNull()
  })

  it('names a confirmed reservation when the range hits one', () => {
    expect(
      findBlockConflict(
        { start: '2026-08-07', end: '2026-08-12' },
        { booked: [{ start: '2026-08-05', end: '2026-08-09' }], blocked: [] },
      ),
    ).toBe('booking')
  })

  it('names an existing block when the range hits one', () => {
    expect(
      findBlockConflict(
        { start: '2026-08-20', end: '2026-08-25' },
        { booked: [], blocked: [{ start: '2026-08-18', end: '2026-08-23' }] },
      ),
    ).toBe('block')
  })

  it('reports the reservation first when the range hits both', () => {
    // The host can remove their own block; they cannot remove someone's stay,
    // so that is the more useful half of the answer.
    expect(
      findBlockConflict(
        { start: '2026-08-01', end: '2026-08-31' },
        {
          booked: [{ start: '2026-08-05', end: '2026-08-09' }],
          blocked: [{ start: '2026-08-18', end: '2026-08-23' }],
        },
      ),
    ).toBe('booking')
  })

  it('accepts a block starting on a booking’s checkout day', () => {
    // The half-open proof, in the shape this feature meets it: the stay runs
    // Aug 5 -> Aug 10, so its occupied nights end on the 9th and the 10th is
    // free. Blocking from the 10th must be allowed, exactly as the exclusion
    // constraint allows a same-day turnover.
    const stay = bookedNightsRange({ check_in: '2026-08-05', check_out: '2026-08-10' })
    expect(
      findBlockConflict({ start: '2026-08-10', end: '2026-08-14' }, { booked: [stay], blocked: [] }),
    ).toBeNull()
  })

  it('refuses a block ending on a booking’s first night', () => {
    const stay = bookedNightsRange({ check_in: '2026-08-05', check_out: '2026-08-10' })
    expect(
      findBlockConflict({ start: '2026-08-01', end: '2026-08-05' }, { booked: [stay], blocked: [] }),
    ).toBe('booking')
  })

  it('accepts a block ending the day before an existing block starts', () => {
    expect(
      findBlockConflict(
        { start: '2026-08-14', end: '2026-08-17' },
        { booked: [], blocked: [{ start: '2026-08-18', end: '2026-08-23' }] },
      ),
    ).toBeNull()
  })

  it('accepts a one-day block on a free day between two occupied spans', () => {
    expect(
      findBlockConflict(
        { start: '2026-08-10', end: '2026-08-10' },
        {
          booked: [{ start: '2026-08-05', end: '2026-08-09' }],
          blocked: [{ start: '2026-08-11', end: '2026-08-12' }],
        },
      ),
    ).toBeNull()
  })

  it('checks every occupied span, not just the first', () => {
    expect(
      findBlockConflict(
        { start: '2026-09-01', end: '2026-09-03' },
        {
          booked: [],
          blocked: [
            { start: '2026-08-01', end: '2026-08-02' },
            { start: '2026-08-18', end: '2026-08-23' },
            { start: '2026-09-02', end: '2026-09-04' },
          ],
        },
      ),
    ).toBe('block')
  })
})

describe('formatInclusiveRange', () => {
  it('renders a multi-day block, collapsing a shared month', () => {
    expect(formatInclusiveRange({ start: '2026-08-18', end: '2026-08-23' })).toBe(
      'Aug 18 – 23',
    )
  })

  it('collapses a one-day block to a single date', () => {
    // "Aug 18 – 18" is what formatDateRange would produce. A stay can never be
    // one day, so only the inclusive model has to answer for this.
    expect(formatInclusiveRange({ start: '2026-08-18', end: '2026-08-18' })).toBe(
      'Aug 18',
    )
  })

  it('keeps both months when the block crosses one', () => {
    expect(formatInclusiveRange({ start: '2026-07-31', end: '2026-08-02' })).toBe(
      'Jul 31 – Aug 2',
    )
  })

  it('keeps both months when the block crosses a year', () => {
    expect(formatInclusiveRange({ start: '2026-12-30', end: '2027-01-02' })).toBe(
      'Dec 30 – Jan 2',
    )
  })
})

describe('priceBreakdown', () => {
  it('computes a real stay in whole cents', () => {
    // Seed listing 1: $145.00/night, $35.00 cleaning, 5 nights.
    expect(priceBreakdown({ nights: 5, pricePerNight: 14_500, cleaningFee: 3_500 })).toEqual({
      subtotal: 72_500,
      cleaningFee: 3_500,
      serviceFee: 10_150,
      total: 86_150,
    })
  })

  it('rounds the service fee half-UP, not down', () => {
    // 25 cents of subtotal puts the fee at exactly 3.5 cents. Half-down or a
    // truncation would return 3, which is the whole point of asserting it —
    // architecture.md specifies half-up.
    expect(priceBreakdown({ nights: 1, pricePerNight: 25, cleaningFee: 0 })).toMatchObject({
      serviceFee: 4,
      total: 29,
    })
  })

  it('rounds a fractional fee up rather than truncating it', () => {
    // 99999 x 0.14 = 13999.86. Truncation gives 13999 and would leave the guest
    // charged a cent less than the fee they were quoted.
    expect(
      priceBreakdown({ nights: 3, pricePerNight: 33_333, cleaningFee: 1_200 }),
    ).toMatchObject({ serviceFee: 14_000, total: 115_199 })
  })

  it('handles a listing that charges no cleaning fee', () => {
    // Two of the seeded listings have cleaning_fee = 0, so this is real data.
    expect(priceBreakdown({ nights: 2, pricePerNight: 4_500, cleaningFee: 0 })).toEqual({
      subtotal: 9_000,
      cleaningFee: 0,
      serviceFee: 1_260,
      total: 10_260,
    })
  })

  it('always reports a total that is the sum of its own parts', () => {
    // The breakdown is rendered as four lines; if the total were computed any
    // other way the guest could read a list that does not add up.
    for (const nights of [1, 2, 3, 7, 30]) {
      for (const pricePerNight of [4_500, 12_300, 14_500, 33_333, 62_000]) {
        const parts = priceBreakdown({ nights, pricePerNight, cleaningFee: 3_500 })
        expect(parts.total).toBe(parts.subtotal + parts.cleaningFee + parts.serviceFee)
        expect(Number.isInteger(parts.serviceFee)).toBe(true)
        expect(Number.isInteger(parts.total)).toBe(true)
      }
    }
  })
})

describe('hostEarnings', () => {
  it('takes the service fee off the guest total', () => {
    // Seed listing 1 again: $145.00/night, $35.00 cleaning, 5 nights. The guest
    // pays $861.50; $101.50 of that is the platform's, so the host keeps $760.00.
    expect(hostEarnings({ total: 86_150, serviceFee: 10_150 })).toBe(76_000)
  })

  it('is exactly subtotal + cleaning fee, whatever the numbers', () => {
    // The load-bearing property: the host keeps the nights and the cleaning fee
    // and nothing else. Asserted against priceBreakdown rather than restated, so
    // the two can never drift into disagreeing about what the fee is taken from.
    for (const nights of [1, 2, 3, 7, 30]) {
      for (const pricePerNight of [4_500, 12_300, 14_500, 33_333, 62_000]) {
        for (const cleaningFee of [0, 1_200, 3_500]) {
          const parts = priceBreakdown({ nights, pricePerNight, cleaningFee })
          expect(hostEarnings({ total: parts.total, serviceFee: parts.serviceFee })).toBe(
            parts.subtotal + parts.cleaningFee,
          )
        }
      }
    }
  })

  it('keeps the whole total when the listing charges no service fee', () => {
    // Not reachable through createBooking (SERVICE_FEE_PCT is fixed at 14%), but
    // service_fee is its own stored column and a zero there must not be special.
    expect(hostEarnings({ total: 9_000, serviceFee: 0 })).toBe(9_000)
  })

  it('includes a cleaning fee the guest paid on top of the nights', () => {
    const withCleaning = priceBreakdown({ nights: 2, pricePerNight: 4_500, cleaningFee: 3_500 })
    const withoutCleaning = priceBreakdown({ nights: 2, pricePerNight: 4_500, cleaningFee: 0 })

    expect(
      hostEarnings({ total: withCleaning.total, serviceFee: withCleaning.serviceFee }) -
        hostEarnings({ total: withoutCleaning.total, serviceFee: withoutCleaning.serviceFee }),
    ).toBe(3_500)
  })

  it('returns whole cents', () => {
    // No division anywhere in this helper, so this can only fail if a caller ever
    // hands it a non-integer — which the DB's int columns make impossible today.
    expect(Number.isInteger(hostEarnings({ total: 86_150, serviceFee: 10_150 }))).toBe(true)
  })
})
