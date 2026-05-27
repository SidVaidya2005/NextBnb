import { Link } from 'react-router-dom';
import { Container } from '../components/layout/Container';
import { Button } from '../components/common/Button';

export function NotFound() {
  return (
    <Container>
      <div className="mx-auto flex max-w-md flex-col items-center gap-md py-xxl text-center">
        <h1 className="t-display-xl">404</h1>
        <p className="t-body-md text-ink-muted">We can&apos;t find that page.</p>
        <Link to="/" className="mt-md">
          <Button>Back to home</Button>
        </Link>
      </div>
    </Container>
  );
}
