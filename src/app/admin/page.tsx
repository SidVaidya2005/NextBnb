import { redirect } from 'next/navigation'

import { FeaturePlaceholder } from '@/components/placeholder/FeaturePlaceholder'
import { getCurrentProfile } from '@/lib/queries/profiles'

/**
 * The proxy only guarantees a signed-in user on /admin — the admin check has to
 * live here, because doing it in the proxy would put a database round trip in
 * front of every request in the app. RLS (`is_admin()`) remains the real
 * backstop for the data itself; this is the route-level gate Feature 17 builds on.
 */
export default async function AdminPage() {
  const profile = await getCurrentProfile()
  if (!profile?.is_admin) redirect('/')

  return (
    <FeaturePlaceholder
      title="Admin"
      feature="17 Admin dashboard"
      description="Moderation for users, listings, and bookings. You are seeing this because your profile has is_admin set."
    />
  )
}
