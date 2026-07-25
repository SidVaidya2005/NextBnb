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

// C0 control characters plus DEL. A raw newline inside a redirect target can
// split the Location header, so they are rejected outright.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

/**
 * Sanitize a post-sign-in `next` destination into a same-origin path.
 *
 * This is an open-redirect guard, not a formatter: `next` travels through the
 * URL and back from the OAuth provider, so its value is fully attacker
 * controlled. Supabase's own sample only checks `startsWith('/')`, which still
 * admits the protocol-relative `//evil.com` — browsers read that as an absolute
 * URL and leave the site. Anything that is not a single-slash-rooted path
 * collapses to '/'.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== 'string' || raw.length === 0) return '/'
  if (!raw.startsWith('/')) return '/'
  // '//host' is protocol-relative; '/\host' is the backslash variant browsers
  // normalise to the same thing.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/'
  if (CONTROL_CHARS.test(raw)) return '/'
  return raw
}
