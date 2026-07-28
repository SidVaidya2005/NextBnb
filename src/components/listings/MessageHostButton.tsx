'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { signInWithGoogle } from '@/lib/actions/auth'
import { getOrCreateThread } from '@/lib/actions/messages'

type Props = {
  listingId: string
  isSignedIn: boolean
  /** Names the host in the accessible label, where one is available. */
  hostName: string | null
}

/**
 * "Message host" — the only way a conversation starts in this build.
 *
 * Signed out it is a sign-in form rather than a hidden or disabled control,
 * reusing `SaveButton`'s exact arrangement: `project-overview.md` specifies that
 * a protected action taken while signed out sends the user through Google and
 * returns them where they were, and the `next` it carries keeps the query string
 * so arriving from a filtered search comes back to those results.
 *
 * Signed in it opens the thread and navigates. The action is idempotent — the
 * unique `(guest_id, host_id, listing_id)` constraint means a second click lands
 * on the same conversation — so a double click cannot fork the thread the way a
 * naive create would.
 *
 * The host never sees this: `/listings/[id]` omits it for its own listing, since
 * `message_threads_participants_differ` forbids messaging yourself.
 */
export function MessageHostButton({ listingId, isSignedIn, hostName }: Props) {
  if (!isSignedIn) {
    return <SignInToMessage hostName={hostName} />
  }
  return <OpenThread listingId={listingId} hostName={hostName} />
}

function OpenThread({ listingId, hostName }: Omit<Props, 'isSignedIn'>) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isOpening, startTransition] = useTransition()

  function onClick() {
    setError(null)

    startTransition(async () => {
      const result = await getOrCreateThread({ listingId })

      if (!result.ok) {
        setError(result.error)
        return
      }

      router.push(`/messages/${result.data.threadId}`)
    })
  }

  return (
    <div>
      <Button
        variant="secondary"
        onClick={onClick}
        disabled={isOpening}
        aria-label={hostName ? `Message ${hostName}` : 'Message the host'}
      >
        {isOpening ? 'Opening…' : 'Message host'}
      </Button>

      {error && (
        <p role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  )
}

function SignInToMessage({ hostName }: Pick<Props, 'hostName'>) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // The sign-in banner's own params are stripped, or signing in from here would
  // land the user back on a page still telling them to sign in — `SaveButton`'s
  // note, and the same fix.
  const query = new URLSearchParams(searchParams)
  query.delete('signin')
  query.delete('next')

  const search = query.toString()
  const next = `${pathname ?? '/'}${search ? `?${search}` : ''}`

  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <Button
        type="submit"
        variant="secondary"
        aria-label={hostName ? `Sign in to message ${hostName}` : 'Sign in to message the host'}
      >
        Message host
      </Button>
    </form>
  )
}
