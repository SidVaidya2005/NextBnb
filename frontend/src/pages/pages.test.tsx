import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Login } from "./Login";
import { ListingNew } from "./ListingNew";
import { ListingEdit } from "./ListingEdit";
import { Bookings } from "./Bookings";
import { Wishlist } from "./Wishlist";
import { Profile } from "./Profile";
import { AuthProvider } from "../context/AuthContext";
import { TOKEN_KEY } from "../api/client";

vi.mock("../api/listings", () => ({
  createListing: vi.fn(),
  updateListing: vi.fn(),
  getListing: vi.fn(),
  listListings: vi.fn(),
  listMyListings: vi.fn(),
  deleteListing: vi.fn(),
}));

vi.mock("../api/bookings", () => ({
  listMyBookings: vi.fn(),
  createBooking: vi.fn(),
  cancelBooking: vi.fn(),
}));

vi.mock("../api/wishlist", () => ({
  getWishlist: vi.fn(),
  addToWishlist: vi.fn(),
  removeFromWishlist: vi.fn(),
}));

vi.mock("../api/auth", () => ({
  fetchMe: vi.fn(),
  googleLoginUrl: vi.fn(() => "http://localhost:8080/auth/google"),
}));

import * as listingsApi from "../api/listings";
import * as bookingsApi from "../api/bookings";
import * as wishlistApi from "../api/wishlist";
import * as authApi from "../api/auth";

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("frontend page skeletons", () => {
  it.todo("<ListingsIndex> renders the grid when listings load");
  it.todo("<ListingShow> renders details for an existing listing");

  it("<ListingNew> submits createListing on form submit", async () => {
    vi.mocked(listingsApi.createListing).mockResolvedValue({
      _id: "new-1",
      title: "Cabin",
      price: 100,
      image: "x",
    });

    render(
      <MemoryRouter initialEntries={["/listings/new"]}>
        <QueryClientProvider client={makeClient()}>
          <ListingNew />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Cabin" },
    });
    fireEvent.change(screen.getByLabelText("Price per night"), {
      target: { value: "100" },
    });
    const form = screen
      .getByRole("button", { name: /create listing/i })
      .closest("form");
    fireEvent.submit(form!);

    await waitFor(() => expect(listingsApi.createListing).toHaveBeenCalled());
    expect(vi.mocked(listingsApi.createListing).mock.calls[0][0]).toMatchObject(
      { title: "Cabin", price: 100 },
    );
  });

  it("<ListingEdit> prefills the form with existing values", async () => {
    vi.mocked(listingsApi.getListing).mockResolvedValue({
      _id: "abc",
      title: "Seaside Villa",
      price: 250,
      image: "x",
      description: "Lovely",
      location: "Goa",
      country: "India",
    });

    render(
      <MemoryRouter initialEntries={["/listings/abc/edit"]}>
        <QueryClientProvider client={makeClient()}>
          <Routes>
            <Route path="/listings/:id/edit" element={<ListingEdit />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByDisplayValue("Seaside Villa"),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("250")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Goa")).toBeInTheDocument();
  });

  it("<Login> renders the Google button pointing at /auth/google", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /continue with google/i });
    expect(link.getAttribute("href")).toContain("/auth/google");
  });

  it("<Profile> renders the signed-in user and an empty listings state", async () => {
    localStorage.setItem(TOKEN_KEY, "test-token");
    vi.mocked(authApi.fetchMe).mockResolvedValue({
      _id: "u1",
      provider: "google",
      providerId: "g-1",
      name: "Ada Host",
      email: "ada@example.com",
    });
    vi.mocked(listingsApi.listMyListings).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <QueryClientProvider client={makeClient()}>
          <AuthProvider>
            <Profile />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Ada Host")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(
      await screen.findByText("You haven't listed a home yet"),
    ).toBeInTheDocument();
    localStorage.removeItem(TOKEN_KEY);
  });

  it("<Profile> lists the user's own listings with edit links", async () => {
    localStorage.setItem(TOKEN_KEY, "test-token");
    vi.mocked(authApi.fetchMe).mockResolvedValue({
      _id: "u1",
      provider: "google",
      providerId: "g-1",
      name: "Ada Host",
      email: "ada@example.com",
    });
    vi.mocked(listingsApi.listMyListings).mockResolvedValue([
      {
        _id: "l1",
        title: "Lake Cabin",
        price: 120,
        image: "x",
        location: "Manali",
      },
    ]);

    render(
      <MemoryRouter>
        <QueryClientProvider client={makeClient()}>
          <AuthProvider>
            <Profile />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Lake Cabin")).toBeInTheDocument();
    const editLink = screen.getByRole("link", { name: "Edit" });
    expect(editLink.getAttribute("href")).toBe("/listings/l1/edit");
    localStorage.removeItem(TOKEN_KEY);
  });

  it("<Bookings> renders the empty state when there are no bookings", async () => {
    vi.mocked(bookingsApi.listMyBookings).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <QueryClientProvider client={makeClient()}>
          <Bookings />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("No trips booked yet")).toBeInTheDocument();
  });

  it("<Bookings> renders trip cards when bookings exist", async () => {
    vi.mocked(bookingsApi.listMyBookings).mockResolvedValue([
      {
        _id: "b1",
        user: "u1",
        listing: { _id: "l1", title: "Beach House", image: "x", price: 100 },
        checkIn: "2030-01-01T00:00:00.000Z",
        checkOut: "2030-01-04T00:00:00.000Z",
        totalPrice: 300,
        guests: { adults: 2, children: 0, infants: 0, pets: 0 },
        status: "pending",
      },
    ]);

    render(
      <MemoryRouter>
        <QueryClientProvider client={makeClient()}>
          <Bookings />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Beach House")).toBeInTheDocument();
    expect(screen.getByText(/300 total/)).toBeInTheDocument();
    expect(screen.getByText("2 guests")).toBeInTheDocument();
  });

  it("<Wishlist> renders the empty state when there are no saved listings", async () => {
    vi.mocked(wishlistApi.getWishlist).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <QueryClientProvider client={makeClient()}>
          <Wishlist />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Create your first wishlist"),
    ).toBeInTheDocument();
  });
});
