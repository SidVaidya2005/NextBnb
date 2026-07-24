import { differenceInCalendarDays } from 'date-fns'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// The return-shape contract used across every server-action / boundary.
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

/**
 * Format an integer number of **cents** as USD. All money in NextBnb is stored
 * and computed as integer cents — this is the only place it becomes a display
 * string. e.g. formatPrice(9500) -> "$95.00".
 */
export function formatPrice(cents: number): string {
  return priceFormatter.format(cents / 100)
}

/**
 * Nights occupied by a stay, treated as half-open `[checkIn, checkOut)` so the
 * checkout day is not counted — consistent with the DB `daterange(..., '[)')`
 * exclusion constraint. e.g. Aug 1 -> Aug 5 is 4 nights.
 */
export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return differenceInCalendarDays(checkOut, checkIn)
}

/** Compose Tailwind classes conditionally (clsx) and resolve conflicts (tailwind-merge). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
