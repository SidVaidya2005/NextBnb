import { formatPrice } from '@/lib/utils'

// Home placeholder for Feature 01 — proves the app boots and the DESIGN.md tokens
// (Rausch accent, ink, Inter, radii) render. The real search + listing grid land
// in Features 05–06.
export default function HomePage() {
  return (
    <div className="mx-auto max-w-wide px-6 py-16 tablet:px-10">
      <p className="text-sm font-medium uppercase tracking-wide text-primary">
        NextBnb
      </p>
      <h1 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight text-ink tablet:text-[28px]">
        Find a place to stay. Or host one of your own.
      </h1>
      <p className="mt-4 max-w-xl text-base text-body">
        The scaffold is live. Search, listings, booking, and hosting arrive in the
        features ahead — starting from a real Supabase-backed grid.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="h-12 rounded-sm bg-primary px-6 text-base font-medium text-on-primary transition-colors hover:bg-primary-active"
        >
          Explore stays
        </button>
        <span className="text-sm text-muted">
          e.g. from {formatPrice(9500)} / night
        </span>
      </div>
    </div>
  )
}
