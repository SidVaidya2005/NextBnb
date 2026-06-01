import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import { App } from "./App";

vi.mock("./api/listings", () => ({
  listListings: vi.fn().mockResolvedValue([]),
}));

function renderApp(initialPath = "/listings") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("<App />", () => {
  it("renders the header with the NextBnb brand", () => {
    renderApp();
    expect(screen.getByRole("link", { name: "NextBnb" })).toBeInTheDocument();
  });

  it("shows a login link when signed out", () => {
    renderApp();
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders the 404 page for unknown routes", () => {
    renderApp("/this/does/not/exist");
    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
  });
});
