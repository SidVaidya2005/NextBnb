import type { ReactNode } from 'react'

type Props = {
  /** Rendered as a real `<label>`, so clicking it focuses the control. */
  label: string
  /** Must match the control's `id`. */
  htmlFor: string
  error?: string
  hint?: string
  children: ReactNode
}

/**
 * Label, control, hint and error for one form field.
 *
 * The error is wired to the control by `aria-describedby` on the caller's side
 * (`id="<field>-error"`), so a screen reader announces the message with the
 * field rather than leaving it as loose text nearby. It renders in
 * `--color-error`, which DESIGN.md keeps distinct from Rausch on purpose — the
 * accent means "act", not "something is wrong".
 */
export function Field({ label, htmlFor, error, hint, children }: Props) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-medium text-ink"
      >
        {label}
      </label>

      {children}

      {hint && !error && <p className="mt-1.5 text-sm text-muted">{hint}</p>}

      {error && (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  )
}
