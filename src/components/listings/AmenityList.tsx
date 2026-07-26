import {
  AlarmSmoke,
  Baby,
  Bath,
  Beef,
  Car,
  Coffee,
  Dumbbell,
  Flame,
  Laptop,
  Plug,
  Snowflake,
  Thermometer,
  Tv,
  Utensils,
  WashingMachine,
  Waves,
  Wifi,
  Wind,
  type LucideIcon,
} from 'lucide-react'

import type { Amenity } from '@/lib/constants'

/**
 * Icon and label for every amenity.
 *
 * The labels are written out rather than derived through `humanizeToken`, which
 * would render `bbq_grill` as "Bbq grill" and `ev_charger` as "Ev charger" — the
 * acronyms are exactly what a mechanical transform gets wrong. Keying the map on
 * `Amenity` makes it total: adding a value to `AMENITIES` without an entry here
 * is a type error, not a blank row at runtime.
 *
 * It lives here, not in `constants.ts`, because that module is pure data
 * imported by `validations/listings.ts` — putting icon components in it would
 * pull `lucide-react` into every consumer of the constants.
 */
// Exported for the create-listing form (F09), which needs the same labels.
// These stay written out rather than derived: `humanizeToken` renders
// `bbq_grill` as "Bbq grill" and `ev_charger` as "Ev charger".
export const AMENITY_META: Record<Amenity, { icon: LucideIcon; label: string }> = {
  wifi: { icon: Wifi, label: 'Wi-Fi' },
  kitchen: { icon: Utensils, label: 'Kitchen' },
  washer: { icon: WashingMachine, label: 'Washer' },
  dryer: { icon: Wind, label: 'Dryer' },
  air_conditioning: { icon: Snowflake, label: 'Air conditioning' },
  heating: { icon: Thermometer, label: 'Heating' },
  workspace: { icon: Laptop, label: 'Dedicated workspace' },
  tv: { icon: Tv, label: 'TV' },
  free_parking: { icon: Car, label: 'Free parking' },
  pool: { icon: Waves, label: 'Pool' },
  hot_tub: { icon: Bath, label: 'Hot tub' },
  ev_charger: { icon: Plug, label: 'EV charger' },
  crib: { icon: Baby, label: 'Crib' },
  gym: { icon: Dumbbell, label: 'Gym' },
  bbq_grill: { icon: Beef, label: 'BBQ grill' },
  breakfast: { icon: Coffee, label: 'Breakfast' },
  fireplace: { icon: Flame, label: 'Fireplace' },
  smoke_alarm: { icon: AlarmSmoke, label: 'Smoke alarm' },
}

type Props = {
  amenities: Amenity[]
}

/**
 * DESIGN.md `amenity-row`: a single column of icon + ink label at 12px row
 * padding, two columns from `tablet:` so the list does not run long.
 */
export function AmenityList({ amenities }: Props) {
  if (amenities.length === 0) {
    return <p className="text-base text-body">No amenities listed for this stay.</p>
  }

  return (
    <ul className="grid grid-cols-1 tablet:grid-cols-2">
      {amenities.map((amenity) => {
        const { icon: Icon, label } = AMENITY_META[amenity]
        return (
          <li key={amenity} className="flex items-center gap-4 py-3 text-base text-ink">
            <Icon className="size-6 shrink-0 text-body" aria-hidden />
            <span>{label}</span>
          </li>
        )
      })}
    </ul>
  )
}
