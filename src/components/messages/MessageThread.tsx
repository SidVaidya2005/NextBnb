'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'

import { Button } from '@/components/ui/Button'
import { markThreadRead, sendMessage } from '@/lib/actions/messages'
import { createClient } from '@/lib/supabase/client'
import { cn, formatThreadTimestamp } from '@/lib/utils'
import { MAX_MESSAGE_BODY } from '@/lib/validations/messages'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { ThreadMessage } from '@/lib/queries/messages'

type Props = {
  threadId: string
  /** Who is looking — decided on the server; never re-derived in the browser. */
  viewerId: string
  /** Oldest first, as `getThreadById` returns them. */
  initialMessages: ThreadMessage[]
  /** For the empty state and the live region's announcements. */
  partnerName: string
}

/**
 * One conversation: the messages, live delivery, the read receipt, and the
 * composer.
 *
 * **This is the feature's only client component**, and it is one rather than
 * three because all three jobs share the same message list. A separate composer
 * would have to lift that state up here anyway, and a separate subscriber would
 * need it to dedupe.
 *
 * State is seeded from `initialMessages` and then owned here — it deliberately
 * does **not** re-sync when the server re-renders. A server action re-renders the
 * current route by default, so re-syncing would fight the realtime appends every
 * time a message is sent. The page passes `key={threadId}`, so switching
 * conversations remounts rather than relying on that sync.
 */
