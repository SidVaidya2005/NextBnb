import type { ComponentProps } from 'react'

import { CONTROL_BASE, CONTROL_HEIGHT, CONTROL_INVALID } from '@/components/ui/fieldStyles'
import { cn } from '@/lib/utils'

type Props = ComponentProps<'input'> & { invalid?: boolean }

/** DESIGN.md `text-input`. Pair with `Field` for the label and error. */
export function TextInput({ invalid = false, className, ...props }: Props) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(CONTROL_BASE, CONTROL_HEIGHT, invalid && CONTROL_INVALID, className)}
      {...props}
    />
  )
}
