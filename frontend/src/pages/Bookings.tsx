import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listMyBookings, cancelBooking } from "../api/bookings";
import { Container } from "../components/layout/Container";
import { EmptyState } from "../components/states/EmptyState";
import { LoadingState } from "../components/states/LoadingState";
import { ErrorState } from "../components/states/ErrorState";
import type { BookingGuests, PopulatedBooking } from "../types/Booking";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatGuests(g?: BookingGuests) {
  if (!g) return null;
  const people = g.adults + g.children;
  const parts = [`${people} guest${people === 1 ? "" : "s"}`];
  if (g.infants > 0)
    parts.push(`${g.infants} infant${g.infants === 1 ? "" : "s"}`);
  if (g.pets > 0) parts.push(`${g.pets} pet${g.pets === 1 ? "" : "s"}`);
  return parts.join(", ");
}

const statusClass: Record<string, string> = {
  pending: "bg-surface-soft text-ink",
  confirmed: "bg-rausch/10 text-rausch",
  cancelled: "bg-surface-soft text-ink-muted line-through",
};

function TripCard({ booking }: { booking: PopulatedBooking }) {
  const queryClient = useQueryClient();
  const cancelMutation = useMutation({
    mutationFn: () => cancelBooking(booking._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
  const { listing } = booking;

  return (
    <div className="flex flex-col gap-md overflow-hidden rounded-md border border-hairline sm:flex-row">
      <Link
        to={`/listings/${listing._id}`}
        className="sm:w-64 sm:flex-shrink-0"
      >
        <img
          src={listing.image}
          alt={listing.title}
          className="h-48 w-full object-cover sm:h-full"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-sm p-lg">
        <div className="flex items-start justify-between gap-md">
          <Link to={`/listings/${listing._id}`} className="t-title-md">
            {listing.title}
          </Link>
          <span
            className={`t-uppercase-tag rounded-full px-sm py-xxs ${
              statusClass[booking.status] ?? "bg-surface-soft text-ink"
            }`}
          >
            {booking.status}
          </span>
        </div>
        <div className="t-body-sm text-ink-muted">
          {formatDate(booking.checkIn)} – {formatDate(booking.checkOut)}
        </div>
        {formatGuests(booking.guests) && (
          <div className="t-body-sm text-ink-muted">
            {formatGuests(booking.guests)}
          </div>
        )}
        <div className="t-body-md font-semibold">
          ₹{booking.totalPrice.toLocaleString("en-IN")} total
        </div>
        {booking.status !== "cancelled" && (
          <div className="mt-auto">
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Cancel this trip?"))
                  cancelMutation.mutate();
              }}
              disabled={cancelMutation.isPending}
              className="t-body-sm text-rausch underline disabled:opacity-50"
            >
              {cancelMutation.isPending ? "Cancelling…" : "Cancel"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Bookings() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["bookings"],
    queryFn: listMyBookings,
  });

  return (
    <Container>
      <div className="py-xxl">
        <h1 className="t-display-lg mb-xl">Trips</h1>
        {isLoading && <LoadingState />}
        {isError && (
          <ErrorState
            message="Could not load your trips."
            onRetry={() => refetch()}
          />
        )}
        {data &&
          (data.length === 0 ? (
            <EmptyState
              title="No trips booked yet"
              body="When you book a stay, it'll appear here."
            />
          ) : (
            <div className="flex flex-col gap-lg">
              {data.map((booking) => (
                <TripCard key={booking._id} booking={booking} />
              ))}
            </div>
          ))}
      </div>
    </Container>
  );
}
