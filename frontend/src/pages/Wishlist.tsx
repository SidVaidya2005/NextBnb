import { Container } from "../components/layout/Container";
import { EmptyState } from "../components/states/EmptyState";

export function Wishlist() {
  return (
    <Container>
      <div className="py-xxl">
        <h1 className="t-display-lg mb-xl">Wishlists</h1>
        <EmptyState
          title="Create your first wishlist"
          body="As you search, tap the heart on any home to save it to a list."
        />
      </div>
    </Container>
  );
}
