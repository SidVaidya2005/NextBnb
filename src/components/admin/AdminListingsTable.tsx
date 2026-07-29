import Link from 'next/link'

import { AdminListingActions } from '@/components/admin/AdminListingActions'
import {
  TABLE,
  TABLE_CELL,
  TABLE_CELL_NUMERIC,
  TABLE_CELL_PRIMARY,
  TABLE_HEAD_CELL,
  TABLE_SCROLL,
} from '@/components/admin/adminTableStyles'
import { Pill } from '@/components/ui/Pill'
import { cn, formatPrice } from '@/lib/utils'
import type { AdminListing } from '@/lib/queries/admin'

type Props = { listings: AdminListing[] }

/**
 * Every listing, published and draft, with the two moderation verbs.
 *
 * Drafts are included and marked. The `listings` SELECT policy returns them to an
 * admin (`is_published or host_id = uid or is_admin()`), and a spam listing is
 * most useful to catch before it is published — so hiding drafts here would hide
 * the moderation queue's best case. The Draft pill is the same one
 * `HostListingCard` uses, so the two surfaces say it identically.
 */
export function AdminListingsTable({ listings }: Props) {
  return (
    <div className={TABLE_SCROLL}>
      <table className={TABLE}>
        <caption className="sr-only">
          All listings, with controls to unpublish or delete each one
        </caption>
        <thead>
          <tr>
            <th scope="col" className={TABLE_HEAD_CELL}>
              Listing
            </th>
            <th scope="col" className={TABLE_HEAD_CELL}>
              Host
            </th>
            <th scope="col" className={TABLE_HEAD_CELL}>
              Location
            </th>
            <th scope="col" className={TABLE_HEAD_CELL}>
              Price
            </th>
            <th scope="col" className={TABLE_HEAD_CELL}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => (
            <tr key={listing.id}>
              <th scope="row" className={cn(TABLE_CELL, TABLE_CELL_PRIMARY)}>
                <span className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/listings/${listing.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {listing.title}
                  </Link>
                  {!listing.isPublished && <Pill>Draft</Pill>}
                </span>
              </th>
              <td className={TABLE_CELL}>{listing.hostName}</td>
              <td className={TABLE_CELL}>
                {listing.city}, {listing.country}
              </td>
              <td className={cn(TABLE_CELL, TABLE_CELL_NUMERIC)}>
                {formatPrice(listing.pricePerNight)}
              </td>
              <td className={TABLE_CELL}>
                <AdminListingActions
                  listingId={listing.id}
                  listingTitle={listing.title}
                  isPublished={listing.isPublished}
                  impact={listing.impact.sentence}
                  upcomingStays={listing.impact.upcomingStays}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
