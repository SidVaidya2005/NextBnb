import type { ReactNode } from "react";

export type Guests = {
  adults: number;
  children: number;
  infants: number;
  pets: number;
};

const ROWS: {
  key: keyof Guests;
  title: string;
  subtitle: ReactNode;
  max: number;
}[] = [
  { key: "adults", title: "Adults", subtitle: "Ages 13 or above", max: 16 },
  { key: "children", title: "Children", subtitle: "Ages 2–12", max: 15 },
  { key: "infants", title: "Infants", subtitle: "Under 2", max: 5 },
  {
    key: "pets",
    title: "Pets",
    subtitle: (
      <button type="button" className="underline hover:text-ink">
        Bringing a service animal?
      </button>
    ),
    max: 5,
  },
];

function Minus() {
  return (
    <svg
      viewBox="0 0 32 32"
      width={12}
      height={12}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
    >
      <path d="M4 16h24" strokeLinecap="round" />
    </svg>
  );
}

function Plus() {
  return (
    <svg
      viewBox="0 0 32 32"
      width={12}
      height={12}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
    >
      <path d="M16 4v24M4 16h24" strokeLinecap="round" />
    </svg>
  );
}

function Stepper({
  value,
  max,
  label,
  onChange,
}: {
  value: number;
  max: number;
  label: string;
  onChange: (next: number) => void;
}) {
  const btn =
    "press flex h-9 w-9 items-center justify-center rounded-full border border-hairline-strong text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:border-hairline-soft disabled:text-hairline disabled:hover:border-hairline-soft";
  return (
    <div className="flex items-center gap-base">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
        className={btn}
      >
        <Minus />
      </button>
      <span className="t-body-md w-6 text-center tabular-nums">{value}</span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className={btn}
      >
        <Plus />
      </button>
    </div>
  );
}

/* Guest counter for the "Who" segment of the search bar — Adults / Children /
 * Infants / Pets, each a labelled stepper. Counts are lifted to the caller via
 * `value`/`onChange`; each category is clamped to [0, max]. */
export function GuestSelector({
  value,
  onChange,
}: {
  value: Guests;
  onChange: (next: Guests) => void;
}) {
  return (
    <div className="w-[380px] max-w-[calc(100vw-32px)]">
      {ROWS.map((row, idx) => (
        <div
          key={row.key}
          className={`flex items-center justify-between py-base ${
            idx < ROWS.length - 1 ? "border-b border-hairline-soft" : ""
          }`}
        >
          <div>
            <p className="t-title-md">{row.title}</p>
            <p className="t-body-sm text-ink-muted">{row.subtitle}</p>
          </div>
          <Stepper
            value={value[row.key]}
            max={row.max}
            label={row.title}
            onChange={(next) => onChange({ ...value, [row.key]: next })}
          />
        </div>
      ))}
    </div>
  );
}
