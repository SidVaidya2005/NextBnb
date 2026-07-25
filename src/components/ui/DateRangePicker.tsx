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

/** An occupied span, both ends inclusive. F06 passes none; F12 fills these in
 *  from a listing's confirmed bookings and host blocks. */
export type UnavailableRange = { start: string; end: string }

export type DateRangeValue = { checkIn: string | null; checkOut: string | null }

type Props = {
  value: DateRangeValue
  onChange: (next: DateRangeValue) => void
  unavailableRanges?: readonly UnavailableRange[]
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
export function DateRangePicker({ value, onChange, unavailableRanges = [] }: Props) {
  const [firstMonth, setFirstMonth] = useState(() =>
    startOfMonth(value.checkIn ? parseISO(value.checkIn) : new Date()),
  )

  const today = todayISO()

  function isUnavailable(iso: string): boolean {
    return unavailableRanges.some((range) => iso >= range.start && iso <= range.end)
  }

  function isSelectable(iso: string): boolean {
    return iso >= today && !isUnavailable(iso)
  }

  function handleSelect(iso: string) {
    const { checkIn, checkOut } = value

    // No start yet, a completed range, or a click on/before the start: begin again.
    if (!checkIn || checkOut || iso <= checkIn) {
      onChange({ checkIn: iso, checkOut: null })
      return
    }

    // A range may not straddle an unavailable night — restart there instead of
    // silently proposing dates that cannot be booked.
    const straddles = eachDayOfInterval({
      start: parseISO(checkIn),
      end: parseISO(iso),
    }).some((day) => {
      const dayIso = toISODate(day)
      // Half-open: the checkout day itself is not occupied by this stay.
      return dayIso !== iso && isUnavailable(dayIso)
    })

    if (straddles) {
      onChange({ checkIn: iso, checkOut: null })
      return
    }

    onChange({ checkIn, checkOut: iso })
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

  const isStart = value.checkIn === iso
  const isEnd = value.checkOut === iso
  const inRange =
    value.checkIn !== null &&
    value.checkOut !== null &&
    iso > value.checkIn &&
    iso < value.checkOut

  const selectable = isSelectable(iso)
  const isEndpoint = isStart || isEnd

  return (
    <div
      className={cn(
        'flex justify-center',
        // The lozenge that visually connects the two endpoints.
        (inRange || (isEndpoint && value.checkOut)) && 'bg-surface-soft',
        isStart && value.checkOut && 'rounded-l-full',
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
