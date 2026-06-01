import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getListing, updateListing } from "../api/listings";
import type { NewListing } from "../types/Listing";
import { Container } from "../components/layout/Container";
import {
  ListingForm,
  readListingForm,
} from "../components/listings/ListingForm";
import { LoadingState } from "../components/states/LoadingState";
import { ErrorState } from "../components/states/ErrorState";

export function ListingEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["listings", id],
    queryFn: () => getListing(id!),
    enabled: Boolean(id),
  });

  const mutation = useMutation({
    mutationFn: (payload: NewListing) => updateListing(id!, payload),
    onSuccess: (listing) => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      navigate(`/listings/${listing._id}`);
    },
  });

  return (
    <Container>
      <div className="mx-auto max-w-2xl py-xxl">
        <h1 className="t-display-lg mb-sm">Edit your stay</h1>
        <p className="t-body-md mb-xl text-ink-muted">Make it yours.</p>
        {isLoading && <LoadingState />}
        {isError && (
          <ErrorState
            message="Could not load listing."
            onRetry={() => refetch()}
          />
        )}
        {mutation.isError && (
          <div className="mb-lg">
            <ErrorState message="Could not save your changes. Please try again." />
          </div>
        )}
        {data && (
          <ListingForm
            initial={data}
            submitLabel={mutation.isPending ? "Saving…" : "Save changes"}
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate(readListingForm(e.currentTarget));
            }}
          />
        )}
      </div>
    </Container>
  );
}
