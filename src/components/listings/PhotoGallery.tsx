import Image from 'next/image'
import { House } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ListingPhoto } from '@/lib/queries/listings'

// The mosaic is one large cell plus a 2×2 block beside it. Photos past this
// point stay in the mobile strip but are hidden from the grid, which has exactly
// two explicit rows — a sixth tile would spill into an implicit third and break
// the container's aspect ratio.
const MOSAIC_CAPACITY = 5

type Props = {
  photos: ListingPhoto[]
  /** Used to build each photo's alt text. */
  title: string
}

/**
 * The listing's photos: a 1-large + 4-small mosaic from `tablet:` up, and a
 * full-bleed swipeable strip below it.
 *
 * Both layouts render the **same DOM**, switched entirely by CSS — a `flex`
 * scroll container that becomes a `grid`. Two separate trees would be simpler to
 * read but would put every photo in the document twice, and a `display: none`
 * image is still an image the browser fetches.
 *
 * There are no position dots: tracking scroll offset needs JavaScript, and a set
 * of dots that never moves is worse than none. The next photo peeking past the
 * right edge is the affordance instead.
 *
 * Seed photos are external Unsplash URLs (`public_id = null`) so they render
 * through `next/image`; F09 adds the `publicId ? CldImage : Image` branch with
 * the first real upload.
 */
export function PhotoGallery({ photos, title }: Props) {
  if (photos.length === 0) {
    return (
      <div className="flex aspect-[2/1] w-full items-center justify-center rounded-md bg-surface-soft text-muted-soft">
        <House className="size-10" aria-hidden />
        <span className="sr-only">No photos for this stay yet</span>
      </div>
    )
  }

  const onlyPhoto = photos.length === 1

  return (
    <div
      // Mobile: bleeds past the page gutter into a snapping scroll strip.
      // tablet+: the same children become the mosaic.
      className="-mx-6 flex snap-x snap-mandatory gap-2 overflow-x-auto px-6 pb-2 tablet:mx-0 tablet:grid tablet:aspect-[2/1] tablet:grid-cols-4 tablet:grid-rows-2 tablet:overflow-hidden tablet:rounded-md tablet:px-0 tablet:pb-0"
      aria-label={`Photos of ${title}`}
    >
      {photos.map((photo, index) => (
        <div
          key={`${photo.url}-${index}`}
          className={cn(
            'relative aspect-[4/3] w-[88%] shrink-0 snap-center overflow-hidden rounded-md bg-surface-soft tablet:aspect-auto tablet:w-auto tablet:rounded-none',
            index === 0 && 'tablet:col-span-2 tablet:row-span-2',
            index === 0 && onlyPhoto && 'tablet:col-span-4',
            index >= MOSAIC_CAPACITY && 'tablet:hidden',
          )}
        >
          <Image
            src={photo.url}
            alt={index === 0 ? title : `${title} — photo ${index + 1}`}
            fill
            // The cover occupies half the 1080px content column at desktop and
            // the full viewport on a phone; the small tiles a quarter.
            sizes={
              index === 0
                ? '(max-width: 744px) 88vw, (max-width: 1128px) 50vw, 540px'
                : '(max-width: 744px) 88vw, (max-width: 1128px) 25vw, 270px'
            }
            // One of these is the LCP element on this route.
            priority={index === 0}
            className="object-cover"
          />
        </div>
      ))}
    </div>
  )
}
