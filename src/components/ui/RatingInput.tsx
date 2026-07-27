'use client'

import { Star } from 'lucide-react'

import { cn } from '@/lib/utils'

const STARS = [1, 2, 3, 4, 5] as const

type Props = {
  /** Distinguishes this group's radios from every other one on the page. */
  name: string
  value: number | null
  onChange: (rating: number) => void
  /** The group's own label, e.g. "Rate your stay at Sunset Loft". */
  legend: string
  disabled?: boolean
}

/**
 * A one-to-five star rating input.
 *
 * **A native radio group, not five buttons.** DESIGN.md specs a star *display*
 * (`star-rating`, ink) but no star input, so the mechanism was a free choice —
 * and radios come with arrow-key navigation, a single tab stop, correct
 * `radiogroup` semantics and "3 of 5 selected" announced by screen readers, all
 * of which would otherwise be hand-rolled `role="radiogroup"` plus a roving
 * tabindex. That matters more here than usual: `progress-tracker.md` already
 * carries eight features of unaudited keyboard paths into F18, and this is the
 * cheapest possible way not to add a ninth.
 *
 * The inputs are visually hidden rather than `hidden`/`display:none`, which
 * would take them out of the tab order and defeat the point. Each `<label>` is
 * the 44px tap target `code-standards.md` floors at, so the stars are drawn
 * larger than the 14px display stars in `ReviewsSection`.
 *
 * **Ink, never gold** — DESIGN.md's `star-rating` token is `#222222`, a
 * deliberate brand choice ("yellow stars feel cheap in travel context"), and
 * Rausch is reserved for primary CTAs, the search orb and the saved heart. An
 * unselected star is `hairline`, the same pairing `ReviewsSection` uses.
 */
export function RatingInput({ name, value, onChange, legend, disabled = false }: Props) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-1.5 text-sm font-medium text-ink">{legend}</legend>

      <div className="flex items-center">
        {STARS.map((star) => {
          const id = `${name}-${star}`
          const filled = value !== null && star <= value

          return (
            <div key={star} className="relative">
              <input
                type="radio"
                id={id}
                name={name}
                value={star}
                checked={value === star}
                onChange={() => onChange(star)}
                // Visually hidden but still focusable — the label is what the
                // pointer sees and the focus ring is drawn on it below.
                className="peer absolute size-px overflow-hidden opacity-0"
              />
              <label
                htmlFor={id}
                className={cn(
                  'flex size-11 cursor-pointer items-center justify-center rounded-sm transition',
                  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink',
                  disabled && 'cursor-not-allowed',
                )}
              >
                {/* The visible label is the count, so a screen reader announces
                    "3 stars" rather than an unnamed radio; the icon is decorative. */}
                <span className="sr-only">
                  {star} {star === 1 ? 'star' : 'stars'}
                </span>
                <Star
                  className={cn(
                    'size-7',
                    filled ? 'fill-current text-ink' : 'text-hairline',
                  )}
                  aria-hidden
                />
              </label>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
