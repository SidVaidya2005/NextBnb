const request = require("supertest");
const app = require("../../app");
const env = require("../../config/env");
const User = require("../../models/User");
const { signToken } = require("../../services/authService");

describe("/auth", () => {
  it("GET /me returns 401 without an Authorization header", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  it("GET /me returns the current user for a valid Bearer token", async () => {
    const user = await User.create({
      provider: "google",
      providerId: "g-1",
      email: "ada@example.com",
      name: "Ada",
    });
    const token = signToken(user);
    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("ada@example.com");
  });

  it("POST /logout returns 204", async () => {
    const res = await request(app).post("/auth/logout");
    expect(res.status).toBe(204);
  });

  it("rejects an OAuth callback whose state does not match the cookie", async () => {
    const res = await request(app).get("/auth/google/callback?state=forged");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(
      `${env.FRONTEND_URL}/login?error=oauth_state`,
    );
  });
});
