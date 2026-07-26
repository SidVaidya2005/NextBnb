import { expect, type Page } from '@playwright/test'
import { format, parseISO } from 'date-fns'

import { waitForHydration } from './hydration'

/**
 * Driving `DateRangePicker` from a spec.
 *
 * **Never locate a day cell with `.first()`.** The calendar always opens on the
 * current month, so the first cell is the 1st — which for most of any month is
 * in the past and therefore `disabled`. Playwright waits for actionability, so
 * clicking it does not fail fast with "this is disabled"; it hangs for the full
 * 30-second timeout and reports nothing about why. Address a day by its date.
 */

/** The calendar labels each cell with its full date, which is a stable and
 *  exact locator needing no test id. */
export function dayLabel(iso: string): string {
  return format(parseISO(iso), 'EEEE, d MMMM yyyy')
}

export const dayCell = (page: Page, iso: string) =>
  page.getByRole('button', { name: dayLabel(iso), exact: true })

/**
 * Click a day, walking the calendar forward until it is on screen.
 *
 * Forward only: a range's end is never before its start and the calendar opens
 * on the current month, so every caller moves in one direction. How many months
 * are visible at once depends on the viewport (one below `desktop:`, two above),
 * which is exactly why this loops rather than assuming.
 */
export async function pickDay(page: Page, iso: string) {
  const cell = dayCell(page, iso)
  const nextMonth = page.getByRole('button', { name: 'Next month', exact: true })

  // Month navigation is a client button too — before hydration it does nothing
  // and the loop below would exhaust its attempts against a static page (F10).
  await waitForHydration(nextMonth)

  for (let attempt = 0; attempt < 14 && (await cell.count()) === 0; attempt++) {
    await nextMonth.click()
  }

  await expect(cell, `${iso} never became reachable in the calendar`).toHaveCount(1)
  await cell.click()
}
