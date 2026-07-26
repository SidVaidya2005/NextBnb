import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

type Props = ComponentProps<'button'> & {
  /** `button-primary` (Rausch) or `button-secondary` (outlined). */
  variant?: 'primary' | 'secondary'
  fullWidth?: boolean
}

/**
 * DESIGN.md `button-primary` / `button-secondary`: 48px tall, 8px radius, 16px
 * label at weight 500.
 *
 * Rausch is one of the three uses DESIGN.md reserves the accent for, so
 * `primary` is for the single most important action on a screen — everything
 * else is `secondary`.
 */
export function Button({
  variant = 'primary',
  fullWidth = false,
  className,
  type = 'button',
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-12 items-center justify-center rounded-sm px-6 text-base font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed',
        variant === 'primary' &&
          'bg-primary text-on-primary hover:bg-primary-active disabled:bg-primary-disabled',
        variant === 'secondary' &&
          'border border-ink bg-canvas text-ink hover:bg-surface-soft disabled:border-hairline disabled:text-muted',
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    />
  )
}
