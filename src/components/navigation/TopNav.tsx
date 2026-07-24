import Link from 'next/link'
import { House, Search, Menu, CircleUserRound } from 'lucide-react'

// Static presentational top-nav shell (DESIGN.md `top-nav`). Feature 01 ships the
// visual shell only: the search pill and account control are placeholders — the
// real search (F06) and auth/account menu (F04) replace them later.
export function TopNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-canvas">
      <div className="mx-auto flex h-20 max-w-wide items-center justify-between px-6 tablet:px-10">
        {/* Logo — the wordmark is the one Rausch moment in the nav. */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5 text-primary"
          aria-label="NextBnb home"
        >
          <House className="size-7" strokeWidth={2.25} aria-hidden />
          <span className="text-xl font-semibold tracking-tight">NextBnb</span>
        </Link>

        {/* Search pill — tablet and up. Placeholder until Feature 06. */}
        <div className="hidden items-center gap-2 rounded-full border border-hairline py-2 pl-6 pr-2 shadow-card tablet:flex">
          <span className="text-sm font-medium text-ink">Anywhere</span>
          <span className="h-6 w-px bg-hairline" aria-hidden />
          <span className="text-sm font-medium text-ink">Any week</span>
          <span className="h-6 w-px bg-hairline" aria-hidden />
          <span className="pr-2 text-sm text-muted">Add guests</span>
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-on-primary">
            <Search className="size-4" aria-hidden />
          </span>
        </div>

        {/* Account cluster — tablet and up. */}
        <div className="hidden shrink-0 items-center gap-2 tablet:flex">
          <span className="rounded-full px-4 py-2.5 text-sm font-medium text-ink">
            Become a host
          </span>
          <button
            type="button"
            className="flex h-12 items-center gap-2 rounded-full border border-hairline px-3 text-ink"
            aria-label="Account menu"
          >
            <Menu className="size-4" aria-hidden />
            <CircleUserRound className="size-7 text-muted" aria-hidden />
          </button>
        </div>

        {/* Mobile — logo + hamburger only. */}
        <button
          type="button"
          className="flex size-11 items-center justify-center rounded-full border border-hairline text-ink tablet:hidden"
          aria-label="Menu"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </div>
    </header>
  )
}
