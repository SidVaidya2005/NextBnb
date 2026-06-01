const request = require("supertest");
const app = require("../../app");
const Listing = require("../../models/Listing");

describe("/api/listings", () => {
  it("GET / returns an empty array when no listings exist", async () => {
    const res = await request(app).get("/api/listings");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("POST / creates a listing with the flat body shape", async () => {
    const res = await request(app)
      .post("/api/listings")
      .send({ title: "Test", price: 100 })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Test");
    expect(res.body._id).toBeTruthy();
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

  it("PUT /:id updates a listing", async () => {
    const created = await Listing.create({ title: "Before", price: 10 });
    const res = await request(app)
      .put(`/api/listings/${created.id}`)
      .send({ title: "After", price: 20 })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("After");
  });

  it("DELETE /:id returns 204 and removes the listing", async () => {
    const created = await Listing.create({ title: "Bye", price: 1 });
    const res = await request(app).delete(`/api/listings/${created.id}`);
    expect(res.status).toBe(204);
    const remaining = await Listing.find({});
    expect(remaining).toHaveLength(0);
  });
});
