import Link from 'next/link'
import { House } from 'lucide-react'

// Server Component (DESIGN.md `footer-light`): static site chrome, no data, no
// interactivity — so it stays out of every client bundle.
//
// Two deliberate departures from the DESIGN.md spec, both required by
// code-standards.md → "Applying DESIGN.md to NextBnb":
//
//  1. **The columns are not Support / Hosting / Airbnb.** NextBnb has no help
//     centre, careers page or press page, and a footer of `href="#"` is worse
//     than no footer. Every link below resolves to a route that exists.
//  2. **No `legal-band` language or currency picker.** i18n and multi-currency
//     are explicitly out of scope, and the Airbnb legal copy is on the IGNORE
//     list. The band keeps only the copyright, the project-status line, and
//     attribution.

type FooterLink = { href: string; label: string }
type FooterColumn = { id: string; heading: string; links: FooterLink[] }

const REPO_URL = 'https://github.com/SidVaidya2005/NextBnb'
const PORTFOLIO_URL = 'https://siddarthvaidya2005-7iyf.onrender.com/'
const LINKEDIN_URL = 'https://www.linkedin.com/in/siddarth-vaidya-885871239'
const EMAIL = 'siddarthvaidya2005@gmail.com'

/** Shared by the four outbound attribution links. */
const LINK_CLASS =
  'font-medium text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

/**
 * Protected routes are listed on purpose. Signed out, the proxy bounces them to
 * Google and returns the visitor to where they were heading — the same contract
 * TopNav's "Become a host" already relies on. A link that requires a session is
 * not a dead link.
 */
const COLUMNS: FooterColumn[] = [
  {
    id: 'footer-discover',
    heading: 'Discover',
    links: [
      // NOT "Browse stays": that is the empty-state CTA on /messages, /favorites
      // and /trips, so this label would put two links with the same accessible
      // name on those pages — heard twice by anyone listing a page's links, and
      // it broke `second-user.spec.ts`'s unscoped locator with a strict-mode
      // violation rather than a wrong answer.
      { href: '/', label: 'All stays' },
      { href: '/favorites', label: 'Saved stays' },
    ],
  },
  {
    id: 'footer-travelling',
    heading: 'Travelling',
    links: [
      { href: '/trips', label: 'Your trips' },
      { href: '/messages', label: 'Messages' },
    ],
  },
  {
    id: 'footer-hosting',
    heading: 'Hosting',
    links: [
      { href: '/host/listings', label: 'Your listings' },
      { href: '/host/reservations', label: 'Reservations' },
    ],
  },
]

export function Footer() {
  return (
    // <footer> maps to the `contentinfo` landmark only while it is not nested in
    // a section or article. It is a direct child of <body> in layout.tsx, which
    // is what makes the role real — moving it inside a page would silently
    // demote it to a generic element.
    <footer className="border-t border-hairline bg-canvas">
      {/* pb-24 at mobile, not decoration: BookingWidget's reserve bar is
          `fixed inset-x-0 bottom-0 z-40 tablet:hidden`, so on a phone the last
          rows of this footer sit underneath it on /listings/[id]. The listing
          page's own pb-28 clears its content but cannot clear chrome that is
          rendered after it. */}
      <div className="mx-auto max-w-wide px-6 pb-24 pt-12 tablet:px-10 tablet:pb-12">
        {/* A second navigation landmark needs a name distinct from F21's
            `<nav aria-label="Main">`, or a screen-reader user gets two
            identically-announced navigations. */}
        <nav aria-label="Footer" className="grid gap-8 tablet:grid-cols-3 tablet:gap-6">
          {COLUMNS.map((column) => (
            <div key={column.id}>
              {/* A <p> named via aria-labelledby rather than an <h2>. Three real
                  headings would be injected into the outline of all 15 routes,
                  below each page's own h1/h2s. `<ul>` accepts an accessible name
                  (code-standards.md → Accessibility), so the group is still
                  announced and still navigable. */}
              <p id={column.id} className="text-base font-medium text-ink">
                {column.heading}
              </p>
              <ul aria-labelledby={column.id} className="mt-2 tablet:mt-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      // min-h-11 is 44px — code-standards.md: "never ship a tap
                      // target below 44px". Relaxed from tablet: up, where the
                      // input is a pointer rather than a thumb.
                      className="flex min-h-11 items-center text-sm text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink tablet:min-h-9"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-8 flex flex-col gap-4 border-t border-hairline-soft pt-6 tablet:flex-row tablet:items-start tablet:justify-between tablet:gap-8">
          <div className="text-xs text-muted">
            <p className="flex items-center gap-1.5">
              <House className="size-4 text-primary" strokeWidth={2.25} aria-hidden />
              <span>© 2026 NextBnb</span>
            </p>
            <p className="mt-1.5">
              An independent portfolio project — bookings are simulated and no payments are
              processed.
            </p>
          </div>

          <div className="text-xs text-muted tablet:text-right">
            {/* The name is a link inside running prose, so it is the one outbound
                link here exempt from the 44px floor — stretching it would break
                the sentence's line box. The row below is a set of discrete
                controls and is not exempt. */}
            <p>
              Built by{' '}
              <a href={PORTFOLIO_URL} target="_blank" rel="noreferrer" className={LINK_CLASS}>
                Siddarth Vaidya
              </a>
            </p>
            <div className="flex flex-wrap items-center gap-x-4 tablet:justify-end">
              <a
                href={LINKEDIN_URL}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex min-h-11 items-center tablet:min-h-0 ${LINK_CLASS}`}
              >
                LinkedIn
              </a>
              {/* "Email me", not "Email": AdminUsersTable renders a literal
                  "Email" column header, so the bare label would put two
                  identically-named things on /admin — the collision class that
                  broke second-user.spec.ts, caught this time before shipping.
                  No target/rel: a mailto hands off to the mail client. */}
              <a
                href={`mailto:${EMAIL}`}
                className={`inline-flex min-h-11 items-center tablet:min-h-0 ${LINK_CLASS}`}
              >
                Email me
              </a>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex min-h-11 items-center tablet:min-h-0 ${LINK_CLASS}`}
              >
                Source on GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
