import { LaurelLeft, LaurelRight } from '../common/Icon';

interface Props {
  rating: number;
  reviewCount: number;
}

/* The signature listing-detail moment — 64px rating number flanked by
 * laurel-wreath SVGs. The single typographically loud moment in the system. */
export function RatingDisplay({ rating, reviewCount }: Props) {
  return (
    <div className="flex flex-col items-center gap-md py-xl">
      <div className="flex items-end gap-md text-ink">
        <LaurelLeft size={72} />
        <div className="flex flex-col items-center">
          <span className="t-rating-display">{rating.toFixed(2)}</span>
          <span className="t-badge mt-xs">Guest favorite</span>
        </div>
        <LaurelRight size={72} />
      </div>
      <div className="flex items-center gap-xl t-caption text-ink-muted">
        <div className="flex flex-col items-center">
          <span className="t-display-sm text-ink">Top 5%</span>
          <span>of homes</span>
        </div>
        <span className="h-8 w-px bg-hairline" />
        <div className="flex flex-col items-center">
          <span className="t-display-sm text-ink">{reviewCount}</span>
          <span>reviews</span>
        </div>
      </div>
    </div>
  );
}
