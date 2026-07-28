import { MessageHostButton } from '@/components/listings/MessageHostButton'
import { Avatar } from '@/components/ui/Avatar'
import { formatMonthYear } from '@/lib/utils'
import type { ListingHost } from '@/lib/queries/listings'

type Props = {
  host: ListingHost
  listingId: string
  isSignedIn: boolean
  /**
   * True when the viewer hosts this listing. Hides the contact control, because
   * `message_threads_participants_differ` forbids a thread with yourself — and a
   * button whose only outcome is a refusal should not render.
   */
  isOwnListing: boolean
}

/**
 * DESIGN.md `host-card`: white surface, `rounded-md`, 24px padding.
 *
 * The spec's Superhost badge and response-rate stat are omitted because neither
 * exists in the data model — there is nothing to render them from.
 *
 * **"Contact host" arrived in F16**, which is what this docblock promised since
 * F07 ("a button that opens nothing should not ship"). It stacks below the
 * identity row on mobile and sits beside it from `tablet:`, so the card keeps one
 * line on a phone rather than reflowing into two columns.
 */
export function HostCard({ host, listingId, isSignedIn, isOwnListing }: Props) {
  const memberSince = formatMonthYear(host.memberSince)

  return (
    <div className="flex flex-col gap-4 rounded-md border border-hairline bg-canvas p-6 tablet:flex-row tablet:items-center tablet:justify-between">
      <div className="flex items-center gap-4">
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

      {!isOwnListing && (
        <MessageHostButton
          listingId={listingId}
          isSignedIn={isSignedIn}
          hostName={host.fullName}
        />
      )}
    </div>
  )
}
