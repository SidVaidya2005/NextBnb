import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listListings } from "../api/listings";
import { Container } from "../components/layout/Container";
import { ListingGrid } from "../components/listings/ListingGrid";
import { CityLinkGrid } from "../components/listings/CityLinkGrid";
import { SearchBarPill } from "../components/search/SearchBarPill";
import { EmptyState } from "../components/states/EmptyState";
import { LoadingState } from "../components/states/LoadingState";
import { ErrorState } from "../components/states/ErrorState";

const CATEGORIES = [
  "Villas",
  "Beachfront",
  "Cabins & Treehouses",
  "Top Cities",
  "Lakefront",
  "Tiny Homes",
  "Nature",
];

function CategoryStrip() {
  const [active, setActive] = useState(CATEGORIES[0]);
  return (
    <nav
      aria-label="Browse categories"
      className="flex gap-xl overflow-x-auto border-b border-hairline py-md md:justify-center md:gap-2xl"
    >
      {CATEGORIES.map((cat) => {
        const isActive = cat === active;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => setActive(cat)}
            className={`relative shrink-0 pb-3 t-caption transition-colors ${
              isActive ? "text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {cat}
            {isActive && (
              <span className="absolute -bottom-px left-0 right-0 h-[2px] rounded-full bg-ink" />
            )}
          </button>
        );
      })}
    </nav>
  );
}

export function ListingsIndex() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["listings"],
    queryFn: listListings,
  });

  return (
    <Container>
      <div className="flex justify-center py-lg">
        <SearchBarPill />
      </div>

      <CategoryStrip />

      <section className="py-xl">
        <h1 className="t-display-xl mb-xl">Inspiration for future getaways</h1>

        {isLoading && <LoadingState label="Loading stays…" />}
        {isError && (
          <ErrorState
            message="Could not load stays."
            onRetry={() => refetch()}
          />
        )}
        {data &&
          (data.length === 0 ? (
            <EmptyState title="No stays yet." body="Be the first to add one." />
          ) : (
            <ListingGrid listings={data} />
          ))}
      </section>

      <CityLinkGrid />
    </Container>
  );
}
