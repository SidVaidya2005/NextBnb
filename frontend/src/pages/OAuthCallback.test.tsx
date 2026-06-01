import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import { OAuthCallback } from "./OAuthCallback";
import { TOKEN_KEY } from "../api/client";

vi.mock("../api/auth", () => ({
  fetchMe: vi
    .fn()
    .mockResolvedValue({ _id: "u1", provider: "google", name: "Ada" }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <OAuthCallback />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<OAuthCallback />", () => {
  beforeEach(() => {
    localStorage.removeItem(TOKEN_KEY);
  });

  it("stores the token from the query string", async () => {
    renderAt("/oauth?token=abc");
    await waitFor(() => {
      expect(localStorage.getItem(TOKEN_KEY)).toBe("abc");
    });
  });

  it("does not store a token when only an error is present", async () => {
    renderAt("/oauth?error=oauth");
    await waitFor(() => {
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });
  });
});
