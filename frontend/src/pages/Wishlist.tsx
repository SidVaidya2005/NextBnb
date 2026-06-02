import { useQuery } from "@tanstack/react-query";
import { getWishlist } from "../api/wishlist";
import { Container } from "../components/layout/Container";
import { EmptyState } from "../components/states/EmptyState";
import { LoadingState } from "../components/states/LoadingState";
import { ErrorState } from "../components/states/ErrorState";
import { ListingGrid } from "../components/listings/ListingGrid";

export function Wishlist() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["wishlist"],
    queryFn: getWishlist,
  });

  return (
    <Container>
      <div className="py-xxl">
        <h1 className="t-display-lg mb-xl">Wishlists</h1>
        {isLoading && <LoadingState />}
        {isError && (
          <ErrorState
            message="Could not load your wishlist."
            onRetry={() => refetch()}
          />
        )}
        {data &&
          (data.length === 0 ? (
            <EmptyState
              title="Create your first wishlist"
              body="As you search, tap the heart on any home to save it to a list."
            />
          ) : (
            <ListingGrid listings={data} />
          ))}
      </div>
    </Container>
  );
}
