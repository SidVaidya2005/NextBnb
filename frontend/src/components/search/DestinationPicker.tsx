export type Destination = { city: string; state: string };

const DESTINATIONS: Destination[] = [
  { city: "Mumbai", state: "Maharashtra" },
  { city: "New Delhi", state: "Delhi" },
  { city: "Noida", state: "Uttar Pradesh" },
  { city: "Bengaluru", state: "Karnataka" },
  { city: "Goa", state: "Goa" },
  { city: "Jaipur", state: "Rajasthan" },
  { city: "Udaipur", state: "Rajasthan" },
  { city: "Manali", state: "Himachal Pradesh" },
  { city: "Rishikesh", state: "Uttarakhand" },
  { city: "Kochi", state: "Kerala" },
  { city: "Hyderabad", state: "Telangana" },
  { city: "Kolkata", state: "West Bengal" },
];

function MapPin() {
  return (
    <svg
      viewBox="0 0 32 32"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 29c6-7 10-12 10-17a10 10 0 0 0-20 0c0 5 4 10 10 17z" />
      <circle cx={16} cy={12} r={3.5} />
    </svg>
  );
}

/* Destination list for the "Where" segment of the search bar. Static set of
 * popular Indian cities for now — swap for a typeahead against the listings
 * API once that endpoint exists. `query` filters the list (matched against
 * city + state); the chosen city is lifted to the caller via onSelect. */
export function DestinationPicker({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (destination: Destination) => void;
}) {
  const q = query.trim().toLowerCase();
  const matches = q
    ? DESTINATIONS.filter((d) =>
        `${d.city}, ${d.state}`.toLowerCase().includes(q),
      )
    : DESTINATIONS;

  return (
    <div className="w-[360px] max-w-[calc(100vw-32px)]">
      <p className="t-uppercase-tag mb-md text-ink-muted">
        Suggested destinations
      </p>
      {matches.length === 0 ? (
        <p className="t-body-sm px-md py-sm text-ink-muted">
          No destinations match “{query.trim()}”.
        </p>
      ) : (
        <ul className="max-h-[320px] space-y-xxs overflow-y-auto">
          {matches.map((d) => {
            const selected = d.city.toLowerCase() === q;
            return (
              <li key={d.city}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(d)}
                  className={`flex w-full items-center gap-base rounded-md px-md py-sm text-left transition-colors ${
                    selected
                      ? "bg-surface-soft ring-1 ring-hairline"
                      : "hover:bg-surface-soft"
                  }`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface-strong text-ink">
                    <MapPin />
                  </span>
                  <span className="min-w-0">
                    <span className="t-title-sm block truncate">{d.city}</span>
                    <span className="t-body-sm block truncate text-ink-muted">
                      {d.state}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
