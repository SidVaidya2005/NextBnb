'use client'

import { useEffect } from 'react'

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Route error boundary. Next requires this to be a Client Component.
 *
 * Queries already swallow their own failures and return a safe empty value, so
 * this catches the unexpected — a render-time throw — and keeps it from taking
 * the whole app down. The user sees a generic message; the detail goes to the
 * console, never to the page (`code-standards.md` → Error Handling).
 */
export default function Error({ error, reset }: Props) {
  useEffect(() => {
    console.error('[app/error] unhandled render error:', error.message)
  }, [error])

  return (
    <div className="mx-auto max-w-content px-6 py-16 tablet:px-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink tablet:text-[28px]">
        Something went wrong
      </h1>
      <p className="mt-4 max-w-xl text-base text-body">
        We could not load this page. Try again — if it keeps happening, come back
        in a little while.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 h-12 rounded-sm bg-primary px-6 text-base font-medium text-on-primary transition-colors hover:bg-primary-active"
      >
        Try again
      </button>
    </div>
  )
}
