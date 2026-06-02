import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MagnifyingGlass } from "../common/Icon";
import { DateRangeCalendar, type DateRange } from "./DateRangeCalendar";
import { DestinationPicker } from "./DestinationPicker";
import { GuestSelector, type Guests } from "./GuestSelector";

function formatDay(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatRange(range: DateRange) {
  if (range.start && range.end)
    return `${formatDay(range.start)} – ${formatDay(range.end)}`;
  if (range.start) return formatDay(range.start);
  return null;
}

const plural = (n: number, noun: string) => `${n} ${noun}${n > 1 ? "s" : ""}`;

function formatGuests(g: Guests) {
  const parts: string[] = [];
  const guests = g.adults + g.children;
  if (guests > 0) parts.push(plural(guests, "guest"));
  if (g.infants > 0) parts.push(plural(g.infants, "infant"));
  if (g.pets > 0) parts.push(plural(g.pets, "pet"));
  return parts.length ? parts.join(", ") : null;
}

const segmentClass = (active: boolean, last: boolean) =>
  `group relative flex flex-col justify-center px-6 text-left transition-colors first:rounded-l-full ${
    active ? "bg-surface-soft" : "hover:bg-surface-soft"
  } ${last ? "pr-3" : ""}`;

/* The signature global search bar. White surface, pill-shaped, 1px hairline
 * dividers between segments, terminated by the circular Rausch search orb.
 * "Where" is a typeahead text input, "When" opens a date-range calendar, and
 * "Who" opens a guest counter — each backed by a popover below the pill. */
export function SearchBarPill({ className = "" }: { className?: string }) {
  const [openSegment, setOpenSegment] = useState<string | null>(null);
  const [destination, setDestination] = useState("");
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const [guests, setGuests] = useState<Guests>({
    adults: 0,
    children: 0,
    infants: 0,
    pets: 0,
  });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  function handleSearch() {
    const q = destination.trim();
    navigate(q ? `/listings?where=${encodeURIComponent(q)}` : "/listings");
    setOpenSegment(null);
  }

  useEffect(() => {
    if (!openSegment) return;
    function onPointerDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setOpenSegment(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenSegment(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openSegment]);

  const dateLabel = formatRange(range);
  const guestLabel = formatGuests(guests);

  return (
    <div ref={wrapperRef} className={`relative inline-flex ${className}`}>
      <div className="inline-flex h-16 items-stretch rounded-full border border-hairline bg-surface-canvas shadow-card-soft">
        {/* Where — typeahead text input */}
        <div
          className={segmentClass(openSegment === "Where", false)}
          onClick={() => setOpenSegment("Where")}
        >
          <label htmlFor="search-where" className="t-uppercase-tag text-ink">
            Where
          </label>
          <input
            id="search-where"
            type="text"
            autoComplete="off"
            value={destination}
            placeholder="Search destinations"
            aria-haspopup="dialog"
            aria-expanded={openSegment === "Where"}
            onFocus={(e) => {
              setOpenSegment("Where");
              e.target.select();
            }}
            onChange={(e) => {
              setDestination(e.target.value);
              setOpenSegment("Where");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            className="t-body-sm w-40 bg-transparent text-ink placeholder:text-ink-muted focus:outline-none"
          />
          <span className="absolute right-0 top-1/2 h-8 w-px -translate-y-1/2 bg-hairline group-hover:bg-transparent" />
        </div>

        {/* When — date-range calendar */}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={openSegment === "When"}
          onClick={() =>
            setOpenSegment((cur) => (cur === "When" ? null : "When"))
          }
          className={segmentClass(openSegment === "When", false)}
        >
          <span className="t-uppercase-tag text-ink">When</span>
          <span
            className={`t-body-sm ${dateLabel ? "text-ink" : "text-ink-muted"}`}
          >
            {dateLabel ?? "Add dates"}
          </span>
          <span className="absolute right-0 top-1/2 h-8 w-px -translate-y-1/2 bg-hairline group-hover:bg-transparent" />
        </button>

        {/* Who — guest counter */}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={openSegment === "Who"}
          onClick={() =>
            setOpenSegment((cur) => (cur === "Who" ? null : "Who"))
          }
          className={segmentClass(openSegment === "Who", true)}
        >
          <span className="t-uppercase-tag text-ink">Who</span>
          <span
            className={`t-body-sm ${guestLabel ? "text-ink" : "text-ink-muted"}`}
          >
            {guestLabel ?? "Add guests"}
          </span>
        </button>

        <div className="flex items-center pr-2">
          <button
            type="button"
            aria-label="Search"
            onClick={handleSearch}
            className="press flex h-12 w-12 items-center justify-center rounded-full bg-rausch text-ink-on-primary hover:bg-rausch-active"
          >
            <MagnifyingGlass size={16} />
          </button>
        </div>
      </div>

      {openSegment === "Where" && (
        <div
          role="dialog"
          aria-label="Choose a destination"
          className="absolute left-0 top-full z-20 mt-md rounded-xl border border-hairline bg-surface-canvas p-lg shadow-card"
        >
          <DestinationPicker
            query={destination}
            onSelect={(d) => {
              setDestination(d.city);
              setOpenSegment(null);
            }}
          />
        </div>
      )}

      {openSegment === "When" && (
        <div
          role="dialog"
          aria-label="Choose dates"
          className="absolute left-1/2 top-full z-20 mt-md max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl border border-hairline bg-surface-canvas p-lg shadow-card"
        >
          <DateRangeCalendar value={range} onChange={setRange} />
        </div>
      )}

      {openSegment === "Who" && (
        <div
          role="dialog"
          aria-label="Choose guests"
          className="absolute right-0 top-full z-20 mt-md max-w-[calc(100vw-32px)] rounded-xl border border-hairline bg-surface-canvas p-lg shadow-card"
        >
          <GuestSelector value={guests} onChange={setGuests} />
        </div>
      )}
    </div>
  );
}
