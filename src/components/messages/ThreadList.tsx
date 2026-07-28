import Link from 'next/link'

import { Avatar } from '@/components/ui/Avatar'
import { cn, formatThreadTimestamp } from '@/lib/utils'
import type { ThreadSummary } from '@/lib/queries/messages'

type Props = {
  threads: ThreadSummary[]
  /**
   * The conversation currently open, when this renders as the desktop rail.
   * Undefined on `/messages`, where nothing is open.
   */
  activeThreadId?: string
}

/**
 * The inbox, used twice: full-width on `/messages`, and as the left rail beside
 * an open conversation at `desktop:`.
 *
 * One component for both because the row is identical — only the container's
 * width differs, and that belongs to the pages. The alternative was a
 * `messages/layout.tsx`, which cannot know whether a child route is active and
 * so cannot mark the open thread or hide itself on mobile.
 *
 * A Server Component: nothing here is interactive beyond a link.
 */
export function ThreadList({ threads, activeThreadId }: Props) {
  return (
    <ul aria-label="Conversations" className="divide-y divide-hairline">
      {threads.map((thread) => (
        <li key={thread.id}>
          <ThreadRow thread={thread} isActive={thread.id === activeThreadId} />
        </li>
      ))}
    </ul>
  )
}

function ThreadRow({
  thread,
  isActive,
}: {
  thread: ThreadSummary
  isActive: boolean
}) {
  const timestamp = formatThreadTimestamp(thread.lastMessageAt)
  const hasUnread = thread.unread > 0

  return (
    <Link
      href={`/messages/${thread.id}`}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        // py-4 + a 48px avatar clears the 44px tap floor in code-standards.md
        // with room to spare, which matters because the whole row is the target.
        'flex items-start gap-3 px-4 py-4 transition hover:bg-surface-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink',
        isActive && 'bg-surface-soft',
      )}
    >
      <Avatar avatarUrl={thread.partner.avatarUrl} name={thread.partner.name} size={48} />

      {/* min-w-0 is load-bearing: without it a flex child refuses to shrink past
          its content's intrinsic width and `truncate` never engages — the same
          trap that overlapped the mobile nav pill in F06. */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={cn(
              'truncate text-base text-ink',
              hasUnread ? 'font-semibold' : 'font-medium',
            )}
          >
            {thread.partner.name}
          </p>
          {timestamp && (
            <span className="shrink-0 text-sm text-muted">{timestamp}</span>
          )}
        </div>

        {thread.listing ? (
          <p className="truncate text-sm text-muted">{thread.listing.title}</p>
        ) : (
          // The listing is gone or no longer visible to this viewer. Saying so
          // beats an empty line that reads as a rendering fault.
          <p className="truncate text-sm text-muted">Listing no longer available</p>
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          <p
            className={cn(
              'truncate text-sm',
              hasUnread ? 'font-medium text-ink' : 'text-body',
            )}
          >
            {thread.snippet ?? 'No messages yet'}
          </p>

          {hasUnread && (
            <span
              // Ink, not Rausch. DESIGN.md reserves the accent for primary CTAs,
              // the search orb and the saved heart — the same restraint that puts
              // star ratings in ink rather than gold.
              className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-ink px-1.5 text-xs font-semibold text-canvas"
            >
              {thread.unread}
              <span className="sr-only"> unread messages</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
