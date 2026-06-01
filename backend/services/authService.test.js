const { signToken, verifyToken, upsertOAuthUser } = require("./authService");
const User = require("../models/User");

describe("authService", () => {
  it("signs and verifies a token round-trip", () => {
    const token = signToken({ id: "user-1", email: "a@b.com", name: "A" });
    const payload = verifyToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.email).toBe("a@b.com");
  });

  it("upsertOAuthUser creates a new user when none exists", async () => {
    const profile = {
      id: "g-123",
      displayName: "Ada Lovelace",
      emails: [{ value: "ada@example.com" }],
      photos: [{ value: "https://img/avatar.png" }],
    };
    const user = await upsertOAuthUser(profile, "google");
    expect(user.provider).toBe("google");
    expect(user.providerId).toBe("g-123");
    expect(user.email).toBe("ada@example.com");
    expect(user.name).toBe("Ada Lovelace");
    expect(user.avatar).toBe("https://img/avatar.png");
    expect(await User.countDocuments()).toBe(1);
  });

  it("upsertOAuthUser updates fields for an existing provider+providerId", async () => {
    await upsertOAuthUser(
      { id: "g-1", displayName: "Old", emails: [{ value: "old@x.com" }] },
      "google",
    );
    const updated = await upsertOAuthUser(
      { id: "g-1", displayName: "New", emails: [{ value: "new@x.com" }] },
      "google",
    );
    expect(updated.name).toBe("New");
    expect(updated.email).toBe("new@x.com");
    expect(
      await User.countDocuments({ provider: "google", providerId: "g-1" }),
    ).toBe(1);
  });
});
