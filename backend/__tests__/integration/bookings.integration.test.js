const request = require("supertest");
const app = require("../../app");
const Listing = require("../../models/Listing");
const User = require("../../models/User");
const { signToken } = require("../../services/authService");

const DAY = 1000 * 60 * 60 * 24;
const isoDaysFromNow = (n) => new Date(Date.now() + n * DAY).toISOString();

async function makeUser(overrides = {}) {
  const user = await User.create({
    provider: "google",
    providerId: `g-${Math.random().toString(36).slice(2)}`,
    email: "guest@example.com",
    name: "Guest",
    ...overrides,
  });
  return { user, token: signToken(user) };
}

describe("/api/bookings", () => {
  it("GET / requires authentication", async () => {
    const res = await request(app).get("/api/bookings");
    expect(res.status).toBe(401);
  });

  it("POST / requires authentication", async () => {
    const res = await request(app)
      .post("/api/bookings")
      .send({ listingId: "x", checkIn: isoDaysFromNow(1) })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(401);
  });

  it("creates a booking and lists it for the user", async () => {
    const { token } = await makeUser();
    const listing = await Listing.create({ title: "Cabin", price: 100 });

    const created = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        listingId: listing.id,
        checkIn: isoDaysFromNow(1),
        checkOut: isoDaysFromNow(4),
        guests: { adults: 2, children: 1, infants: 0, pets: 0 },
      })
      .set("Content-Type", "application/json");
    expect(created.status).toBe(201);
    expect(created.body.totalPrice).toBe(300);
    expect(created.body.status).toBe("pending");
    expect(created.body.guests).toMatchObject({ adults: 2, children: 1 });

    const list = await request(app)
      .get("/api/bookings")
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].listing.title).toBe("Cabin");
  });

  it("rejects overlapping dates with 409", async () => {
    const guest = await makeUser();
    const other = await makeUser();
    const listing = await Listing.create({ title: "Loft", price: 50 });

    await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${guest.token}`)
      .send({
        listingId: listing.id,
        checkIn: isoDaysFromNow(1),
        checkOut: isoDaysFromNow(5),
      })
      .set("Content-Type", "application/json");

    const clash = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${other.token}`)
      .send({
        listingId: listing.id,
        checkIn: isoDaysFromNow(3),
        checkOut: isoDaysFromNow(6),
      })
      .set("Content-Type", "application/json");
    expect(clash.status).toBe(409);
  });

  it("cancels a booking via DELETE", async () => {
    const { token } = await makeUser();
    const listing = await Listing.create({ title: "Villa", price: 100 });
    const created = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        listingId: listing.id,
        checkIn: isoDaysFromNow(1),
        checkOut: isoDaysFromNow(3),
      })
      .set("Content-Type", "application/json");

    const res = await request(app)
      .delete(`/api/bookings/${created.body._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
  });

  it("returns 403 when accessing another user's booking", async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const listing = await Listing.create({ title: "Hut", price: 100 });
    const created = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        listingId: listing.id,
        checkIn: isoDaysFromNow(1),
        checkOut: isoDaysFromNow(3),
      })
      .set("Content-Type", "application/json");

    const res = await request(app)
      .get(`/api/bookings/${created.body._id}`)
      .set("Authorization", `Bearer ${intruder.token}`);
    expect(res.status).toBe(403);
  });
});
