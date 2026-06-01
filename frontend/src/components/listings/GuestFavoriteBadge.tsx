/* White floating pill — "Guest favorite". Sits over the listing photo,
 * top-left. Uses the single elevation token. */
export function GuestFavoriteBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-surface-canvas px-3 py-1.5 t-badge shadow-card-soft ${className}`}
    >
      Guest favorite
    </span>
  );
}
