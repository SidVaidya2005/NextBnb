import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Login } from "./Login";

describe("frontend page skeletons", () => {
  it.todo("<ListingsIndex> renders the grid when listings load");
  it.todo("<ListingShow> renders details for an existing listing");
  it.todo("<ListingNew> submits createListing on form submit");
  it.todo("<ListingEdit> prefills the form with existing values");

  it("<Login> renders the Google button pointing at /auth/google", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /continue with google/i });
    expect(link.getAttribute("href")).toContain("/auth/google");
  });

  it.todo("<Profile> renders the signed-in user");
  it.todo("<Bookings> renders the empty state when there are no bookings");
  it.todo(
    "<Wishlist> renders the empty state when there are no saved listings",
  );
});
