import { Avatar } from '@/components/ui/Avatar'
import { formatMonthYear } from '@/lib/utils'
import type { ListingHost } from '@/lib/queries/listings'

type Props = {
  host: ListingHost
}

/**
 * DESIGN.md `host-card`: white surface, `rounded-md`, 24px padding.
 *
 * The spec's Superhost badge and response-rate stat are omitted because neither
 * exists in the data model — there is nothing to render them from. "Contact
 * host" belongs to F16, when there is a thread to open; a button that opens
 * nothing should not ship (F05's precedent with the saved heart).
 */
export function HostCard({ host }: Props) {
  const memberSince = formatMonthYear(host.memberSince)

  return (
    <div className="flex items-center gap-4 rounded-md border border-hairline bg-canvas p-6">
      <Avatar avatarUrl={host.avatarUrl} name={host.fullName ?? 'Host'} size={56} />
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-ink">
          Hosted by {host.fullName ?? 'a NextBnb host'}
        </p>
        {memberSince && (
          <p className="mt-0.5 text-sm text-muted">Member since {memberSince}</p>
        )}
      </div>
    </div>
  )
}
