'use client'

import Image from 'next/image'
import { CldImage } from 'next-cloudinary'

type Props = {
  /** Cloudinary public id, or null for an external (seed/Unsplash) row. */
  publicId: string | null
  /** The delivery URL — the only source for rows with no `public_id`. */
  url: string
  alt: string
  /** Required: it is what makes the responsive delivery real rather than nominal. */
  sizes: string
  priority?: boolean
  className?: string
}

/**
 * A listing photo, delivered the right way for whichever kind it is.
 *
 * The project holds two: Cloudinary assets uploaded by a host (`public_id` set)
 * and the curated Unsplash URLs the seed wrote directly (`public_id = null`).
 * `CldImage` can only transform the former — pointing it at an Unsplash URL
 * produces a broken fetch — so the branch is unavoidable.
 *
 * It lives here, once, rather than in `ListingCard` and `PhotoGallery`
 * separately: those two had carried a comment promising this branch since F05,
 * and duplicating it would be two places to forget `f_auto`/`q_auto`.
 *
 * Both branches take `fill`, so every caller positions the image with a
 * `relative` parent — which is what all three already did.
 *
 * **`'use client'` is required, not stylistic.** `CldImage` calls `useState`
 * internally, so importing it into a Server Component throws *"useState only
 * works in Client Components"* and the whole route 500s — including
 * `/listings/[id]`, whose gallery is server-rendered. The directive is placed
 * here, on the smallest possible leaf, so `ListingCard`, `PhotoGallery` and the
 * pages above them all stay Server Components. Both branches still
 * server-render; only their hydration is client-side.
 */
/**
 * Cloudinary refuses to build a delivery URL without this, and `CldImage`
 * signals that by **throwing** — which takes the whole route down with it.
 */
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

export function ListingImage({
  publicId,
  url,
  alt,
  sizes,
  priority = false,
  className,
}: Props) {
  // A missing cloud name is a deployment mistake, but it must not be a fatal
  // one: `CldImage` throws "A Cloudinary Cloud name is required", and because
  // this renders inside the listing page's gallery that error becomes a 500 on
  // every listing holding an uploaded photo. The stored `url` is Cloudinary's
  // own `secure_url` on the already-whitelisted `res.cloudinary.com`, so
  // falling back to it costs the `f_auto`/`q_auto` transforms and nothing else
  // — a heavier image instead of a dead page.
  if (publicId && CLOUD_NAME) {
    return (
      <CldImage
        src={publicId}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={className}
        // f_auto / q_auto — AVIF or WebP at a quality Cloudinary picks per image.
        format="auto"
        quality="auto"
        crop="fill"
        gravity="auto"
      />
    )
  }

  return (
    <Image
      src={url}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={className}
    />
  )
}
