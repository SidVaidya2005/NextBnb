import { useAuth } from "../context/AuthContext";
import { Container } from "../components/layout/Container";
import { Card } from "../components/common/Card";

export function Profile() {
  const { user } = useAuth();

  return (
    <Container>
      <div className="mx-auto max-w-2xl py-xxl">
        <h1 className="t-display-lg mb-xl">Account</h1>
        <Card className="flex flex-col items-start gap-lg p-lg sm:flex-row sm:items-center">
          <div className="h-20 w-20 overflow-hidden rounded-full bg-surface-soft">
            {user?.avatar && (
              <img
                src={user.avatar}
                alt={user.name ?? ""}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="flex-1">
            <h2 className="t-display-sm">{user?.name ?? "Welcome"}</h2>
            <p className="t-body-md text-ink-muted">{user?.email ?? "—"}</p>
            {user?.provider && (
              <p className="t-caption-sm mt-xs">
                Signed in via {user.provider}
              </p>
            )}
          </div>
        </Card>
      </div>
    </Container>
  );
}
