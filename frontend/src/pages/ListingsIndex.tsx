import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listListings } from "../api/listings";
import { Container } from "../components/layout/Container";
import { ListingGrid } from "../components/listings/ListingGrid";
import { SearchBarPill } from "../components/search/SearchBarPill";
import { EmptyState } from "../components/states/EmptyState";
import { LoadingState } from "../components/states/LoadingState";
import { ErrorState } from "../components/states/ErrorState";

// "All" clears the filter; the rest mirror the seed-data category tags in
// backend/init/data.js (categoriesFor). Keep the names in sync with both sides.
const CATEGORIES = [
  "All",
  "Villas",
  "Beachfront",
  "Cabins & Treehouses",
  "Top Cities",
  "Lakefront",
  "Tiny Homes",
  "Nature",
];

function CategoryStrip({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (category: string) => void;
}) {
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
            aria-pressed={isActive}
            onClick={() => onSelect(cat)}
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
  const [searchParams, setSearchParams] = useSearchParams();
  const where = searchParams.get("where") ?? "";
  const category = searchParams.get("category") ?? "";

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["listings", { where, category }],
    queryFn: () =>
      listListings({
        where: where || undefined,
        category: category || undefined,
      }),
  });

  // Update one filter at a time so destination + category can stack.
  function selectCategory(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next === "All") params.delete("category");
    else params.set("category", next);
    setSearchParams(params);
  }

  function clearWhere() {
    const params = new URLSearchParams(searchParams);
    params.delete("where");
    setSearchParams(params);
  }

  return (
    <Container>
      <div className="flex justify-center py-lg">
        <SearchBarPill />
      </div>

      <CategoryStrip active={category || "All"} onSelect={selectCategory} />

      <section className="py-xl">
        {where ? (
          <div className="mb-xl flex items-center gap-md">
            <h1 className="t-display-xl">Stays in “{where}”</h1>
            <button
              type="button"
              onClick={clearWhere}
              className="t-body-sm text-rausch underline"
            >
              Clear
            </button>
          </div>
        ) : (
          <h1 className="t-display-xl mb-xl">
            {category || "Inspiration for future getaways"}
          </h1>
        )}

        {isLoading && <LoadingState label="Loading stays…" />}
        {isError && (
          <ErrorState
            message="Could not load stays."
            onRetry={() => refetch()}
          />
        )}
        {data &&
          (data.length === 0 ? (
            <EmptyState
              title={
                where
                  ? `No stays match “${where}”.`
                  : category
                    ? "No stays in this category yet."
                    : "No stays yet."
              }
              body={
                where || category
                  ? "Try a different filter or clear it."
                  : "Be the first to add one."
              }
            />
          ) : (
            <ListingGrid listings={data} />
          ))}
      </section>
    </Container>
  );
}
