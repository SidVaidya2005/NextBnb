import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { listMyListings, deleteListing } from "../api/listings";
import { Container } from "../components/layout/Container";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/states/EmptyState";
import { LoadingState } from "../components/states/LoadingState";
import { ErrorState } from "../components/states/ErrorState";
import { handleListingImageError } from "../components/listings/listingMeta";
import type { Listing } from "../types/Listing";

const quickLinks = [
  { to: "/bookings", title: "Trips", body: "View and manage your bookings" },
  { to: "/wishlist", title: "Wishlists", body: "Homes you've saved" },
  { to: "/listings/new", title: "Become a host", body: "List your place" },
];

function ManageRow({ listing }: { listing: Listing }) {
  const queryClient = useQueryClient();
  const del = useMutation({
    mutationFn: () => deleteListing(listing._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });

  return (
    <div className="flex items-center gap-md rounded-md border border-hairline p-md">
      <Link
        to={`/listings/${listing._id}`}
        className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-sm bg-surface-soft sm:h-20 sm:w-20"
      >
        <img
          src={listing.image}
          alt={listing.title}
          onError={handleListingImageError(listing)}
          className="h-full w-full object-cover"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to={`/listings/${listing._id}`}
          className="t-title-sm block truncate"
        >
          {listing.title}
        </Link>
        {listing.location && (
          <p className="t-body-sm text-ink-muted truncate">
            {listing.location}
          </p>
        )}
        <p className="t-body-sm">
          <span className="font-semibold">
            ₹{listing.price.toLocaleString("en-IN")}
          </span>{" "}
          <span className="text-ink-muted">night</span>
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-md">
        <Link
          to={`/listings/${listing._id}/edit`}
          className="t-body-sm underline"
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Delete this listing? This can't be undone."))
              del.mutate();
          }}
          disabled={del.isPending}
          className="t-body-sm text-rausch underline disabled:opacity-50"
        >
          {del.isPending ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}

function MyListings() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-listings"],
    queryFn: listMyListings,
  });

  return (
    <section className="mt-xxl">
      <div className="mb-lg flex items-center justify-between gap-md">
        <h2 className="t-display-sm">Your listings</h2>
        <Link to="/listings/new">
          <Button size="sm">Add listing</Button>
        </Link>
      </div>
      {isLoading && <LoadingState />}
      {isError && (
        <ErrorState
          message="Could not load your listings."
          onRetry={() => refetch()}
        />
      )}
      {data &&
        (data.length === 0 ? (
          <EmptyState
            title="You haven't listed a home yet"
            body="Share your space and start hosting — your listings will appear here."
          />
        ) : (
          <div className="flex flex-col gap-md">
            {data.map((listing) => (
              <ManageRow key={listing._id} listing={listing} />
            ))}
          </div>
        ))}
    </section>
  );
}

export function Profile() {
  const { user } = useAuth();

  return (
    <Container>
      <div className="mx-auto max-w-3xl py-xxl">
        <h1 className="t-display-lg mb-xl">Account</h1>

        <Card className="flex flex-col items-start gap-lg p-lg sm:flex-row sm:items-center">
          <div className="h-20 w-20 overflow-hidden rounded-full bg-surface-soft">
            {user?.avatar && (
              <img
                src={user.avatar}
                alt={user.name ?? ""}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="flex-1">
            <h2 className="t-display-sm">{user?.name ?? "Welcome"}</h2>
            <p className="t-body-md text-ink-muted">{user?.email ?? "—"}</p>
            {user?.provider && (
              <p className="t-caption-sm mt-xs">
                Signed in via {user.provider}
              </p>
            )}
          </div>
        </Card>

        <div className="mt-xl grid grid-cols-1 gap-md sm:grid-cols-3">
          {quickLinks.map((link) => (
            <Link key={link.to} to={link.to}>
              <Card className="h-full p-lg transition-shadow hover:shadow-card">
                <h3 className="t-title-sm">{link.title}</h3>
                <p className="t-body-sm text-ink-muted mt-xxs">{link.body}</p>
              </Card>
            </Link>
          ))}
        </div>

        <MyListings />
      </div>
    </Container>
  );
}
