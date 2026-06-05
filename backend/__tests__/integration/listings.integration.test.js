const request = require("supertest");
const app = require("../../app");
const Listing = require("../../models/Listing");
const User = require("../../models/User");
const { signToken } = require("../../services/authService");

async function makeUser(overrides = {}) {
  const user = await User.create({
    provider: "google",
    providerId: `g-${Math.random().toString(36).slice(2)}`,
    email: "host@example.com",
    name: "Host",
    ...overrides,
  });
  return { user, token: signToken(user) };
}

describe("/api/listings", () => {
  it("GET / returns an empty array when no listings exist", async () => {
    const res = await request(app).get("/api/listings");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("POST / requires authentication", async () => {
    const res = await request(app)
      .post("/api/listings")
      .send({ title: "Nope", price: 10 })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(401);
  });

  it("POST / creates a listing owned by the authed user", async () => {
    const { user, token } = await makeUser();
    const res = await request(app)
      .post("/api/listings")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Test", price: 100 })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Test");
    expect(res.body._id).toBeTruthy();
    expect(res.body.owner).toBe(user.id);
  });

  it("GET /mine requires authentication", async () => {
    const res = await request(app).get("/api/listings/mine");
    expect(res.status).toBe(401);
  });

  it("GET /mine returns only the caller's listings", async () => {
    const { user, token } = await makeUser();
    const other = await makeUser({ providerId: "g-other" });
    await Listing.create({ title: "Mine 1", price: 10, owner: user.id });
    await Listing.create({ title: "Mine 2", price: 20, owner: user.id });
    await Listing.create({ title: "Theirs", price: 30, owner: other.user.id });
    await Listing.create({ title: "Ownerless", price: 40 });

    const res = await request(app)
      .get("/api/listings/mine")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const titles = res.body.map((l) => l.title).sort();
    expect(titles).toEqual(["Mine 1", "Mine 2"]);
  });

  it("GET /:id returns 200 for an existing listing", async () => {
    const created = await Listing.create({ title: "Show me", price: 50 });
    const res = await request(app).get(`/api/listings/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Show me");
  });

  it("GET /:id returns 404 for a missing listing", async () => {
    const res = await request(app).get(
      "/api/listings/000000000000000000000000",
    );
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  it("PUT /:id updates a listing owned by the caller", async () => {
    const { user, token } = await makeUser();
    const created = await Listing.create({
      title: "Before",
      price: 10,
      owner: user.id,
    });
    const res = await request(app)
      .put(`/api/listings/${created.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "After", price: 20 })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("After");
  });

  it("PUT /:id returns 403 when editing another user's listing", async () => {
    const owner = await makeUser({ providerId: "g-owner" });
    const intruder = await makeUser({ providerId: "g-intruder" });
    const created = await Listing.create({
      title: "Mine",
      price: 10,
      owner: owner.user.id,
    });
    const res = await request(app)
      .put(`/api/listings/${created.id}`)
      .set("Authorization", `Bearer ${intruder.token}`)
      .send({ title: "Hacked" })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(403);
  });

  it("DELETE /:id returns 204 and removes the listing", async () => {
    const { user, token } = await makeUser();
    const created = await Listing.create({
      title: "Bye",
      price: 1,
      owner: user.id,
    });
    const res = await request(app)
      .delete(`/api/listings/${created.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);
    const remaining = await Listing.find({});
    expect(remaining).toHaveLength(0);
  });
});
