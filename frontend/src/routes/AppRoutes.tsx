import { Routes, Route, Navigate } from "react-router-dom";
import { ListingsIndex } from "../pages/ListingsIndex";
import { ListingShow } from "../pages/ListingShow";
import { ListingNew } from "../pages/ListingNew";
import { ListingEdit } from "../pages/ListingEdit";
import { Login } from "../pages/Login";
import { OAuthCallback } from "../pages/OAuthCallback";
import { Profile } from "../pages/Profile";
import { Bookings } from "../pages/Bookings";
import { Wishlist } from "../pages/Wishlist";
import { NotFound } from "../pages/NotFound";
import { ProtectedRoute } from "../components/auth/ProtectedRoute";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/listings" replace />} />
      <Route path="/listings" element={<ListingsIndex />} />
      <Route path="/listings/:id" element={<ListingShow />} />
      <Route path="/login" element={<Login />} />
      <Route path="/oauth" element={<OAuthCallback />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/listings/new" element={<ListingNew />} />
        <Route path="/listings/:id/edit" element={<ListingEdit />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/wishlist" element={<Wishlist />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
