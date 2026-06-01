import { Link } from "react-router-dom";
import type { Listing } from "../../types/Listing";
import { deriveListingMeta } from "../../lib/listingMeta";
import { Star } from "../common/Icon";
import { GuestFavoriteBadge } from "./GuestFavoriteBadge";
import { HeartButton } from "./HeartButton";

interface Props {
  listing: Listing;
}

/* Photo-first card: 1:1 image with rounded-md clipping, GuestFavoriteBadge
 * top-left, HeartButton top-right, meta block underneath with right-aligned
 * price. No card border or padding — the photo IS the card. */
export function ListingCard({ listing }: Props) {
  const meta = deriveListingMeta(listing);
  const location =
    [listing.location, listing.country].filter(Boolean).join(", ") ||
    "A place to stay";

  return (
    <Link to={`/listings/${listing._id}`} className="group block">
      <article className="flex flex-col gap-sm">
        <div className="relative aspect-square w-full overflow-hidden rounded-md bg-surface-soft">
          <img
            src={listing.image}
            alt={listing.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
          {meta.isGuestFavorite && (
            <GuestFavoriteBadge className="absolute left-md top-md" />
          )}
          <div className="absolute right-md top-md">
            <HeartButton />
          </div>
        </div>

        <div className="flex items-start justify-between gap-md pt-1">
          <h3 className="t-title-md truncate">{location}</h3>
          <span className="inline-flex shrink-0 items-center gap-1 t-body-sm text-ink">
            <Star size={12} className="text-ink" />
            {meta.rating}
          </span>
        </div>
        <p className="t-body-sm text-ink-muted truncate">{listing.title}</p>
        <p className="t-body-sm text-ink-muted">{meta.dates}</p>
        <p className="t-body-sm text-ink">
          <span className="font-semibold">
            ₹{listing.price.toLocaleString("en-IN")}
          </span>{" "}
          night
        </p>
      </article>
    </Link>
  );
}
