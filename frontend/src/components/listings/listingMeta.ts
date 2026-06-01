import type { Listing } from "../../types/Listing";

const DATE_RANGES = [
  "Nov 23 – 28",
  "Dec 1 – 6",
  "Dec 8 – 13",
  "Jan 5 – 10",
  "Feb 14 – 19",
  "Mar 2 – 7",
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

export interface ListingMeta {
  rating: number;
  reviewCount: number;
  isGuestFavorite: boolean;
  dates: string;
}

/* Deterministic visual-shell data — keyed off _id so the same listing
 * always shows the same rating/badge across renders. Replace with real
 * fields once review + wishlist services land. */
export function deriveListingMeta(listing: Listing): ListingMeta {
  const h = hashId(listing._id || listing.title);
  const rating = listing.rating ?? 4.5 + (h % 50) / 100;
  const reviewCount = listing.reviewCount ?? 12 + (h % 480);
  const isGuestFavorite = listing.isGuestFavorite ?? h % 3 === 0;
  const dates = listing.dates ?? DATE_RANGES[h % DATE_RANGES.length];
  return {
    rating: Math.round(rating * 100) / 100,
    reviewCount,
    isGuestFavorite,
    dates,
  };
}
