import { Container } from '../components/layout/Container';
import { EmptyState } from '../components/states/EmptyState';

export function Bookings() {
  return (
    <Container>
      <div className="py-xxl">
        <h1 className="t-display-lg mb-xl">Trips</h1>
        <EmptyState title="No trips booked yet" body="When you book a stay, it'll appear here." />
      </div>
    </Container>
  );
}
