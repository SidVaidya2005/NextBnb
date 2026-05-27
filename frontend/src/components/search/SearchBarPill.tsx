import { MagnifyingGlass } from '../common/Icon';

const segments = [
  { label: 'Where', placeholder: 'Search destinations' },
  { label: 'Check in', placeholder: 'Add dates' },
  { label: 'Check out', placeholder: 'Add dates' },
  { label: 'Who', placeholder: 'Add guests' },
];

/* The signature global search bar. White surface, pill-shaped, 1px hairline
 * dividers between segments, terminated by the circular Rausch search orb.
 * Visual shell only — clicking does not open a search overlay yet. */
export function SearchBarPill({ className = '' }: { className?: string }) {
  return (
    <div
      className={`inline-flex h-16 items-stretch rounded-full border border-hairline bg-surface-canvas shadow-card-soft ${className}`}
    >
      {segments.map((seg, idx) => (
        <button
          key={seg.label}
          type="button"
          className={`group relative flex flex-col justify-center px-6 text-left transition-colors hover:bg-surface-soft first:rounded-l-full ${
            idx === segments.length - 1 ? 'pr-3' : ''
          }`}
        >
          <span className="t-uppercase-tag text-ink">{seg.label}</span>
          <span className="t-body-sm text-ink-muted">{seg.placeholder}</span>
          {idx < segments.length - 1 && (
            <span className="absolute right-0 top-1/2 h-8 w-px -translate-y-1/2 bg-hairline group-hover:bg-transparent" />
          )}
        </button>
      ))}
      <div className="flex items-center pr-2">
        <button
          type="button"
          aria-label="Search"
          className="press flex h-12 w-12 items-center justify-center rounded-full bg-rausch text-ink-on-primary hover:bg-rausch-active"
        >
          <MagnifyingGlass size={16} />
        </button>
      </div>
    </div>
  );
}
