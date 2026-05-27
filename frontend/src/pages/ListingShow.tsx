import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getListing } from '../api/listings';
import { Container } from '../components/layout/Container';
import { LoadingState } from '../components/states/LoadingState';
import { ErrorState } from '../components/states/ErrorState';
import { Button } from '../components/common/Button';
import { HeartButton } from '../components/listings/HeartButton';
import { RatingDisplay } from '../components/listings/RatingDisplay';
import { deriveListingMeta } from '../lib/listingMeta';

/* Photo banner up top, two-column body with sticky reservation rail on the
 * right, RatingDisplay below the gallery. Bottom-sticky reserve bar on
 * narrow widths. */
export function ListingShow() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['listings', id],
    queryFn: () => getListing(id!),
    enabled: Boolean(id),
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
          <ErrorState message="Could not load this stay." onRetry={() => refetch()} />
        </div>
      </Container>
    );
  }

  const meta = deriveListingMeta(data);
  const location = [data.location, data.country].filter(Boolean).join(', ');

  return (
    <>
      <Container width="narrow">
        <div className="pb-xl pt-lg">
          <h1 className="t-display-lg mb-sm">{data.title}</h1>
          <div className="flex flex-wrap items-center justify-between gap-md">
            <div className="t-body-sm text-ink">
              <span className="font-semibold">{meta.rating}</span> ·{' '}
              <a href="#reviews" className="underline">
                {meta.reviewCount} reviews
              </a>{' '}
              · <span className="underline">{location || 'Somewhere lovely'}</span>
            </div>
            <div className="flex items-center gap-md text-ink">
              <button type="button" className="t-body-sm underline">
                Share
              </button>
              <HeartButton size={18} />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl">
          <img src={data.image} alt={data.title} className="h-[480px] w-full object-cover" />
        </div>

        <div className="grid grid-cols-1 gap-xxl py-xl lg:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-xl">
            <section>
              <h2 className="t-display-sm mb-sm">Entire home in {location || 'town'}</h2>
              <p className="t-body-md text-ink-body whitespace-pre-line">
                {data.description || 'A place to rest, recharge, and explore.'}
              </p>
            </section>

            <section>
              <h2 className="t-display-md mb-md">What this place offers</h2>
              <ul className="grid grid-cols-1 gap-md sm:grid-cols-2">
                {['Wi-Fi', 'Kitchen', 'Free parking', 'Air conditioning', 'Washer', 'Workspace'].map(
                  (a) => (
                    <li key={a} className="t-body-md py-md">
                      {a}
                    </li>
                  ),
                )}
              </ul>
            </section>

            <section id="reviews" className="border-t border-hairline pt-xl">
              <RatingDisplay rating={meta.rating} reviewCount={meta.reviewCount} />
            </section>
          </div>

          <aside className="lg:sticky lg:top-[120px] lg:self-start">
            <div className="rounded-md border border-hairline bg-surface-canvas p-lg shadow-card-soft">
              <div className="mb-md flex items-baseline justify-between">
                <div>
                  <span className="t-display-md">₹{data.price.toLocaleString('en-IN')}</span>
                  <span className="t-body-md text-ink-muted"> night</span>
                </div>
                <span className="t-body-sm text-ink">
                  ★ {meta.rating} · {meta.reviewCount}
                </span>
              </div>

              <div className="mb-md grid grid-cols-2 overflow-hidden rounded-sm border border-hairline">
                <div className="border-r border-hairline p-md">
                  <div className="t-uppercase-tag">Check in</div>
                  <div className="t-body-sm text-ink">{meta.dates.split(' – ')[0]}</div>
                </div>
                <div className="p-md">
                  <div className="t-uppercase-tag">Check out</div>
                  <div className="t-body-sm text-ink">{meta.dates.split(' – ')[1] ?? '—'}</div>
                </div>
              </div>

              <div className="mb-md rounded-sm border border-hairline p-md">
                <div className="t-uppercase-tag">Guests</div>
                <div className="t-body-sm text-ink">1 guest</div>
              </div>

              <Button className="w-full">Reserve</Button>
              <p className="mt-sm t-caption-sm text-center">You won't be charged yet</p>

              <dl className="mt-lg flex flex-col gap-sm t-body-sm text-ink">
                <div className="flex justify-between">
                  <dt className="underline">₹{data.price.toLocaleString('en-IN')} × 5 nights</dt>
                  <dd>₹{(data.price * 5).toLocaleString('en-IN')}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="underline">Cleaning fee</dt>
                  <dd>₹1,200</dd>
                </div>
                <div className="flex justify-between border-t border-hairline pt-sm font-semibold">
                  <dt>Total</dt>
                  <dd>₹{(data.price * 5 + 1200).toLocaleString('en-IN')}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </Container>

      <div className="sticky bottom-0 z-30 border-t border-hairline bg-surface-canvas lg:hidden">
        <div className="mx-auto flex w-full max-w-[1080px] items-center gap-md px-lg py-md">
          <div className="flex-1">
            <div className="t-body-md">
              <span className="font-semibold">₹{data.price.toLocaleString('en-IN')}</span> night
            </div>
            <div className="t-body-sm text-ink-muted">{meta.dates}</div>
          </div>
          <Button>Reserve</Button>
        </div>
      </div>
    </>
  );
}
