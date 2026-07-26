'use client'

import { useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn, toISODate, todayISO } from '@/lib/utils'

/** An occupied span, both ends inclusive. F06 passed none; F11 fills these from
 *  a listing's confirmed bookings and host blocks, and F12 will do the same for
 *  guests once a public per-listing availability function exists. */
export type UnavailableRange = { start: string; end: string }

/** A selected span. Deliberately not `checkIn`/`checkOut`: this primitive serves
 *  a guest picking a stay *and* a host picking nights to block, and only the
 *  caller knows which. */
export type DateRangeValue = { start: string | null; end: string | null }

/**
 * Which end-day convention the selection follows — the **only** thing that
 * differs between the two callers.
 *
 * - `'half-open'` — `[start, end)`, a stay. The end day is the day the guest
 *   leaves: it is not occupied, so a range may end on an unavailable day and a
 *   zero-night selection is meaningless.
 * - `'inclusive'` — `[start, end]`, a `blocked_dates` row. Both ends are
 *   occupied, so the end day must be free too, and a single day is a valid range.
 *
 * Named for the range model rather than for the caller (`'stay' | 'block'`)
 * because `components/ui/` holds presentational primitives with no business
 * rules — this component must not know what a "block" is.
 */
export type RangeBounds = 'half-open' | 'inclusive'

type Props = {
  value: DateRangeValue
  onChange: (next: DateRangeValue) => void
  unavailableRanges?: readonly UnavailableRange[]
  bounds?: RangeBounds
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const

/**
 * DESIGN.md `date-picker-day`: 40x40 circular cells, ink fill for the selected
 * endpoints, a `surface-soft` lozenge connecting the range.
 *
 * One month on mobile, two from `desktop:` — the second panel is dropped rather
 * than reflowed. Rendered only while its popover is open, so "today" is always
 * computed on the client and can never disagree with a server-rendered value.
 */
export function DateRangePicker({
  value,
  onChange,
  unavailableRanges = [],
  bounds = 'half-open',
}: Props) {
  const [firstMonth, setFirstMonth] = useState(() =>
    startOfMonth(value.start ? parseISO(value.start) : new Date()),
  )

  const today = todayISO()

  function isUnavailable(iso: string): boolean {
    return unavailableRanges.some((range) => iso >= range.start && iso <= range.end)
  }

  function isSelectable(iso: string): boolean {
    return iso >= today && !isUnavailable(iso)
  }

  function handleSelect(iso: string) {
    const { start, end } = value

    // No start yet, or a completed range: begin again.
    if (!start || end !== null) {
      onChange({ start: iso, end: null })
      return
    }

    // A click ON the start is where the two conventions part company. Half-open:
    // restart, because a stay that checks out the day it checks in is zero
    // nights. Inclusive: fall through and complete a one-day range, because a
    // single blocked night is an ordinary block (`end_date >= start_date` is the
    // table's own constraint).
    const restartsRange = bounds === 'inclusive' ? iso < start : iso <= start
    if (restartsRange) {
      onChange({ start: iso, end: null })
      return
    }

    // A range may not straddle an unavailable day — restart there instead of
    // silently proposing something that cannot be saved.
    const straddles = eachDayOfInterval({
      start: parseISO(start),
      end: parseISO(iso),
    }).some((day) => {
      const dayIso = toISODate(day)
      // Half-open ranges do not occupy their end day, so an unavailable day is
      // allowed to sit there. Inclusive ranges do occupy it, so it must be free.
      if (bounds === 'half-open' && dayIso === iso) return false
      return isUnavailable(dayIso)
    })

    if (straddles) {
      onChange({ start: iso, end: null })
      return
    }

    onChange({ start, end: iso })
  }

  return (
    <div>
      <div className="flex items-center justify-between px-2 pb-2">
        <MonthNavButton
          label="Previous month"
          disabled={isSameMonth(firstMonth, parseISO(today))}
          onClick={() => setFirstMonth(subMonths(firstMonth, 1))}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </MonthNavButton>
        <MonthNavButton
          label="Next month"
          onClick={() => setFirstMonth(addMonths(firstMonth, 1))}
        >
          <ChevronRight className="size-4" aria-hidden />
        </MonthNavButton>
      </div>

      <div className="flex gap-8">
        <MonthPanel
          month={firstMonth}
          value={value}
          isSelectable={isSelectable}
          onSelect={handleSelect}
        />
        {/* Second month is dropped below desktop rather than reflowed. */}
        <div className="hidden desktop:block">
          <MonthPanel
            month={addMonths(firstMonth, 1)}
            value={value}
            isSelectable={isSelectable}
            onSelect={handleSelect}
          />
        </div>
      </div>
    </div>
  )
}

function MonthNavButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface-soft disabled:text-muted-soft disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

function MonthPanel({
  month,
  value,
  isSelectable,
  onSelect,
}: {
  month: Date
  value: DateRangeValue
  isSelectable: (iso: string) => boolean
  onSelect: (iso: string) => void
}) {
  // Whole weeks, so every row has seven cells and the grid never jumps.
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  })

  return (
    <div className="w-[280px]">
      <p className="pb-3 text-center text-base font-semibold text-ink">
        {format(month, 'MMMM yyyy')}
      </p>

      <div className="grid grid-cols-7">
        {WEEKDAYS.map((day, index) => (
          <span
            key={index}
            aria-hidden
            className="pb-2 text-center text-xs font-medium text-muted"
          >
            {day}
          </span>
        ))}

        {days.map((day) => (
          <DayCell
            key={day.toISOString()}
            day={day}
            month={month}
            value={value}
            isSelectable={isSelectable}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

function DayCell({
  day,
  month,
  value,
  isSelectable,
  onSelect,
}: {
  day: Date
  month: Date
  value: DateRangeValue
  isSelectable: (iso: string) => boolean
  onSelect: (iso: string) => void
}) {
  const iso = toISODate(day)

  // Days spilling in from adjacent months keep the 7-column rhythm but are not
  // interactive — selecting them would silently jump the visible month.
  if (!isSameMonth(day, month)) return <span className="size-10" />

  const isStart = value.start === iso
  const isEnd = value.end === iso
  const inRange =
    value.start !== null &&
    value.end !== null &&
    iso > value.start &&
    iso < value.end

  const selectable = isSelectable(iso)
  const isEndpoint = isStart || isEnd

  return (
    <div
      className={cn(
        'flex justify-center',
        // The lozenge that visually connects the two endpoints.
        (inRange || (isEndpoint && value.end)) && 'bg-surface-soft',
        isStart && value.end && 'rounded-l-full',
        isEnd && 'rounded-r-full',
      )}
    >
      <button
        type="button"
        disabled={!selectable}
        onClick={() => onSelect(iso)}
        aria-label={format(day, 'EEEE, d MMMM yyyy')}
        aria-pressed={isEndpoint}
        className={cn(
          'size-10 rounded-full text-sm',
          selectable ? 'text-ink hover:bg-surface-strong' : 'text-muted-soft line-through',
          isEndpoint && 'bg-ink font-semibold text-canvas hover:bg-ink',
        )}
      >
        {format(day, 'd')}
      </button>
    </div>
  )
}
