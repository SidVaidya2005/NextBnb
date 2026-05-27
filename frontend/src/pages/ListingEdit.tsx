import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getListing } from '../api/listings';
import { Container } from '../components/layout/Container';
import { ListingForm } from '../components/listings/ListingForm';
import { LoadingState } from '../components/states/LoadingState';
import { ErrorState } from '../components/states/ErrorState';

export function ListingEdit() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['listings', id],
    queryFn: () => getListing(id!),
    enabled: Boolean(id),
  });

  return (
    <Container>
      <div className="mx-auto max-w-2xl py-xxl">
        <h1 className="t-display-lg mb-sm">Edit your stay</h1>
        <p className="t-body-md mb-xl text-ink-muted">Make it yours.</p>
        {isLoading && <LoadingState />}
        {isError && <ErrorState message="Could not load listing." onRetry={() => refetch()} />}
        {data && (
          <ListingForm
            initial={data}
            submitLabel="Save changes"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          />
        )}
      </div>
    </Container>
  );
}
