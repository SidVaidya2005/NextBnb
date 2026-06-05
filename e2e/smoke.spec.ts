import { test, expect } from "@playwright/test";

/* Happy-path smoke: a logged-in user browses the paginated grid, opens a
 * listing, and sees their own account + listings on the protected /profile
 * route. Auth is injected via storageState (see e2e/setup/global-setup.ts);
 * the backend is seeded with 15 listings owned by that user. */

test.describe("NextBnb smoke", () => {
  test("browses the paginated grid and opens a listing", async ({ page }) => {
    await page.goto("/listings");

    // 15 seeded listings at pageSize 12 → two pages.
    const pager = page.getByRole("navigation", { name: "Pagination" });
    await expect(pager.getByText("Page 1 of 2")).toBeVisible();
    await expect(
      pager.getByRole("button", { name: "Previous" }),
    ).toBeDisabled();

    // Opening a card navigates to its detail route.
    await page.locator('a[href^="/listings/"]').first().click();
    await expect(page).toHaveURL(/\/listings\/[a-f0-9]{24}$/);
  });

  test("pages forward to the last page", async ({ page }) => {
    await page.goto("/listings");
    const pager = page.getByRole("navigation", { name: "Pagination" });

    await pager.getByRole("button", { name: "Next" }).click();
    await expect(pager.getByText("Page 2 of 2")).toBeVisible();
    await expect(pager.getByRole("button", { name: "Next" })).toBeDisabled();
    await expect(page).toHaveURL(/[?&]page=2/);
  });

  test("shows the signed-in account and the user's listings on /profile", async ({
    page,
  }) => {
    await page.goto("/profile");

    // ProtectedRoute let us through (we have a token) and /auth/me resolved —
    // the account card heading carries the signed-in user's name.
    await expect(
      page.getByRole("heading", { name: "E2E Tester" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Your listings" }),
    ).toBeVisible();
    // findByOwner returns all 15 (unpaginated), so Stay 01 is present here.
    await expect(page.getByText("E2E Stay 01")).toBeVisible();
  });
});
