import { useSearchParams } from "react-router-dom";
import { Container } from "../components/layout/Container";
import { GoogleLoginButton } from "../components/auth/GoogleLoginButton";

export function Login() {
  const [searchParams] = useSearchParams();
  const hasError = searchParams.has("error");

  return (
    <Container>
      <div className="mx-auto flex max-w-md flex-col items-center gap-md py-xxl text-center">
        <h1 className="t-display-lg">Welcome to NextBnb</h1>
        <p className="t-body-md mb-lg text-ink-muted">
          Manage stays, trips, and your wishlist.
        </p>
        {hasError && (
          <p
            role="alert"
            className="t-body-sm w-full rounded-md bg-rausch/10 px-md py-sm text-rausch"
          >
            Sign-in failed. Please try again.
          </p>
        )}
        <div className="flex w-full flex-col gap-md">
          <GoogleLoginButton />
        </div>
      </div>
    </Container>
  );
}
