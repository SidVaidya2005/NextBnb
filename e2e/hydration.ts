import { expect, type Locator } from '@playwright/test'

/**
 * Waits until React owns this element, not just the server's HTML.
 *
 * **Every spec that clicks before hydration is a false result, and two F10 specs
 * were.** Before hydration a `type="button"` click does nothing at all (no
 * handler is attached yet), and a value typed into a field React is about to
 * re-assert from `defaultValues` is silently reverted — so clearing the title
 * and submitting *saved the original title and navigated away*, which looked
 * exactly like "the editor accepts a blank title". Neither failure mode is
 * visible in the markup, and both go away on a slower machine, which is the
 * definition of a flake that would have been blamed on the app.
 *
 * React attaches a `__reactProps$…` key to every host node it hydrates. That is
 * an internal, but it is the direct signal — far better than sleeping and
 * hoping, which is what the alternative amounts to.
 *
 * Shared rather than copied per spec file: F11 is the second feature to need it,
 * and two copies of a subtle wait is how one of them quietly stops matching what
 * React actually does.
 */
export async function waitForHydration(locator: Locator) {
  await expect
    .poll(
      () =>
        locator
          .first()
          .evaluate((element) =>
            Object.keys(element).some((key) => key.startsWith('__reactProps$')),
          ),
      { message: 'React never hydrated this element' },
    )
    .toBe(true)
}
