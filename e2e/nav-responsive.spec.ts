import { test, expect, type Page } from '@playwright/test'

import { AUTH_STATE_FILE } from './constants'

/**
 * Responsive verification of the nav + account menu at the four DESIGN.md
 * breakpoints. F04 shipped this UI without it, and CLAUDE.md makes breakpoint
 * verification part of "done" rather than polish — so it is asserted here
 * instead of eyeballed once and forgotten.
 *
 * Widths are representative points INSIDE each band, not the boundaries:
 * mobile <744 / tablet 744-1128 / desktop 1128-1440 / wide >1440.
 */
const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812, compact: true },
  { name: 'tablet', width: 834, height: 1112, compact: false },
  { name: 'desktop', width: 1280, height: 800, compact: false },
  { name: 'wide', width: 1512, height: 900, compact: false },
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

test.describe('nav responsive — signed out', () => {
  for (const bp of BREAKPOINTS) {
    test(`${bp.name} (${bp.width}px): nav collapses and the menu stays reachable`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height })
      await page.goto('/')

      await expect(page.getByRole('link', { name: 'NextBnb home' })).toBeVisible()

      // The search pill and "Become a host" are tablet+ only; on mobile the
      // account menu is the sole control (the hamburger lives inside it).
      const becomeHost = page.getByRole('link', { name: 'Become a host' })
      if (bp.compact) {
        await expect(becomeHost).toBeHidden()
      } else {
        await expect(becomeHost).toBeVisible()
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
