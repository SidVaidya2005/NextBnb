import Link from 'next/link'
import { House, Search } from 'lucide-react'

import { AccountMenu } from '@/components/navigation/AccountMenu'
import { getCurrentProfile } from '@/lib/queries/profiles'

// Server Component (DESIGN.md `top-nav`): resolves the signed-in identity once
// per render and hands it to the client dropdown. The search pill is still a
// placeholder until Feature 06.
export async function TopNav() {
  const profile = await getCurrentProfile()

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

        {/* Account cluster. The menu is the only control on mobile, so it is
            never hidden — the hamburger lives inside it. */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/host/listings"
            className="hidden rounded-full px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-soft tablet:block"
          >
            Become a host
          </Link>
          <AccountMenu profile={profile} />
        </div>
      </div>
    </header>
  )
}
