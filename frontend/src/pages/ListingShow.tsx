import { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getListing, deleteListing } from "../api/listings";
import { createBooking } from "../api/bookings";
import {
  listReviewsForListing,
  createReview,
  deleteReview,
} from "../api/reviews";
import { useAuth } from "../context/AuthContext";
import { Container } from "../components/layout/Container";
import { LoadingState } from "../components/states/LoadingState";
import { ErrorState } from "../components/states/ErrorState";
import { Button } from "../components/common/Button";
import { HeartButton } from "../components/listings/HeartButton";
import { RatingDisplay } from "../components/listings/RatingDisplay";
import { handleListingImageError } from "../components/listings/listingMeta";
import {
  DateRangeCalendar,
  type DateRange,
} from "../components/search/DateRangeCalendar";
import { GuestSelector, type Guests } from "../components/search/GuestSelector";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function formatDay(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function guestLabel(g: Guests) {
  const guests = g.adults + g.children;
  const parts = [`${guests} guest${guests === 1 ? "" : "s"}`];
  if (g.infants > 0)
    parts.push(`${g.infants} infant${g.infants === 1 ? "" : "s"}`);
  if (g.pets > 0) parts.push(`${g.pets} pet${g.pets === 1 ? "" : "s"}`);
  return parts.join(", ");
}

function reserveErrorMessage(error: unknown): string | null {
  if (!error) return null;
  const e = error as { response?: { data?: { error?: string } } };
  return e.response?.data?.error ?? "Could not reserve those dates.";
}

function formatReviewDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/* Photo banner up top, two-column body with sticky reservation rail on the
 * right, RatingDisplay below the gallery. Bottom-sticky reserve bar on
 * narrow widths. */
export function ListingShow() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const [guests, setGuests] = useState<Guests>({
    adults: 1,
    children: 0,
    infants: 0,
    pets: 0,
  });
  const [openPanel, setOpenPanel] = useState<"dates" | "guests" | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  useEffect(() => {
    if (!openPanel) return;
    function onPointerDown(e: MouseEvent) {
      if (railRef.current && !railRef.current.contains(e.target as Node))
        setOpenPanel(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenPanel(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openPanel]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["listings", id],
    queryFn: () => getListing(id!),
    enabled: Boolean(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteListing(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      navigate("/");
    },
  });

  const reserveMutation = useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      navigate("/bookings");
    },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", id],
    queryFn: () => listReviewsForListing(id!),
    enabled: Boolean(id),
  });

  function invalidateAfterReviewChange() {
    queryClient.invalidateQueries({ queryKey: ["reviews", id] });
    queryClient.invalidateQueries({ queryKey: ["listings", id] });
    queryClient.invalidateQueries({ queryKey: ["listings"] });
  }

  const reviewMutation = useMutation({
    mutationFn: createReview,
    onSuccess: () => {
      setReviewComment("");
      setReviewRating(5);
      invalidateAfterReviewChange();
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: (reviewId: string) => deleteReview(reviewId),
    onSuccess: invalidateAfterReviewChange,
  });

  if (isLoading) {
    return (
      <Container width="narrow">
        <div className="py-xxl">
          <LoadingState />
        </div>
      </Container>
    );
  }
  if (isError || !data) {
    return (
      <Container width="narrow">
        <div className="py-xxl">
          <ErrorState
            message="Could not load this stay."
            onRetry={() => refetch()}
          />
        </div>
      </Container>
    );
  }

  const location = [data.location, data.country].filter(Boolean).join(", ");
  const isOwner = Boolean(user && data.owner && user._id === data.owner);

  const reviewCount = data.reviewCount ?? 0;
  const rating = data.rating ?? 0;
  const hasReviews = reviewCount > 0;
  const ratingLabel = hasReviews ? rating.toFixed(2) : "New";

  const nights =
    range.start && range.end
      ? Math.round((range.end.getTime() - range.start.getTime()) / MS_PER_DAY)
      : 0;
  const total = nights * data.price;
  const canReserve = nights > 0 && !reserveMutation.isPending;

  function handleReserve() {
    if (!data) return;
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (!range.start || !range.end) {
      setOpenPanel("dates");
      return;
    }
    reserveMutation.mutate({
      listingId: data._id,
      checkIn: range.start.toISOString(),
      checkOut: range.end.toISOString(),
      guests,
    });
  }

  return (
    <>
      <Container width="narrow">
        <div className="pb-xl pt-lg">
          <h1 className="t-display-lg mb-sm">{data.title}</h1>
          <div className="flex flex-wrap items-center justify-between gap-md">
            <div className="t-body-sm text-ink">
              <span className="font-semibold">{ratingLabel}</span>
              {hasReviews && (
                <>
                  {" "}
                  ·{" "}
                  <a href="#reviews" className="underline">
                    {reviewCount} reviews
                  </a>
                </>
              )}{" "}
              ·{" "}
              <span className="underline">
                {location || "Somewhere lovely"}
              </span>
            </div>
            <div className="flex items-center gap-md text-ink">
              {isOwner && (
                <>
                  <Link
                    to={`/listings/${data._id}/edit`}
                    className="t-body-sm underline"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Delete this listing?"))
                        deleteMutation.mutate();
                    }}
                    disabled={deleteMutation.isPending}
                    className="t-body-sm text-rausch underline disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? "Deleting…" : "Delete"}
                  </button>
                </>
              )}
              <button type="button" className="t-body-sm underline">
                Share
              </button>
              <HeartButton listing={data} size={18} />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl">
          <img
            src={data.image}
            alt={data.title}
            onError={handleListingImageError(data)}
            className="h-[480px] w-full object-cover"
          />
        </div>

        <div className="grid grid-cols-1 gap-xxl py-xl lg:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-xl">
            <section>
              <h2 className="t-display-sm mb-sm">
                Entire home in {location || "town"}
              </h2>
              <p className="t-body-md text-ink-body whitespace-pre-line">
                {data.description || "A place to rest, recharge, and explore."}
              </p>
            </section>

            <section>
              <h2 className="t-display-md mb-md">What this place offers</h2>
              <ul className="grid grid-cols-1 gap-md sm:grid-cols-2">
                {[
                  "Wi-Fi",
                  "Kitchen",
                  "Free parking",
                  "Air conditioning",
                  "Washer",
                  "Workspace",
                ].map((a) => (
                  <li key={a} className="t-body-md py-md">
                    {a}
                  </li>
                ))}
              </ul>
            </section>

            <section id="reviews" className="border-t border-hairline pt-xl">
              {hasReviews ? (
                <RatingDisplay rating={rating} reviewCount={reviewCount} />
              ) : (
                <h2 className="t-display-md mb-md">
                  No reviews yet — be the first
                </h2>
              )}

              {reviews.length > 0 && (
                <div className="mt-lg flex flex-col">
                  {reviews.map((r) => (
                    <div key={r._id} className="border-t border-hairline py-md">
                      <div className="flex items-center justify-between">
                        <span className="t-body-md font-semibold">
                          {r.author?.name || "Guest"}
                        </span>
                        <span className="t-body-sm text-ink-muted">
                          {formatReviewDate(r.createdAt)}
                        </span>
                      </div>
                      <div className="t-body-sm text-rausch">
                        {"★".repeat(r.rating)}
                        <span className="text-ink-muted">
                          {"★".repeat(5 - r.rating)}
                        </span>
                      </div>
                      {r.comment && (
                        <p className="t-body-md text-ink-body">{r.comment}</p>
                      )}
                      {user?._id === r.author?._id && (
                        <button
                          type="button"
                          onClick={() => deleteReviewMutation.mutate(r._id)}
                          disabled={deleteReviewMutation.isPending}
                          className="mt-xs t-body-sm text-rausch underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isAuthenticated ? (
                <form
                  className="mt-lg flex flex-col gap-sm border-t border-hairline pt-lg"
                  onSubmit={(e) => {
                    e.preventDefault();
                    reviewMutation.mutate({
                      listing: data._id,
                      rating: reviewRating,
                      comment: reviewComment.trim() || undefined,
                    });
                  }}
                >
                  <h3 className="t-title-md">Leave a review</h3>
                  <label className="t-body-sm flex items-center gap-sm">
                    Rating
                    <select
                      value={reviewRating}
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                      className="rounded-sm border border-hairline px-sm py-xs"
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} star{n === 1 ? "" : "s"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Share your experience"
                    rows={3}
                    className="rounded-sm border border-hairline p-md t-body-sm"
                  />
                  <div>
                    <Button type="submit" disabled={reviewMutation.isPending}>
                      {reviewMutation.isPending ? "Posting…" : "Post review"}
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="mt-lg t-body-sm text-ink-muted">
                  <Link to="/login" className="underline">
                    Sign in
                  </Link>{" "}
                  to leave a review.
                </p>
              )}
            </section>
          </div>

          <aside className="lg:sticky lg:top-[120px] lg:self-start">
            <div
              ref={railRef}
              className="relative rounded-md border border-hairline bg-surface-canvas p-lg shadow-card-soft"
            >
              <div className="mb-md flex items-baseline justify-between">
                <div>
                  <span className="t-display-md">
                    ₹{data.price.toLocaleString("en-IN")}
                  </span>
                  <span className="t-body-md text-ink-muted"> night</span>
                </div>
                <span className="t-body-sm text-ink">
                  {hasReviews ? `★ ${ratingLabel} · ${reviewCount}` : "New"}
                </span>
              </div>

              <div className="mb-md grid grid-cols-2 overflow-hidden rounded-sm border border-hairline">
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={openPanel === "dates"}
                  onClick={() =>
                    setOpenPanel((p) => (p === "dates" ? null : "dates"))
                  }
                  className="border-r border-hairline p-md text-left hover:bg-surface-soft"
                >
                  <div className="t-uppercase-tag">Check in</div>
                  <div className="t-body-sm text-ink">
                    {range.start ? formatDay(range.start) : "Add date"}
                  </div>
                </button>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={openPanel === "dates"}
                  onClick={() =>
                    setOpenPanel((p) => (p === "dates" ? null : "dates"))
                  }
                  className="p-md text-left hover:bg-surface-soft"
                >
                  <div className="t-uppercase-tag">Check out</div>
                  <div className="t-body-sm text-ink">
                    {range.end ? formatDay(range.end) : "Add date"}
                  </div>
                </button>
              </div>

              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={openPanel === "guests"}
                onClick={() =>
                  setOpenPanel((p) => (p === "guests" ? null : "guests"))
                }
                className="mb-md w-full rounded-sm border border-hairline p-md text-left hover:bg-surface-soft"
              >
                <div className="t-uppercase-tag">Guests</div>
                <div className="t-body-sm text-ink">{guestLabel(guests)}</div>
              </button>

              {openPanel === "dates" && (
                <div
                  role="dialog"
                  aria-label="Choose dates"
                  className="absolute right-0 top-[150px] z-30 mt-sm max-w-[calc(100vw-32px)] rounded-xl border border-hairline bg-surface-canvas p-lg shadow-card"
                >
                  <DateRangeCalendar value={range} onChange={setRange} />
                </div>
              )}

              {openPanel === "guests" && (
                <div
                  role="dialog"
                  aria-label="Choose guests"
                  className="absolute right-0 top-[230px] z-30 mt-sm max-w-[calc(100vw-32px)] rounded-xl border border-hairline bg-surface-canvas p-lg shadow-card"
                >
                  <GuestSelector value={guests} onChange={setGuests} />
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleReserve}
                disabled={isAuthenticated && !canReserve}
              >
                {reserveMutation.isPending ? "Reserving…" : "Reserve"}
              </Button>
              <p className="mt-sm t-caption-sm text-center">
                You won't be charged yet
              </p>

              {reserveMutation.isError && (
                <p className="mt-sm t-body-sm text-center text-rausch">
                  {reserveErrorMessage(reserveMutation.error)}
                </p>
              )}

              {nights > 0 && (
                <dl className="mt-lg flex flex-col gap-sm t-body-sm text-ink">
                  <div className="flex justify-between">
                    <dt className="underline">
                      ₹{data.price.toLocaleString("en-IN")} × {nights} night
                      {nights === 1 ? "" : "s"}
                    </dt>
                    <dd>₹{total.toLocaleString("en-IN")}</dd>
                  </div>
                  <div className="flex justify-between border-t border-hairline pt-sm font-semibold">
                    <dt>Total</dt>
                    <dd>₹{total.toLocaleString("en-IN")}</dd>
                  </div>
                </dl>
              )}
            </div>
          </aside>
        </div>
      </Container>

      <div className="sticky bottom-0 z-30 border-t border-hairline bg-surface-canvas lg:hidden">
        <div className="mx-auto flex w-full max-w-[1080px] items-center gap-md px-lg py-md">
          <div className="flex-1">
            <div className="t-body-md">
              <span className="font-semibold">
                ₹{data.price.toLocaleString("en-IN")}
              </span>{" "}
              night
            </div>
            <div className="t-body-sm text-ink-muted">
              {nights > 0
                ? `${nights} night${nights === 1 ? "" : "s"} · ₹${total.toLocaleString("en-IN")}`
                : "Add dates"}
            </div>
          </div>
          <Button
            onClick={handleReserve}
            disabled={isAuthenticated && !canReserve}
          >
            {reserveMutation.isPending ? "Reserving…" : "Reserve"}
          </Button>
        </div>
      </div>
    </>
  );
}