export function MessageThread({
  threadId,
  viewerId,
  initialMessages,
  partnerName,
}: Props) {
  const [messages, setMessages] = useState(initialMessages)
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [isSending, startTransition] = useTransition()
  /**
   * Whether live delivery is actually connected.
   *
   * Real state, not a test hook. Subscribing is a round trip — read the session,
   * hand the socket its token, join the channel — so there is a window after the
   * page is interactive where a message sent by the other person would be
   * missed, and Postgres Changes does **not** replay what it missed. When the
   * channel never comes up at all, saying so beats a thread that silently stops
   * updating: F12's rule that showing unverified state is worse than showing none.
   */
  const [liveStatus, setLiveStatus] = useState<'connecting' | 'live' | 'offline'>(
    'connecting',
  )

  // One client for the component's lifetime. Building it inline would hand
  // `removeChannel` a different instance than the one that opened the channel.
  const supabase = useMemo(() => createClient(), [])
  const bottomRef = useRef<HTMLDivElement>(null)

  // Live delivery.
  //
  // **The socket has to be handed the access token before it subscribes, and
  // getting this wrong fails silently.** Realtime evaluates the `messages`
  // SELECT policy against whatever token the connection carries, and that policy
  // is `to authenticated` — so a socket opened before the browser client has
  // adopted the session from cookies connects as `anon`, matches nothing, and
  // reports no error at all. It looks exactly like a feature that simply does
  // not deliver. `setAuth` closes that race.
  //
  // `getSession()` here is **not** an authorization decision — code-standards.md
  // forbids that, and this is not one. It reads a token to hand to the socket;
  // the database still decides what that token may see.
  useEffect(() => {
    let cancelled = false
    let channel: RealtimeChannel | null = null

    async function subscribe() {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return

      await supabase.realtime.setAuth(data.session?.access_token)
      if (cancelled) return

      channel = supabase
        .channel(`messages:thread=${threadId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `thread_id=eq.${threadId}`,
          },
          (payload) => {
            const row = payload.new as {
              id: string
              sender_id: string
              body: string
              created_at: string
              read_at: string | null
            }

            setMessages((prev) => appendUnique(prev, toMessage(row)))

            // Our own INSERT comes back here too — the sender is subscribed to
            // the same channel. Only the other person's arrival is news.
            if (row.sender_id !== viewerId) {
              setAnnouncement(`New message from ${partnerName}`)
              void markThreadRead({ threadId })
            }
          },
        )
        .subscribe((status) => {
          // CLOSED also fires from `removeChannel` during cleanup, which would
          // be a state update on an unmounted component — hence the guard.
          if (cancelled) return
          if (status === 'SUBSCRIBED') setLiveStatus('live')
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setLiveStatus('offline')
          }
        })
    }

    void subscribe()

    return () => {
      // library-docs.md is explicit: leaked channels multiply on re-render. The
      // `cancelled` flag covers unmounting while the token is still in flight,
      // which would otherwise open a channel nothing ever removes.
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [supabase, threadId, viewerId, partnerName])

  // Opening the thread is what clears it. Fire-and-forget: `markThreadRead`
  // swallows its own failures, because a receipt that did not land must not stop
  // the conversation rendering.
  useEffect(() => {
    void markThreadRead({ threadId })
  }, [threadId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = body.trim()
    if (trimmed.length === 0) return

    setError(null)

    startTransition(async () => {
      const result = await sendMessage({ threadId, body: trimmed })

      if (!result.ok) {
        setError(result.error)
        return
      }

      // Painted from the returned row rather than waiting for the round trip
      // through Realtime. That same INSERT arrives moments later, which is what
      // `appendUnique` is for.
      setMessages((prev) => appendUnique(prev, result.data))
      setBody('')
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 py-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">
            No messages yet. Say hello to {partnerName}.
          </p>
        )}

        {/* A named list, not a bare stack of divs. The rail beside this renders
            the same text as a snippet, so without a scope to locate within, an
            assertion on a message body matches twice at `desktop:` — F15's "4.0
            is ambiguous on a listing page", arriving again. It also matches how
            every other list in the project is located. */}
        <ul aria-label="Messages" data-live={liveStatus} className="space-y-3">
          {messages.map((message) => (
            <li key={message.id}>
              <MessageBubble message={message} isOwn={message.senderId === viewerId} />
            </li>
          ))}
        </ul>
        <div ref={bottomRef} />
      </div>

      {liveStatus === 'offline' && (
        <p className="pb-2 text-sm text-muted">
          Live updates are unavailable. Reload to see new messages.
        </p>
      )}

      {/* Announced rather than rendered: the message itself is already on screen,
          so a visible banner would say it twice. */}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>

      <form
        onSubmit={onSubmit}
        className="sticky bottom-0 flex items-end gap-2 border-t border-hairline bg-canvas py-3"
      >
        <label htmlFor="message-body" className="sr-only">
          Message {partnerName}
        </label>
        <textarea
          id="message-body"
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={2}
          // The schema's cap, one number in both places: this form has no Zod
          // resolver, so the attribute is what stops input the action rejects.
          maxLength={MAX_MESSAGE_BODY}
          placeholder="Write a message"
          className="min-h-12 flex-1 resize-none rounded-sm border border-hairline px-4 py-3 text-base text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        />
        <Button type="submit" disabled={isSending || body.trim().length === 0}>
          {isSending ? 'Sending…' : 'Send'}
        </Button>
      </form>

      {error && (
        <p role="alert" className="pb-3 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  )
}

function MessageBubble({
  message,
  isOwn,
}: {
  message: ThreadMessage
  isOwn: boolean
}) {
  const timestamp = formatThreadTimestamp(message.createdAt)

  return (
    <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%] tablet:max-w-[70%]')}>
        <div
          className={cn(
            'rounded-md px-4 py-3 text-base',
            // Ink on soft grey for the other person, inverted for your own — no
            // accent. DESIGN.md keeps Rausch for CTAs, the orb and the heart.
            isOwn ? 'bg-ink text-canvas' : 'bg-surface-soft text-ink',
          )}
        >
          <p className="whitespace-pre-line break-words">{message.body}</p>
        </div>
        {timestamp && (
          <p
            className={cn(
              'mt-1 text-xs text-muted',
              isOwn ? 'text-right' : 'text-left',
            )}
          >
            {timestamp}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Append a message unless it is already present.
 *
 * The sender receives their own INSERT back over Realtime after having already
 * painted it from `sendMessage`'s return value, so without this every sent
 * message would appear twice. Keyed on `id`, which the database assigns, so the
 * optimistic copy and the broadcast copy are recognisably the same row.
 */
function appendUnique(
  messages: ThreadMessage[],
  incoming: ThreadMessage,
): ThreadMessage[] {
  if (messages.some((message) => message.id === incoming.id)) return messages
  return [...messages, incoming]
}

function toMessage(row: {
  id: string
  sender_id: string
  body: string
  created_at: string
  read_at: string | null
}): ThreadMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  }
}
