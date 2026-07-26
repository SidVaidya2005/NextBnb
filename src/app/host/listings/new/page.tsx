import type { Metadata } from 'next'
import Link from 'next/link'

import { ListingForm } from '@/components/host/ListingForm'

export const metadata: Metadata = {
  title: 'List your place · NextBnb',
}

/**
 * Step 1 of two. The page is a Server Component shell; only the form is a
 * client component, keeping `'use client'` at the leaf as `code-standards.md`
 * requires.
 *
 * No `loading.tsx` and no auth check here — `src/proxy.ts` already bounces a
 * signed-out visitor away from `/host/**`, and there is nothing to await, so
 * the route cannot 404 and has nothing to stream.
 */
export default function NewListingPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 tablet:px-10 tablet:py-16">
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/host/listings"
          className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          ← Your listings
        </Link>
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight text-ink tablet:text-[28px]">
        List your place
      </h1>
      <p className="mt-3 max-w-xl text-base text-body">
        Tell guests about your space. You will add photos on the next step.
      </p>

      <div className="mt-10">
        <ListingForm />
      </div>
    </div>
  )
}
