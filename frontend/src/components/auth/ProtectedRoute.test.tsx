import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../../context/AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";
import { TOKEN_KEY } from "../../api/client";

vi.mock("../../api/auth", () => ({
  fetchMe: vi
    .fn()
    .mockResolvedValue({ _id: "u1", provider: "google", name: "Ada" }),
}));

function Harness({ initialPath = "/protected" }: { initialPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<div>secret content</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("<ProtectedRoute />", () => {
  beforeEach(() => {
    localStorage.removeItem(TOKEN_KEY);
  });

  it("redirects to /login when no token is set", () => {
    render(<Harness />);
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("renders children when authenticated", async () => {
    localStorage.setItem(TOKEN_KEY, "valid-token");
    render(<Harness />);
    await waitFor(() => {
      expect(screen.getByText("secret content")).toBeInTheDocument();
    });
  });
});
