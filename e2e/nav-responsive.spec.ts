import { test, expect, type Page } from '@playwright/test'

import { AUTH_STATE_FILE } from './constants'

/**
 * Responsive verification of the nav + account menu at the four DESIGN.md
 * breakpoints. F04 shipped this UI without it, and CLAUDE.md makes breakpoint
 * verification part of "done" rather than polish — so it is asserted here
 * instead of eyeballed once and forgotten.
 *
 * Bands: mobile <744 / tablet 744-1128 / desktop 1128-1440 / wide >1440.
 *
 * This list used to sample only the middle of each band, and that is exactly
 * how it missed two real defects that F07's responsive pass found by measuring:
 * the search pill overlapped the logo on every phone width, and the row
 * overflowed the viewport by 89px across 744-833. **The lower boundary of each
 * band is now sampled too** — a band's tightest point is its first pixel, not
 * its middle.
 */
const BREAKPOINTS = [
  { name: 'mobile-narrow', width: 320, height: 700, compact: true, hostLink: false },
  { name: 'mobile', width: 375, height: 812, compact: true, hostLink: false },
  { name: 'tablet-min', width: 744, height: 1000, compact: false, hostLink: false },
  { name: 'tablet', width: 834, height: 1112, compact: false, hostLink: false },
  { name: 'desktop-min', width: 1128, height: 800, compact: false, hostLink: true },
  { name: 'desktop', width: 1280, height: 800, compact: false, hostLink: true },
  { name: 'wide', width: 1512, height: 900, compact: false, hostLink: true },
] as const

/** code-standards.md: "never ship a tap target below 44px". */
const MIN_TAP_TARGET = 44

async function openAccountMenu(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click()
  await expect(page.getByRole('menu', { name: 'Account' })).toBeVisible()
}

/** The dropdown is absolutely positioned inside a sticky header — off-screen
 *  edges are unreachable rather than merely ugly, so this is a real assertion. */
async function expectMenuWithinViewport(page: Page, label: string) {
  const menu = page.getByRole('menu', { name: 'Account' })
  const box = await menu.boundingBox()
  expect(box, `${label}: menu should have a box`).not.toBeNull()
  if (!box) return

  const viewport = page.viewportSize()
  if (!viewport) return

  expect.soft(box.x, `${label}: menu overflows the left edge`).toBeGreaterThanOrEqual(0)
  expect
    .soft(box.x + box.width, `${label}: menu overflows the right edge`)
    .toBeLessThanOrEqual(viewport.width)
  expect.soft(box.y, `${label}: menu is clipped above the viewport`).toBeGreaterThanOrEqual(0)
  expect
    .soft(box.y + box.height, `${label}: menu extends below the fold inside a sticky header`)
    .toBeLessThanOrEqual(viewport.height)
}

async function expectTapTargets(page: Page, label: string) {
  const items = page.getByRole('menuitem')
  const count = await items.count()
  expect(count, `${label}: menu should expose items`).toBeGreaterThan(0)

  for (let i = 0; i < count; i += 1) {
    const item = items.nth(i)
    const text = (await item.textContent())?.trim() ?? `item ${i}`
    const box = await item.boundingBox()
    expect
      .soft(box?.height ?? 0, `${label}: "${text}" tap target is under ${MIN_TAP_TARGET}px`)
      .toBeGreaterThanOrEqual(MIN_TAP_TARGET)
  }
}

async function expectNoHorizontalScroll(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect.soft(overflow, `${label}: page scrolls horizontally`).toBeLessThanOrEqual(0)
}

/**
 * Nothing in the nav may sit on top of the logo.
 *
 * Reading the JSX never caught this: the mobile search pill is `flex-1`, which
 * *looks* like it shrinks, but a flex item defaults to `min-width: auto` and so
 * floors at its content width. It overflowed its wrapper and — because the
 * wrapper centres it — spilled over the logo by 59px at 320 and 32px at 375.
 * Only measuring the rendered boxes shows it.
 */
