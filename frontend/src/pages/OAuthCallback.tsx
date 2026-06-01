import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Container } from "../components/layout/Container";
import { LoadingState } from "../components/states/LoadingState";

// Landing route for the OAuth redirect. The backend signs a JWT and redirects to
// `${FRONTEND_URL}/oauth?token=...` (or `?error=...` on failure). We hand the token
// to AuthContext (which stashes it and verifies via /auth/me) and bounce home.
export function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  const token = searchParams.get("token");
  const error = searchParams.get("error");

  useEffect(() => {
    if (token) {
      login(token);
      navigate("/", { replace: true });
    } else {
      navigate(`/login?error=${error ?? "oauth"}`, { replace: true });
    }
  }, [token, error, login, navigate]);

  return (
    <Container>
      <LoadingState label="Signing you in…" />
    </Container>
  );
}
