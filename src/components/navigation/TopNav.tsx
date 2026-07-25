import Link from 'next/link'
import { House } from 'lucide-react'

import { AccountMenu } from '@/components/navigation/AccountMenu'
import { SearchBar } from '@/components/search/SearchBar'
import { getCurrentProfile } from '@/lib/queries/profiles'

// Server Component (DESIGN.md `top-nav`): resolves the signed-in identity once
// per render and hands it to the client dropdown. The search bar is a client
// leaf — it reads the URL, which a layout cannot.
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

        {/* Search — the 3-segment pill from tablet:, a single pill that opens a
            full-screen overlay below it. */}
        <div className="mx-3 flex min-w-0 flex-1 justify-center tablet:mx-6 tablet:flex-none">
          <SearchBar />
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
