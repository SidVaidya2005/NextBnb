import type { Listing } from "../../types/Listing";
import { ListingCard } from "./ListingCard";

/* Airbnb's marketplace grid: 4 columns at desktop, 16px gutters. */
export function ListingGrid({ listings }: { listings: Listing[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-base gap-y-xl sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {listings.map((listing) => (
        <ListingCard key={listing._id} listing={listing} />
      ))}
    </div>
  );
}
