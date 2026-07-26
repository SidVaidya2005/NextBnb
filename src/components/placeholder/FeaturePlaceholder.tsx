import type { ReactNode } from 'react'

type Props = {
  title: string
  /** The build-plan feature that replaces this page, e.g. "13 Trips". */
  feature: string
  description: string
  /**
   * Optional live control on an otherwise-stubbed page. `/host/listings` uses
   * it so someone who just created a listing is not sent to a dead end while
   * the grid itself waits for F10.
   */
  action?: ReactNode
}

/**
 * Stand-in body for a route whose real feature has not been built yet. These
 * exist so nothing the UI links to can 404 — the account menu's protected
 * destinations (Feature 04) and the listing cards' detail links (Feature 05).
 * The owning feature deletes the page's import when it lands.
 */
export function FeaturePlaceholder({
  title,
  feature,
  description,
  action,
}: Props) {
  return (
    <div className="mx-auto max-w-content px-6 py-16 tablet:px-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink tablet:text-[28px]">
        {title}
      </h1>
      <p className="mt-4 max-w-xl text-base text-body">{description}</p>

      {action && <div className="mt-8">{action}</div>}

      <p className="mt-6 inline-block rounded-full bg-surface-soft px-4 py-2 text-sm font-medium text-muted">
        Arriving in Feature {feature}
      </p>
    </div>
  )
}
