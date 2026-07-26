import type { ComponentProps } from 'react'
import { ChevronDown } from 'lucide-react'

import { CONTROL_BASE, CONTROL_HEIGHT, CONTROL_INVALID } from '@/components/ui/fieldStyles'
import { cn } from '@/lib/utils'

type Props = ComponentProps<'select'> & { invalid?: boolean }

/**
 * The `text-input` spec as a native `<select>`.
 *
 * Native rather than a custom listbox: it inherits keyboard behaviour, mobile
 * pickers and screen-reader support for free, and this project has no headless
 * primitive library (adding one needs `code-standards.md` updated first). The
 * platform arrow is suppressed so the chevron matches the rest of the system.
 */
export function Select({ invalid = false, className, children, ...props }: Props) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        className={cn(
          CONTROL_BASE,
          CONTROL_HEIGHT,
          'cursor-pointer appearance-none pr-10',
          invalid && CONTROL_INVALID,
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
    </div>
  )
}
