'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

import { signInWithGoogle } from '@/lib/actions/auth'

type Props = {
  variant: 'required' | 'error'
  /** Where to send the user after signing in — the route they were bounced from. */
  next?: string
}

/**
 * The prompt a signed-out user sees after the proxy bounces them off a
 * protected route (`?signin=required`), or after a failed code exchange
 * (`?signin=error`). Deliberately an inline strip rather than a modal: no
 * scrim, focus trap, or scroll lock, and sign-in stays reachable from the
 * account menu regardless.
 */
export function SignInBanner({ variant, next = '/' }: Props) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const isError = variant === 'error'

  return (
    <div
      role="status"
      className="border-b border-hairline bg-surface-soft"
      data-testid="signin-banner"
    >
      <div className="mx-auto flex max-w-wide items-center gap-4 px-6 py-3 tablet:px-10">
        <p className={`flex-1 text-sm ${isError ? 'text-error' : 'text-body'}`}>
          {isError
            ? 'We could not complete that sign-in. Please try again.'
            : 'Sign in to continue to that page.'}
        </p>

        {!isError && (
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <button
              type="submit"
              className="h-10 shrink-0 rounded-sm bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-active"
            >
              Sign in with Google
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-strong hover:text-ink"
          aria-label="Dismiss"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
