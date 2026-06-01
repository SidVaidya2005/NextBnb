const CITIES = [
  { city: "Wilmington", category: "Cottage rentals" },
  { city: "Athens", category: "Beachfront stays" },
  { city: "Lisbon", category: "City apartments" },
  { city: "Reykjavík", category: "Cabin getaways" },
  { city: "Kyoto", category: "Ryokan stays" },
  { city: "Cape Town", category: "Villa rentals" },
  { city: "Tulum", category: "Beachfront stays" },
  { city: "Marrakech", category: "Riad rentals" },
  { city: "Banff", category: "Cabin getaways" },
  { city: "Bali", category: "Treehouse stays" },
  { city: "Edinburgh", category: "Loft rentals" },
  { city: "Buenos Aires", category: "Apartment stays" },
];

/* The homepage editorial footer-grid: 6 columns at desktop, each cell holds
 * a city name + a category sub-label. Static content for now — replace with
 * a curated/region-driven list once that data source exists. */
export function CityLinkGrid() {
  return (
    <section className="py-section">
      <h2 className="t-display-md mb-lg">Inspiration for future getaways</h2>
      <div className="grid grid-cols-2 gap-x-base gap-y-lg sm:grid-cols-3 lg:grid-cols-6">
        {CITIES.map((c) => (
          <a key={c.city} href="#" className="block group">
            <div className="t-title-md group-hover:underline">{c.city}</div>
            <div className="t-body-sm text-ink-muted">{c.category}</div>
          </a>
        ))}
      </div>
    </section>
  );
}
