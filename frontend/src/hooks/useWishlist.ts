import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} from "../api/wishlist";
import { useAuth } from "../context/AuthContext";
import type { Listing } from "../types/Listing";

const WISHLIST_KEY = ["wishlist"];

/* Single source of truth for the signed-in user's saved listings. The query
 * runs once and components read `isSaved` / call `toggle` off the shared cache;
 * `toggle` updates optimistically and reconciles on settle. */
export function useWishlist() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: listings = [] } = useQuery({
    queryKey: WISHLIST_KEY,
    queryFn: getWishlist,
    enabled: isAuthenticated,
  });

  const savedIds = new Set(listings.map((l) => l._id));

  const toggleMutation = useMutation({
    mutationFn: ({ listing, saved }: { listing: Listing; saved: boolean }) =>
      saved ? removeFromWishlist(listing._id) : addToWishlist(listing._id),
    onMutate: async ({ listing, saved }) => {
      await queryClient.cancelQueries({ queryKey: WISHLIST_KEY });
      const previous = queryClient.getQueryData<Listing[]>(WISHLIST_KEY) ?? [];
      queryClient.setQueryData<Listing[]>(
        WISHLIST_KEY,
        saved
          ? previous.filter((l) => l._id !== listing._id)
          : [...previous, listing],
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(WISHLIST_KEY, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: WISHLIST_KEY });
    },
  });

  function isSaved(listingId: string) {
    return savedIds.has(listingId);
  }

  function toggle(listing: Listing) {
    toggleMutation.mutate({ listing, saved: savedIds.has(listing._id) });
  }

  return { listings, isSaved, toggle, isAuthenticated };
}
