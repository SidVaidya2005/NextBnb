import { Container } from "../components/layout/Container";
import { GoogleLoginButton } from "../components/auth/GoogleLoginButton";
import { GitHubLoginButton } from "../components/auth/GitHubLoginButton";

export function Login() {
  return (
    <Container>
      <div className="mx-auto flex max-w-md flex-col items-center gap-md py-xxl text-center">
        <h1 className="t-display-lg">Welcome to NextBnb</h1>
        <p className="t-body-md mb-lg text-ink-muted">
          Manage stays, trips, and your wishlist.
        </p>
        <div className="flex w-full flex-col gap-md">
          <GoogleLoginButton />
          <GitHubLoginButton />
        </div>
      </div>
    </Container>
  );
}
