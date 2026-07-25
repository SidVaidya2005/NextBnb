import Image from 'next/image'
import { CircleUserRound } from 'lucide-react'

import { cn } from '@/lib/utils'

type Props = {
  /** Null for a profile that has never set one — seed guest Aiko Tanaka has none. */
  avatarUrl: string | null
  /** Used only for the fallback's accessible name; the image itself is decorative. */
  name: string
  /** Rendered pixel size; also the width requested from the image optimizer. */
  size?: number
  className?: string
}

/**
 * A circular profile image with an outline-icon fallback.
 *
 * `avatar_url` is nullable on every profile — Google supplies one, but a user
 * who signed up without it (or a seeded demo user) has none, and rendering a
 * broken image is worse than rendering an icon.
 *
 * The image is `alt=""`: the name it would announce is always printed next to it
 * on every surface that uses this, so alt text would make a screen reader say it
 * twice.
 */
export function Avatar({ avatarUrl, name, size = 40, className }: Props) {
  if (!avatarUrl) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full bg-surface-soft text-muted',
          className,
        )}
        style={{ width: size, height: size }}
      >
        <CircleUserRound style={{ width: size * 0.7, height: size * 0.7 }} aria-hidden />
        <span className="sr-only">{name}</span>
      </span>
    )
  }

  return (
    <Image
      src={avatarUrl}
      alt=""
      width={size}
      height={size}
      className={cn('shrink-0 rounded-full object-cover', className)}
      style={{ width: size, height: size }}
    />
  )
}
