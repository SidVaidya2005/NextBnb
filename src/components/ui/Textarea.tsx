import type { ComponentProps } from 'react'

import { CONTROL_BASE, CONTROL_INVALID } from '@/components/ui/fieldStyles'
import { cn } from '@/lib/utils'

type Props = ComponentProps<'textarea'> & { invalid?: boolean }

/**
 * The `text-input` spec at multi-line height. It takes `CONTROL_BASE` but not
 * `CONTROL_HEIGHT` — a fixed 56px would clip the second line.
 */
export function Textarea({ invalid = false, className, ...props }: Props) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL_BASE,
        'min-h-28 py-3.5 leading-relaxed',
        invalid && CONTROL_INVALID,
        className,
      )}
      {...props}
    />
  )
}
