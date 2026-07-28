import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { MessageThread } from '@/components/messages/MessageThread'
import { ThreadList } from '@/components/messages/ThreadList'
import { Avatar } from '@/components/ui/Avatar'
import { ListingImage } from '@/components/ui/ListingImage'
import { getThreadById, getThreads } from '@/lib/queries/messages'
import { threadIdSchema } from '@/lib/validations/messages'
import type { ThreadDetail } from '@/lib/queries/messages'

// Next 16: params are async and must be awaited.
type Props = {
  params: Promise<{ threadId: string }>
}

/**
 * One conversation.
 *
 * **There is deliberately no `loading.tsx`** (F07's rule, and this is the first
 * route since `/listings/[id]` where it actually bites). That file wraps the page
 * in an implicit `<Suspense>`, so the response streams and the HTTP status
 * commits to 200 *before* `notFound()` runs — which would make every stranger's
 * thread a 200-OK page. See `code-standards.md` → Next.js Conventions.
 *
 * **The 404 is the database's decision.** `getThreadById` applies no participant
 * filter, so `message_threads_select_participant` is what returns nothing to
 * someone who is not in the conversation — and a thread that does not exist is
 * indistinguishable from one that is not yours, which is the point.
 */
export default async function ThreadPage({ params }: Props) {
  const { threadId } = await params

  // Rejected before the query, so a malformed link costs a 404 rather than a
  // logged Postgres `22P02` — `/listings/[id]`'s precedent.
  if (!threadIdSchema.safeParse(threadId).success) notFound()

  // In parallel: the rail does not depend on the thread. It is a second query on
  // this route rather than a shared `layout.tsx`, which could not know whether a
  // child route is active and so could not mark the open thread.
  const [thread, threads] = await Promise.all([
    getThreadById(threadId),
    getThreads(),
  ])
  if (!thread) notFound()

  return (
    <div className="mx-auto max-w-content px-6 py-6 tablet:px-10 tablet:py-10">
      <div className="grid grid-cols-1 gap-8 desktop:grid-cols-[320px_1fr]">
        {/* The rail returns at desktop:, where there is room for the inbox and
            the conversation at once. Below that the thread owns the screen and
            the back link is the way out — DESIGN.md's drop-columns behaviour. */}
        <aside className="hidden overflow-hidden rounded-md border border-hairline desktop:block">
          <ThreadList threads={threads} activeThreadId={thread.id} />
        </aside>

        <div className="flex min-h-0 flex-col">
          <Link
            href="/messages"
            className="inline-flex h-11 w-fit items-center gap-1 pr-3 text-sm font-medium text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink desktop:hidden"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Back to inbox
          </Link>

          <ThreadHeader thread={thread} />

          <MessageThread
            // Remounts on navigation between conversations, so the message state
            // seeded from the server cannot leak from one thread into the next.
            key={thread.id}
            threadId={thread.id}
            viewerId={thread.viewerId}
            initialMessages={thread.messages}
            partnerName={thread.partner.name}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Who you are talking to, and what about.
 *
 * The listing block is conditional twice over — see `ThreadListing`: the row's
 * `listing_id` may be null after a delete, and RLS hides an unpublished listing
 * from the guest. Either way the conversation still renders.
 */
function ThreadHeader({ thread }: { thread: ThreadDetail }) {
  return (
    <div className="flex items-center gap-3 border-b border-hairline pb-4">
      <Avatar avatarUrl={thread.partner.avatarUrl} name={thread.partner.name} size={48} />

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-semibold text-ink">
          {thread.partner.name}
        </h1>
        {thread.listing ? (
          <Link
            href={`/listings/${thread.listing.id}`}
            className="truncate text-sm text-muted hover:underline"
          >
            {thread.listing.title}
          </Link>
        ) : (
          <p className="truncate text-sm text-muted">Listing no longer available</p>
        )}
      </div>

      {thread.listing?.coverUrl && (
        <Link
          href={`/listings/${thread.listing.id}`}
          aria-hidden
          tabIndex={-1}
          className="relative hidden size-14 shrink-0 overflow-hidden rounded-sm tablet:block"
        >
          <ListingImage
            publicId={thread.listing.coverPublicId}
            url={thread.listing.coverUrl}
            alt=""
            sizes="56px"
            className="object-cover"
          />
        </Link>
      )}
    </div>
  )
}
