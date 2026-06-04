const request = require("supertest");
const app = require("../../app");
const User = require("../../models/User");
const { signToken } = require("../../services/authService");

async function makeUser() {
  const user = await User.create({
    provider: "google",
    providerId: `g-${Math.random().toString(36).slice(2)}`,
    email: "host@example.com",
    name: "Host",
  });
  return { user, token: signToken(user) };
}

// These cases all resolve before the Cloudinary call (auth, multer fileFilter,
// size limit, the missing-file guard), so they're deterministic whether or not
// Cloudinary creds are present. The actual upload/delete network calls are
// covered with a mocked SDK in services/cloudinaryService.test.js.
describe("/api/uploads", () => {
  it("POST / requires authentication", async () => {
    const res = await request(app)
      .post("/api/uploads")
      .attach("image", Buffer.from("fake"), "photo.jpg");
    expect(res.status).toBe(401);
  });

  it("DELETE /:publicId requires authentication", async () => {
    const res = await request(app).delete("/api/uploads/nextbnb/listings/abc");
    expect(res.status).toBe(401);
  });

  it("POST / returns 400 when no file is attached", async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .post("/api/uploads")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("POST / rejects a non-image file with 400", async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .post("/api/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", Buffer.from("plain text"), "notes.txt");
    expect(res.status).toBe(400);
  });

  it("POST / rejects an image over the size limit with 400", async () => {
    const { token } = await makeUser();
    const tooBig = Buffer.alloc(6 * 1024 * 1024, 1);
    const res = await request(app)
      .post("/api/uploads")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", tooBig, "big.jpg");
    expect(res.status).toBe(400);
  });
});
