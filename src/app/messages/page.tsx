import Link from 'next/link'

import { ThreadList } from '@/components/messages/ThreadList'
import { getThreads } from '@/lib/queries/messages'

/**
 * The signed-in user's conversations.
 *
 * `src/proxy.ts` guards the route, so anyone reaching this component has a
 * session — and `getThreads` re-reads it anyway, because a query whose scoping
 * depends on who is asking must not depend on the proxy being correct.
 *
 * Unlike `/trips` and `/host/reservations`, this page needs no explicit
 * participant filter: `message_threads_select_participant` is exactly
 * `guest_id = uid or host_id = uid`, which is the question the inbox asks. See
 * `getThreads` for why that is `getFavorites`' situation rather than F13's.
 *
 * The page awaits its one query directly: no `<Suspense>` (there is no shell
 * worth painting before a personal list) and no `loading.tsx` — this route
 * cannot 404, so F07's rule does not forbid one, but it gains nothing either.
 */
export default async function MessagesPage() {
  const threads = await getThreads()

  return (
    <div className="mx-auto max-w-content px-6 py-10 tablet:px-10">
      <h1 className="text-2xl font-bold tracking-tight text-ink tablet:text-[28px]">
        Messages
      </h1>

      {threads.length === 0 ? (
        <NoConversations />
      ) : (
        <div className="mt-8 overflow-hidden rounded-md border border-hairline">
          <ThreadList threads={threads} />
        </div>
      )}
    </div>
  )
}

/** Also the failed-read state: `getThreads` logs and returns an empty list. */
function NoConversations() {
  return (
    <div className="mt-8 rounded-md border border-hairline px-6 py-16 text-center">
      <p className="text-base font-semibold text-ink">No conversations yet</p>
      <p className="mt-2 text-sm text-muted">
        Message a host from any listing and the conversation will appear here.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-12 items-center rounded-sm bg-primary px-6 text-base font-medium text-on-primary hover:bg-primary-active"
      >
        Browse stays
      </Link>
    </div>
  )
}
