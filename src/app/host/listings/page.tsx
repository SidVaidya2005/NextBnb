import Link from 'next/link'

import { FeaturePlaceholder } from '@/components/placeholder/FeaturePlaceholder'

/**
 * Still a placeholder — the grid of a host's own listings is F10. F09 only
 * gives it a working way in, so the "Your listings" breadcrumb the create flow
 * links back to is not a dead end.
 */
export default function HostListingsPage() {
  return (
    <FeaturePlaceholder
      title="Your listings"
      feature="10 Manage listings"
      description="Your own listings — published and drafts — with edit, publish, and delete. You can already create one."
      action={
        <Link
          href="/host/listings/new"
          className="inline-flex h-12 items-center justify-center rounded-sm bg-primary px-6 text-base font-medium text-on-primary transition hover:bg-primary-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          List your place
        </Link>
      }
    />
  )
}
