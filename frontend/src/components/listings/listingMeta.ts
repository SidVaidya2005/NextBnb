import type { SyntheticEvent } from "react";
import type { Listing } from "../../types/Listing";

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
}

/* Deterministic visual-shell data — keyed off _id so the same listing
 * always shows the same rating/badge across renders. Replace with real
 * fields once review + wishlist services land. */
export function deriveListingMeta(listing: Listing): ListingMeta {
  const h = hashId(listing._id || listing.title);
  const rating = listing.rating ?? 4.5 + (h % 50) / 100;
  const reviewCount = listing.reviewCount ?? 12 + (h % 480);
  const isGuestFavorite = listing.isGuestFavorite ?? h % 3 === 0;
  return {
    rating: Math.round(rating * 100) / 100,
    reviewCount,
    isGuestFavorite,
  };
}

// Deterministic, always-loading image used when a listing's primary URL fails to
// load (e.g. an unverified Unsplash link 404s). Keyed off the listing so it's
// stable across renders and unique per listing.
export function imageFallbackUrl(listing: Listing): string {
  const seed = encodeURIComponent(listing._id || listing.title);
  return `https://picsum.photos/seed/${seed}/800/800`;
}

// onError handler that swaps a broken image to its Picsum fallback exactly once
// (the data-flag guards against an error loop if the fallback itself fails).
export function handleListingImageError(listing: Listing) {
  return (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.dataset.fallback) return;
    img.dataset.fallback = "1";
    img.src = imageFallbackUrl(listing);
  };
}
