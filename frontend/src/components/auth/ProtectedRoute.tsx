import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function ProtectedRoute() {
  const { isAuthenticated, token } = useAuth();
  const location = useLocation();

  // If we have a token but the user is still loading, render an empty shell
  // (avoids flashing /login). Once the /auth/me roundtrip resolves,
  // isAuthenticated flips true or the token is cleared.
  if (token && !isAuthenticated) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
