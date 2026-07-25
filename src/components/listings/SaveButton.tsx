'use client'

import { useState, useTransition } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Heart } from 'lucide-react'

import { signInWithGoogle } from '@/lib/actions/auth'
import { setFavorite } from '@/lib/actions/favorites'
import { cn } from '@/lib/utils'

type Props = {
  listingId: string
  /** The viewer's saved state as the server rendered it. */
  isFavorited: boolean
  isSignedIn: boolean
  /** Overrides the accessible name — the listing title, where one is available. */
  label?: string
}

// 44px, not DESIGN.md's 32px `icon-button-circle`. The spec itself calls 32px
// "borderline for AAA"; code-standards.md sets a hard 44px floor, so the floor
// wins and the 32px circle becomes the glyph inside it.
const BUTTON_CLASSES =
  'flex size-11 items-center justify-center rounded-full bg-canvas/85 backdrop-blur-sm transition hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

/**
 * The saved heart, on a listing card and over the listing gallery.
 *
 * Signed out it is a sign-in form, not a hidden control: `project-overview.md`
 * specifies that favoriting while signed out sends the user through Google and
 * returns them where they were. The `next` it carries includes the query string,
 * so hearting from a filtered search comes back to those same results.
 *
 * Signed in it holds its own state rather than using `useOptimistic`. Optimistic
 * state reverts to the server-rendered prop once the transition settles, and
 * `setFavorite` deliberately revalidates only `/favorites` — so on `/` the prop
 * never changes and a successful save would visibly snap back to unsaved.
 */
export function SaveButton({ listingId, isFavorited, isSignedIn, label }: Props) {
  if (!isSignedIn) {
    return <SignInToSave label={label} />
  }
  return <Toggle listingId={listingId} isFavorited={isFavorited} label={label} />
}

function Toggle({
  listingId,
  isFavorited,
  label,
}: Omit<Props, 'isSignedIn'>) {
  const [saved, setSaved] = useState(isFavorited)
  const [failed, setFailed] = useState(false)
  const [, startTransition] = useTransition()

  const suffix = label ? ` ${label}` : ''

  function onClick() {
    const next = !saved

    // Paint first, then reconcile. The action is idempotent, so a fast
    // double-click sends two requests that converge rather than racing.
    setSaved(next)
    setFailed(false)

    startTransition(async () => {
      const result = await setFavorite({ listingId, saved: next })
      if (!result.ok) {
        setSaved(!next)
        setFailed(true)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={saved ? `Remove${suffix} from favorites` : `Save${suffix} to favorites`}
        className={BUTTON_CLASSES}
      >
        <Heart
          className={cn(
            'size-6 transition',
            // Rausch when saved — one of the three uses DESIGN.md reserves it
            // for. Unsaved is an ink outline, never a grey fill.
            saved ? 'fill-primary text-primary' : 'fill-transparent text-ink',
          )}
          aria-hidden
        />
      </button>

      {/* Announced rather than rendered as a card-level banner: the failure is
          per-heart and the surrounding grid has nowhere sensible to put text. */}
      <span role="status" aria-live="polite" className="sr-only">
        {failed ? 'That stay could not be saved. Please try again.' : ''}
      </span>
    </>
  )
}

function SignInToSave({ label }: Pick<Props, 'label'>) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // The query string matters: hearting from a filtered search must return to
  // those results, not to a bare home page. usePathname() alone drops it.
  //
  // The sign-in banner's own params are stripped first, or signing in from a
  // heart on `/?signin=required` would land the user back on a page still
  // telling them to sign in.
  const query = new URLSearchParams(searchParams)
  query.delete('signin')
  query.delete('next')

  const search = query.toString()
  const next = `${pathname ?? '/'}${search ? `?${search}` : ''}`

  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        aria-label={label ? `Sign in to save ${label}` : 'Sign in to save this stay'}
        className={BUTTON_CLASSES}
      >
        <Heart className="size-6 fill-transparent text-ink" aria-hidden />
      </button>
    </form>
  )
}
