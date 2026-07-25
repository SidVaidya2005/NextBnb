import { test, expect } from '@playwright/test'

import { AUTH_STATE_FILE, TEST_USER } from './constants'
import { mintSessionCookies } from './session'

const PROTECTED_ROUTES = [
  '/trips',
  '/favorites',
  '/messages',
  '/host/listings',
  '/host/reservations',
]

test.describe('signed out', () => {
  test('a protected route bounces to home carrying the intended destination', async ({
    page,
  }) => {
    await page.goto('/trips')

    await expect(page).toHaveURL('/?signin=required&next=%2Ftrips')
    await expect(page.getByTestId('signin-banner')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Sign in with Google' }),
    ).toBeVisible()
  })

  test('every protected route is guarded', async ({ page }) => {
    for (const route of PROTECTED_ROUTES) {
      await page.goto(route)
      await expect(page).toHaveURL(
        `/?signin=required&next=${encodeURIComponent(route)}`,
      )
    }
  })

  test('the account menu offers Google sign-in', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Account menu' }).click()

    const menu = page.getByRole('menu', { name: 'Account' })
    await expect(
      menu.getByRole('menuitem', { name: 'Sign in with Google' }),
    ).toBeVisible()
    // Nothing behind the login wall is advertised while signed out.
    await expect(menu.getByRole('menuitem', { name: 'Trips' })).toHaveCount(0)
  })

  test('a failed code exchange shows the error banner, not the sign-in prompt', async ({
    page,
  }) => {
    await page.goto('/?signin=error')

    await expect(page.getByTestId('signin-banner')).toContainText(
      'could not complete that sign-in',
    )
  })

  test('the banner does not leak an off-site redirect into the sign-in form', async ({
    page,
  }) => {
    // safeNextPath must collapse a protocol-relative URL to '/'.
    await page.goto('/?signin=required&next=//evil.com')

    await expect(page.locator('input[name="next"]')).toHaveValue('/')
  })
})

test.describe('signed in', () => {
  test.use({ storageState: AUTH_STATE_FILE })

  test('protected routes render instead of redirecting', async ({ page }) => {
    for (const route of PROTECTED_ROUTES) {
      await page.goto(route)
      await expect(page).toHaveURL(route)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
  })

  test('the account menu shows the user and the signed-in destinations', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Account menu' }).click()

    const menu = page.getByRole('menu', { name: 'Account' })
    await expect(menu).toContainText(TEST_USER.email)
    await expect(menu.getByRole('menuitem', { name: 'Trips' })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeVisible()
    // The test user is not an admin, so the admin entry must not be offered.
    await expect(menu.getByRole('menuitem', { name: 'Admin' })).toHaveCount(0)
  })

  test('a non-admin is redirected away from /admin', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL('/')
  })

})

/**
 * Signing out is deliberately NOT in the shared-session block above: logout
 * deletes the session server-side, so reusing the suite's storageState here
 * would sign out every spec running in parallel. This block starts signed out
 * and mints a session of its own.
 */
test.describe('sign out', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('returns to the public home page and re-locks the routes', async ({
    page,
    context,
  }) => {
    await context.addCookies(await mintSessionCookies())

    await page.goto('/')
    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()

    // Wait on the session cookie actually being cleared, not on the URL: the
    // page is already at '/' when sign-out starts, so a toHaveURL('/') check
    // passes instantly and races the in-flight POST.
    await expect
      .poll(async () => (await context.cookies()).length, {
        message: 'sign-out should clear the Supabase session cookie',
      })
      .toBe(0)

    await expect(page).toHaveURL('/')

    // The session is genuinely gone, not just visually reset.
    await page.goto('/trips')
    await expect(page).toHaveURL('/?signin=required&next=%2Ftrips')
  })
})