async function expectNothingCoversTheLogo(page: Page, label: string) {
  const worst = await page.evaluate(() => {
    const logo = document.querySelector('a[aria-label="NextBnb home"]')
    if (!logo) return -1

    const target = logo.getBoundingClientRect()
    let overlap = 0

    for (const element of document.querySelectorAll('header *')) {
      if (element.contains(logo) || logo.contains(element)) continue
      const box = element.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue

      const x = Math.min(target.right, box.right) - Math.max(target.left, box.left)
      const y = Math.min(target.bottom, box.bottom) - Math.max(target.top, box.top)
      if (x > 1 && y > 1) overlap = Math.max(overlap, x)
    }

    return Math.round(overlap)
  })

  expect.soft(worst, `${label}: the logo must be present`).toBeGreaterThanOrEqual(0)
  expect.soft(worst, `${label}: something in the nav overlaps the logo`).toBe(0)
}

/** The nav row itself must fit, independently of whether the page scrolls. */
async function expectNavRowFits(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const row = document.querySelector('header > div')
    return row ? Math.round(row.scrollWidth - row.clientWidth) : 0
  })
  expect.soft(overflow, `${label}: the nav row overflows its container`).toBeLessThanOrEqual(0)
}

test.describe('nav responsive — signed out', () => {
  for (const bp of BREAKPOINTS) {
    test(`${bp.name} (${bp.width}px): nav collapses and the menu stays reachable`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height })
      await page.goto('/')

      await expect(page.getByRole('link', { name: 'NextBnb home' })).toBeVisible()

      // Nothing may cover the logo, and the row must fit — asserted before the
      // menu opens, since both are properties of the resting nav.
      await expectNothingCoversTheLogo(page, `${bp.name} signed out`)
      await expectNavRowFits(page, `${bp.name} signed out`)

      // "Become a host" is desktop+ only: between 744 and 833 it does not fit
      // beside the full search pill. It stays reachable from the account menu
      // ("Manage listings"), which is the same route.
      const becomeHost = page.getByRole('link', { name: 'Become a host' })
      if (bp.hostLink) {
        await expect(becomeHost).toBeVisible()
      } else {
        await expect(becomeHost).toBeHidden()
      }

      const trigger = page.getByRole('button', { name: 'Account menu' })
      await expect(trigger).toBeVisible()
      const triggerBox = await trigger.boundingBox()
      expect
        .soft(triggerBox?.height ?? 0, `${bp.name}: trigger height`)
        .toBeGreaterThanOrEqual(MIN_TAP_TARGET)
      expect
        .soft(triggerBox?.width ?? 0, `${bp.name}: trigger width`)
        .toBeGreaterThanOrEqual(MIN_TAP_TARGET)

      await openAccountMenu(page)
      await expectMenuWithinViewport(page, `${bp.name} signed out`)
      await expectTapTargets(page, `${bp.name} signed out`)
      await expectNoHorizontalScroll(page, `${bp.name} signed out`)

      await expect(page.getByRole('menuitem', { name: /sign in with google/i })).toBeVisible()
    })
  }
})

test.describe('nav responsive — signed in', () => {
  test.use({ storageState: AUTH_STATE_FILE })

  for (const bp of BREAKPOINTS) {
    test(`${bp.name} (${bp.width}px): the full destination list fits and is tappable`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height })
      await page.goto('/')

      await expectNothingCoversTheLogo(page, `${bp.name} signed in`)
      await expectNavRowFits(page, `${bp.name} signed in`)

      await openAccountMenu(page)

      // The signed-in menu is the tall one — every destination must be on screen.
      for (const label of ['Trips', 'Favorites', 'Messages', 'Manage listings', 'Reservations']) {
        await expect(page.getByRole('menuitem', { name: label })).toBeVisible()
      }
      await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible()

      await expectMenuWithinViewport(page, `${bp.name} signed in`)
      await expectTapTargets(page, `${bp.name} signed in`)
      await expectNoHorizontalScroll(page, `${bp.name} signed in`)
    })
  }
})
