import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createListing } from "../api/listings";
import { Container } from "../components/layout/Container";
import {
  ListingForm,
  readListingForm,
} from "../components/listings/ListingForm";
import { ErrorState } from "../components/states/ErrorState";

export function ListingNew() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: createListing,
    onSuccess: (listing) => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      navigate(`/listings/${listing._id}`);
    },
  });

  return (
    <Container>
      <div className="mx-auto max-w-2xl py-xxl">
        <h1 className="t-display-lg mb-sm">Host a stay</h1>
        <p className="t-body-md mb-xl text-ink-muted">
          A few details and your home is ready to welcome guests.
        </p>
        {mutation.isError && (
          <div className="mb-lg">
            <ErrorState message="Could not create your listing. Please try again." />
          </div>
        )}
        <ListingForm
          submitLabel={mutation.isPending ? "Creating…" : "Create listing"}
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(readListingForm(e.currentTarget));
          }}
        />
      </div>
    </Container>
  );
}
