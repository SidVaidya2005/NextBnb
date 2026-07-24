import { cloudinary } from '@/lib/cloudinary'
import { createClient } from '@/lib/supabase/server'

// Only these keys may be signed — reject public_id, upload_preset, eager,
// notification_url, etc. Signing an attacker-supplied public_id/preset would let
// them overwrite arbitrary assets.
const ALLOWED_KEYS = new Set(['timestamp', 'folder', 'source'])

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { paramsToSign } = (await request.json()) as {
    paramsToSign: Record<string, unknown>
  }

  // 1. Whitelist keys.
  if (Object.keys(paramsToSign).some((k) => !ALLOWED_KEYS.has(k))) {
    return new Response('Forbidden parameter', { status: 403 })
  }

  // 2. Folder must be nextbnb/listings/<uuid> for a listing this user owns.
  const listingId = String(paramsToSign.folder ?? '').match(
    /^nextbnb\/listings\/([0-9a-f-]{36})$/,
  )?.[1]
  if (!listingId) return new Response('Bad folder', { status: 403 })

  const { data: listing } = await supabase
    .from('listings')
    .select('id')
    .eq('id', listingId)
    .eq('host_id', user.id)
    .single()
  if (!listing) return new Response('Forbidden', { status: 403 })

  // 3. Sign the validated params exactly as received.
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!,
  )
  return Response.json({ signature })
}
