import { test, expect } from '@playwright/test'

test('home page renders the NextBnb nav shell', async ({ page }) => {
  await page.goto('/')

  // The nav logo is the persistent shell element.
  await expect(page.getByRole('link', { name: 'NextBnb home' })).toBeVisible()

  // The home placeholder heading proves the page tree rendered.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})
