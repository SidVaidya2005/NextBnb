import 'server-only'
import { v2 as cloudinary } from 'cloudinary'

// The ONLY place the Cloudinary Node SDK is configured — it holds
// CLOUDINARY_API_SECRET, so it must never be imported by a client component.
// `server-only` makes a client import a build-time error.
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export { cloudinary }

/**
 * Destroy one Cloudinary asset, never throwing.
 *
 * Always called *after* the row that referenced it is already gone, so the
 * database is correct either way and failing here would report a deletion the
 * user has already seen succeed. The orphan is logged instead — F09's journal
 * notes an orphan is a real possibility, since a timed-out cleanup leaves one.
 *
 * **It lives here rather than in `actions/listings.ts`, and that is a
 * requirement, not tidiness.** Both the host delete (F10) and the admin delete
 * (F17) need it, but a `'use server'` module turns every export into a callable
 * endpoint — exporting this from one would publish an unauthenticated route that
 * destroys any asset in the account given its `public_id`. This module is
 * `server-only` and carries no directive, so it can be shared without that.
 */
export async function destroyAsset(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true })
  } catch (cause) {
    console.error(
      '[lib/cloudinary] destroy failed for',
      publicId,
      cause instanceof Error ? cause.message : cause,
    )
  }
}
