import { Container } from "../components/layout/Container";
import { ListingForm } from "../components/listings/ListingForm";

export function ListingNew() {
  return (
    <Container>
      <div className="mx-auto max-w-2xl py-xxl">
        <h1 className="t-display-lg mb-sm">Host a stay</h1>
        <p className="t-body-md mb-xl text-ink-muted">
          A few details and your home is ready to welcome guests.
        </p>
        <ListingForm
          submitLabel="Create listing"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        />
      </div>
    </Container>
  );
}
