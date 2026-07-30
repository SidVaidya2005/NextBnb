import { test, expect } from '@playwright/test'

import { AUTH_STATE_FILE } from './constants'
import { loadPublishedListings } from './fixtures'

/**
 * The site footer (F23) — landmark semantics, honest links, and the sticky-foot
 * layout.
 *
 * **The "no dead link" test is the point of this file.** A footer of plausible
 * links to pages that do not exist is the defect this component was written to
 * avoid, and it is invisible to typecheck, lint and every other spec: a
 * `<Link href="/help">` compiles perfectly and 404s at runtime. So each link is
 * asserted twice — that the href is what the component claims, and that
 * navigating to it actually serves 200.
 */

/** Mirrors COLUMNS in src/components/navigation/Footer.tsx. Duplicated on
 *  purpose: if the component's list changes without this one, the spec should
 *  fail rather than silently follow it. */
const FOOTER_LINKS = [
  { href: '/', label: 'All stays' },
  { href: '/favorites', label: 'Saved stays' },
  { href: '/trips', label: 'Your trips' },
  { href: '/messages', label: 'Messages' },
  { href: '/host/listings', label: 'Your listings' },
  { href: '/host/reservations', label: 'Reservations' },
] as const

const REPO_URL = 'https://github.com/SidVaidya2005/NextBnb'
const PORTFOLIO_URL = 'https://siddarthvaidya2005-7iyf.onrender.com/'
const LINKEDIN_URL = 'https://www.linkedin.com/in/siddarth-vaidya-885871239'
const EMAIL = 'siddarthvaidya2005@gmail.com'

test.describe('site footer', () => {
  test('is a contentinfo landmark, exactly one per page', async ({ page }) => {
    await page.goto('/')

    // <footer> only maps to contentinfo while it is not nested in a section or
    // article, which is why this asserts the ROLE and not the tag.
    await expect(page.getByRole('contentinfo')).toHaveCount(1)
    await expect(page.getByRole('contentinfo')).toBeVisible()
  })

  test('its navigation landmark is named distinctly from the main one', async ({ page }) => {
    await page.goto('/')

    // Two navigations announced as "Main" would be indistinguishable in a screen
    // reader's landmark list — the reason F21's label is not simply reused.
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(1)
    await expect(page.getByRole('navigation', { name: 'Footer' })).toHaveCount(1)
  })

  test('each link group carries its heading as an accessible name', async ({ page }) => {
    await page.goto('/')

    // getByRole(role, { name }) resolves the COMPUTED name, unlike getByLabel —
    // F20's finding, and the reason aria-labelledby is asserted this way.
    for (const group of ['Discover', 'Travelling', 'Hosting']) {
      await expect(page.getByRole('list', { name: group })).toHaveCount(1)
    }
  })

  test('renders on a listing page as well as the home page', async ({ page }) => {
    const [listing] = await loadPublishedListings()
    await page.goto(`/listings/${listing.id}`)

    await expect(page.getByRole('contentinfo')).toBeVisible()
  })

  test('states that bookings are simulated', async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByRole('contentinfo').getByText(/bookings are simulated/i),
    ).toBeVisible()
  })

  test('attribution links point where they claim and open safely', async ({ page }) => {
    await page.goto('/')
    const footer = page.getByRole('contentinfo')

    // Every outbound target asserted explicitly. A footer's contact links are
    // exactly the kind of thing that rots silently — nothing else in the suite,
    // and no type, would notice a LinkedIn handle going stale.
    const outbound = [
      { name: 'Siddarth Vaidya', href: PORTFOLIO_URL },
      { name: 'LinkedIn', href: LINKEDIN_URL },
      { name: 'Source on GitHub', href: REPO_URL },
    ] as const

    for (const link of outbound) {
      const locator = footer.getByRole('link', { name: link.name })
      await expect(locator, `${link.name} should point at ${link.href}`).toHaveAttribute(
        'href',
        link.href,
      )
      await expect(locator).toHaveAttribute('target', '_blank')
      // rel=noreferrer keeps the referrer off an outbound click; without it the
      // new tab can also reach back through window.opener on older engines.
      await expect(locator).toHaveAttribute('rel', /noreferrer/)
    }

    // "Email me", not "Email": AdminUsersTable renders a literal "Email" header,
    // so the bare name would be ambiguous on /admin.
    const email = footer.getByRole('link', { name: 'Email me' })
    await expect(email).toHaveAttribute('href', `mailto:${EMAIL}`)
    // A mailto hands off to the mail client; target=_blank would leave a blank tab.
    await expect(email).not.toHaveAttribute('target', '_blank')
  })

  test.describe('signed in', () => {
    test.use({ storageState: AUTH_STATE_FILE })

    test('no footer link is dead', async ({ page }) => {
      await page.goto('/')
      const footer = page.getByRole('contentinfo')

      for (const link of FOOTER_LINKS) {
        await expect(
          footer.getByRole('link', { name: link.label }),
          `${link.label} should point at ${link.href}`,
        ).toHaveAttribute('href', link.href)
      }

      // Signed in, because half these routes are protected: signed out they
      // legitimately 307 to sign-in, which would prove nothing about whether the
      // page behind them exists.
      for (const link of FOOTER_LINKS) {
        const response = await page.goto(link.href)
        expect(response?.status(), `${link.href} should serve 200`).toBe(200)
        await expect(page.getByRole('contentinfo')).toBeVisible()
      }
    })

    test('sits at the bottom of the viewport on a short page', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 1000 })
      await page.goto('/messages')

      const footer = page.getByRole('contentinfo')
      await expect(footer).toBeVisible()

      const box = await footer.boundingBox()
      expect(box).not.toBeNull()
      if (!box) return

      // On a page shorter than the viewport, `flex-1` on <main> pushes this to
      // the floor. Without it the footer stops wherever the content ended,
      // leaving dead white space beneath — which is the broken-looking state
      // this assertion exists to catch.
      expect(box.y + box.height).toBeGreaterThanOrEqual(1000 - 2)
    })
  })
})
