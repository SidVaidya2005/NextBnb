type Props = {
  title: string
  /** The build-plan feature that replaces this page, e.g. "13 Trips". */
  feature: string
  description: string
}

/**
 * Stand-in body for a protected route whose real feature has not been built
 * yet. These exist so a signed-in user can never reach a 404 from their own
 * account menu; the owning feature deletes the page's import when it lands.
 */
export function FeaturePlaceholder({ title, feature, description }: Props) {
  return (
    <div className="mx-auto max-w-content px-6 py-16 tablet:px-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink tablet:text-[28px]">
        {title}
      </h1>
      <p className="mt-4 max-w-xl text-base text-body">{description}</p>
      <p className="mt-6 inline-block rounded-full bg-surface-soft px-4 py-2 text-sm font-medium text-muted">
        Arriving in Feature {feature}
      </p>
    </div>
  )
}
