'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, CircleUserRound } from 'lucide-react'

import { signInWithGoogle, signOut } from '@/lib/actions/auth'
import type { CurrentProfile } from '@/lib/queries/profiles'
import { cn } from '@/lib/utils'

type Props = { profile: CurrentProfile | null }

// Every destination behind the account menu is a protected route, so each one
// is added here by the feature that builds it.
const SIGNED_IN_LINKS = [
  { href: '/trips', label: 'Trips' },
  { href: '/favorites', label: 'Favorites' },
  { href: '/messages', label: 'Messages' },
  { href: '/host/listings', label: 'Manage listings' },
  { href: '/host/reservations', label: 'Reservations' },
]

export function AccountMenu({ profile }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Sign-in returns the user to wherever they opened the menu from.
  const nextPath = pathname ?? '/'

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-12 items-center gap-2 rounded-full border border-hairline px-3 text-ink transition-shadow hover:shadow-card"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Menu className="size-4" aria-hidden />
        <Avatar profile={profile} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-14 z-50 w-60 overflow-hidden rounded-md border border-hairline bg-canvas py-2 shadow-card"
        >
          {profile ? (
            <>
              <div className="border-b border-hairline px-4 pb-3 pt-1">
                <p className="truncate text-sm font-medium text-ink">
                  {profile.full_name ?? 'Your account'}
                </p>
                {profile.email && (
                  <p className="truncate text-sm text-muted">{profile.email}</p>
                )}
              </div>

              {SIGNED_IN_LINKS.map((link) => (
                <MenuLink key={link.href} href={link.href}>
                  {link.label}
                </MenuLink>
              ))}

              {profile.is_admin && (
                <MenuLink href="/admin">Admin</MenuLink>
              )}

              <form action={signOut} className="border-t border-hairline pt-1">
                <button
                  type="submit"
                  role="menuitem"
                  className="w-full px-4 py-3 text-left text-sm text-ink hover:bg-surface-soft"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <form action={signInWithGoogle}>
              <input type="hidden" name="next" value={nextPath} />
              <button
                type="submit"
                role="menuitem"
                className="w-full px-4 py-3 text-left text-sm font-medium text-ink hover:bg-surface-soft"
              >
                Sign in with Google
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

function MenuLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  // py-3 (not py-2.5) is load-bearing: 12px + 20px line-height + 12px = the 44px
  // tap-target floor in code-standards.md. It also matches DESIGN.md's
  // `amenity-row` 12px row padding. Asserted by e2e/nav-responsive.spec.ts.
  return (
    <Link
      href={href}
      role="menuitem"
      className="block px-4 py-3 text-sm text-ink hover:bg-surface-soft"
    >
      {children}
    </Link>
  )
}

function Avatar({ profile }: Props) {
  // Google avatars are remote (lh3.googleusercontent.com, whitelisted in
  // next.config.ts). A seeded/most-new user may have none — fall back to the
  // outline icon rather than rendering a broken image.
  if (!profile?.avatar_url) {
    return <CircleUserRound className="size-7 text-muted" aria-hidden />
  }

  return (
    <Image
      src={profile.avatar_url}
      alt=""
      width={28}
      height={28}
      className={cn('size-7 rounded-full object-cover')}
    />
  )
}
