// Fixed shared values — the single source of truth. Never duplicate these
// literals inline. The DB `property_type` enum must stay in sync with
// PROPERTY_TYPES; amenity/property values stored in the DB come from here.

export const PROPERTY_TYPES = [
  'home',
  'apartment',
  'villa',
  'cabin',
  'cottage',
  'loft',
  'guesthouse',
  'tiny_home',
  'treehouse',
  'other',
] as const
export type PropertyType = (typeof PROPERTY_TYPES)[number]

export const AMENITIES = [
  'wifi',
  'kitchen',
  'washer',
  'dryer',
  'air_conditioning',
  'heating',
  'workspace',
  'tv',
  'free_parking',
  'pool',
  'hot_tub',
  'ev_charger',
  'crib',
  'gym',
  'bbq_grill',
  'breakfast',
  'fireplace',
  'smoke_alarm',
] as const
export type Amenity = (typeof AMENITIES)[number]

export const SERVICE_FEE_PCT = 0.14 // guest service fee, applied to (nights * price)
export const MAX_GUESTS = 16
export const MIN_NIGHTS_DEFAULT = 1
export const MAX_PHOTOS_PER_LISTING = 15
