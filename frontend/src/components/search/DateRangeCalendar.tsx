import { useState } from "react";

export type DateRange = { start: Date | null; end: Date | null };

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function firstOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function isSameDay(a: Date | null, b: Date | null) {
  return (
    !!a &&
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function ChevronLeft() {
  return (
    <svg
      viewBox="0 0 32 32"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
    >
      <path
        d="M20 6L10 16l10 10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      viewBox="0 0 32 32"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
    >
      <path
        d="M12 6l10 10-10 10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MonthGrid({
  monthDate,
  range,
  today,
  onSelect,
}: {
  monthDate: Date;
  range: DateRange;
  today: Date;
  onSelect: (date: Date) => void;
}) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const leadingBlanks = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++)
    cells.push(new Date(year, month, day));

  const hasRange = !!(range.start && range.end);

  return (
    <div className="w-[280px]">
      <p className="t-title-md mb-base text-center">
        {MONTHS[month]} {year}
      </p>
      <div className="grid grid-cols-7 gap-y-xs">
        {WEEKDAYS.map((w) => (
          <span
            key={w}
            className="t-caption-sm flex h-8 items-center justify-center text-ink-muted"
          >
            {w}
          </span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`blank-${i}`} />;

          const disabled = date.getTime() < today.getTime();
          const isStart = isSameDay(date, range.start);
          const isEnd = isSameDay(date, range.end);
          const isEndpoint = isStart || isEnd;
          const inRange =
            hasRange &&
            date.getTime() > range.start!.getTime() &&
            date.getTime() < range.end!.getTime();
          const banded = hasRange && (inRange || isEndpoint);

          let band = banded ? "bg-surface-soft" : "";
          if (banded && isStart && !isEnd) band += " rounded-l-full";
          if (banded && isEnd && !isStart) band += " rounded-r-full";

          let day =
            "flex h-10 w-10 items-center justify-center rounded-full t-body-sm transition-colors";
          if (disabled) day += " text-ink-muted-soft cursor-not-allowed";
          else if (isEndpoint)
            day += " border-2 border-legal-link font-semibold text-ink";
          else if (inRange) day += " text-ink";
          else day += " text-ink-body hover:border hover:border-ink";

          return (
            <div
              key={date.toISOString()}
              className={`flex justify-center ${band}`}
            >
              <button
                type="button"
                disabled={disabled}
                aria-pressed={isEndpoint}
                onClick={() => onSelect(date)}
                className={day}
              >
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Two-month range calendar. Pure presentational state holder: the selected
 * range is lifted to the caller via `value`/`onChange`. First click sets the
 * check-in, the next valid click (on or after check-in) sets check-out; a
 * click before the current check-in restarts the range. Past dates are
 * disabled and month navigation can't page before the current month. */
export function DateRangeCalendar({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const today = startOfDay(new Date());
  const [viewMonth, setViewMonth] = useState(() => firstOfMonth(today));

  function handleSelect(date: Date) {
    const { start, end } = value;
    if (!start || end || date.getTime() <= start.getTime()) {
      onChange({ start: date, end: null });
    } else {
      onChange({ start, end: date });
    }
  }

  const nextMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    1,
  );
  const canGoPrev = viewMonth.getTime() > firstOfMonth(today).getTime();

  const navButton =
    "press flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:text-hairline disabled:hover:bg-transparent";

  return (
    <div>
      <div className="relative">
        <button
          type="button"
          aria-label="Previous month"
          disabled={!canGoPrev}
          onClick={() =>
            setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
          }
          className={`absolute left-0 top-0 ${navButton}`}
        >
          <ChevronLeft />
        </button>
        <button
          type="button"
          aria-label="Next month"
          onClick={() =>
            setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
          }
          className={`absolute right-0 top-0 ${navButton}`}
        >
          <ChevronRight />
        </button>
        <div className="flex flex-col gap-xl sm:flex-row">
          <MonthGrid
            monthDate={viewMonth}
            range={value}
            today={today}
            onSelect={handleSelect}
          />
          <MonthGrid
            monthDate={nextMonth}
            range={value}
            today={today}
            onSelect={handleSelect}
          />
        </div>
      </div>
      {(value.start || value.end) && (
        <div className="mt-base flex justify-end border-t border-hairline-soft pt-base">
          <button
            type="button"
            onClick={() => onChange({ start: null, end: null })}
            className="t-button-sm rounded-sm px-md py-sm text-ink underline hover:bg-surface-soft"
          >
            Clear dates
          </button>
        </div>
      )}
    </div>
  );
}
