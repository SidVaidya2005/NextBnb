'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CldUploadWidget } from 'next-cloudinary'
import { ArrowLeft, ArrowRight, Star, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { ListingImage } from '@/components/ui/ListingImage'
import {
  addListingPhoto,
  deleteListingPhoto,
  movePhoto,
  publishListing,
  setCoverPhoto,
} from '@/lib/actions/listings'
import { MAX_PHOTOS_PER_LISTING } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { listingPhotoFolder } from '@/lib/validations/listings'
import type { OwnListingPhoto } from '@/lib/queries/listings'

type Props = {
  listingId: string
  listingTitle: string
  photos: OwnListingPhoto[]
  isPublished: boolean
}

/**
 * Both are needed in the browser, and both **throw** when absent rather than
 * degrading — which takes the whole route down with them.
 *
 * The api_key is genuinely required client-side: `CldUploadWidget` sends it with
 * the signed upload so Cloudinary knows which account the signature belongs to.
 * It is a public identifier, not a credential — the SECRET does the authorising
 * and never leaves `/api/sign-cloudinary`.
 */
const UPLOAD_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
    process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
)

/** 44px — `code-standards.md`'s hard tap-target floor, not DESIGN.md's 32px. */
const TILE_BUTTON =
  'flex size-11 shrink-0 items-center justify-center rounded-full bg-canvas/90 text-ink backdrop-blur-sm transition hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:text-muted-soft'

/**
 * Step 2 of creating a listing: photos, then publish.
 *
 * Uploads go straight from the browser to Cloudinary, signed by
 * `/api/sign-cloudinary` — the API secret never reaches the client. The widget's
 * `folder` has to match that route's ownership regex exactly, which is why both
 * read it from `listingPhotoFolder` instead of building the string twice.
 *
 * Every mutation is its own server action followed by `router.refresh()`, rather
 * than local optimistic state. Unlike F08's heart, these actions revalidate the
 * page being looked at, so the server is the fastest correct source of the new
 * order — and reordering has no meaningful "wrong for a moment" state worth
 * inventing.
 */
export function PhotoManager({
  listingId,
  listingTitle,
  photos,
  isPublished,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const remaining = MAX_PHOTOS_PER_LISTING - photos.length
  const canPublish = photos.length > 0

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        setError(result.error ?? 'Something went wrong. Please try again.')
        return
      }
      router.refresh()
    })
  }

  function onPublish() {
    setError(null)
    startTransition(async () => {
      const result = await publishListing({ listingId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/listings/${listingId}`)
    })
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-ink">
            Photos{' '}
            <span className="text-base font-normal text-muted">
              ({photos.length} of {MAX_PHOTOS_PER_LISTING})
            </span>
          </h2>

          {UPLOAD_CONFIGURED ? (
            <CldUploadWidget
              signatureEndpoint="/api/sign-cloudinary"
              options={{
                // Must equal the folder /api/sign-cloudinary checks ownership
                // against, or the signature is rejected with nothing useful said.
                folder: listingPhotoFolder(listingId),
                multiple: true,
                maxFiles: Math.max(remaining, 1),
                sources: ['local'],
                clientAllowedFormats: ['png', 'jpeg', 'jpg', 'webp', 'avif'],
                maxFileSize: 10_000_000,
              }}
              onSuccess={async (result) => {
                const info = result?.info
                if (!info || typeof info === 'string') return

                const outcome = await addListingPhoto({
                  listingId,
                  url: info.secure_url,
                  publicId: info.public_id,
                })
                if (!outcome.ok) setError(outcome.error)
              }}
              // Refresh once the batch finishes rather than after each file, so
              // uploading five photos is one re-render, not five.
              onQueuesEnd={() => router.refresh()}
            >
              {({ open }) => (
                <Button
                  variant="secondary"
                  onClick={() => open()}
                  disabled={remaining <= 0 || pending}
                >
                  {remaining <= 0 ? 'Photo limit reached' : 'Upload photos'}
                </Button>
              )}
            </CldUploadWidget>
          ) : (
            <p className="text-sm text-error">
              Photo upload is unavailable: set
              NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and
              NEXT_PUBLIC_CLOUDINARY_API_KEY.
            </p>
          )}
        </div>

        {photos.length === 0 ? (
          <p className="rounded-md border border-dashed border-hairline px-6 py-12 text-center text-base text-muted">
            No photos yet. Add at least one before publishing.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
            {photos.map((photo, index) => (
              <li key={photo.id} className="space-y-2">
                <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface-soft">
                  <ListingImage
                    publicId={photo.publicId}
                    url={photo.url}
                    alt={`${listingTitle} — photo ${index + 1}`}
                    sizes="(max-width: 744px) 100vw, (max-width: 1128px) 50vw, 33vw"
                    className="object-cover"
                  />
                  {photo.isCover && (
                    <span className="absolute left-2 top-2 rounded-full bg-canvas px-2.5 py-1 text-[11px] font-semibold text-ink shadow-card">
                      Cover
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <button
                      type="button"
                      className={TILE_BUTTON}
                      disabled={index === 0 || pending}
                      aria-label={`Move photo ${index + 1} earlier`}
                      onClick={() =>
                        run(() =>
                          movePhoto({ listingId, photoId: photo.id, direction: 'earlier' }),
                        )
                      }
                    >
                      <ArrowLeft className="size-5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={TILE_BUTTON}
                      disabled={index === photos.length - 1 || pending}
                      aria-label={`Move photo ${index + 1} later`}
                      onClick={() =>
                        run(() =>
                          movePhoto({ listingId, photoId: photo.id, direction: 'later' }),
                        )
                      }
                    >
                      <ArrowRight className="size-5" aria-hidden />
                    </button>
                  </div>

                  <div className="flex items-center">
                    <button
                      type="button"
                      className={TILE_BUTTON}
                      disabled={photo.isCover || pending}
                      aria-label={
                        photo.isCover
                          ? `Photo ${index + 1} is the cover`
                          : `Make photo ${index + 1} the cover`
                      }
                      onClick={() => run(() => setCoverPhoto({ listingId, photoId: photo.id }))}
                    >
                      <Star
                        className={cn('size-5', photo.isCover && 'fill-current')}
                        aria-hidden
                      />
                    </button>
                    <button
                      type="button"
                      className={TILE_BUTTON}
                      disabled={pending}
                      aria-label={`Remove photo ${index + 1}`}
                      onClick={() =>
                        run(() => deleteListingPhoto({ listingId, photoId: photo.id }))
                      }
                    >
                      <Trash2 className="size-5" aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-hairline pt-6">
        {error && (
          <p role="alert" className="mb-4 text-sm text-error">
            {error}
          </p>
        )}

        {isPublished ? (
          <p className="text-base text-body">
            This listing is published and visible in search.
          </p>
        ) : (
          <>
            <Button
              onClick={onPublish}
              disabled={!canPublish || pending}
              className="w-full tablet:w-auto"
            >
              {pending ? 'Publishing…' : 'Publish listing'}
            </Button>
            {/* Stated, not merely disabled — a dead button with no reason is
                the thing users report as broken. */}
            <p className="mt-3 text-sm text-muted">
              {canPublish
                ? 'Your listing will appear in search straight away.'
                : 'Add at least one photo to publish.'}
            </p>
          </>
        )}
      </section>
    </div>
  )
}
