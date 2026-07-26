// Shared classes for the DESIGN.md `text-input` spec, in one place because
// three controls render to it (TextInput, Textarea, Select) and a copy in each
// would be three chances to drift.
//
// Focus is `border-ink` + a 1px ink ring rather than a 2px border. DESIGN.md
// asks for "the border thickens to 2px ink ... no glow, no ring" — thickening a
// real border reflows the control by a pixel on every focus, so the ring
// supplies the second pixel at the same colour with no blur and no offset. The
// rendered result is the 2px ink outline the spec describes; only the mechanism
// differs.
export const CONTROL_BASE =
  'w-full rounded-sm border border-hairline bg-canvas px-3 text-base text-ink placeholder:text-muted transition focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink disabled:bg-surface-soft disabled:text-muted'

/** 56px, the spec's `text-input` height — also clears the 44px tap floor. */
export const CONTROL_HEIGHT = 'h-14'

/** Applied when the field has an error, so the control shows it too. */
export const CONTROL_INVALID = 'border-error focus:border-error focus:ring-error'
