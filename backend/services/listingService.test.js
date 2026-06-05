const mongoose = require("mongoose");
const Listing = require("../models/Listing");
const listingService = require("./listingService");
const ApiError = require("../utils/ApiError");

describe("listingService", () => {
  describe("findAll", () => {
    it("returns an empty page when no listings exist", async () => {
      const result = await listingService.findAll();
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.page).toBe(1);
    });

    it("returns all listings when some exist", async () => {
      await Listing.insertMany([
        { title: "A", price: 100 },
        { title: "B", price: 200 },
      ]);
      const result = await listingService.findAll();
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("filters by location (case-insensitive substring)", async () => {
      await Listing.insertMany([
        { title: "Beach hut", price: 100, location: "Goa", country: "India" },
        { title: "City flat", price: 200, location: "Mumbai" },
      ]);
      const result = await listingService.findAll({ location: "goa" });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].location).toBe("Goa");
    });

    it("matches on title or country too", async () => {
      await Listing.insertMany([
        { title: "Goa villa", price: 100, location: "Anjuna" },
        {
          title: "Hill cabin",
          price: 200,
          location: "Manali",
          country: "India",
        },
      ]);
      expect(
        (await listingService.findAll({ location: "villa" })).items,
      ).toHaveLength(1);
      expect(
        (await listingService.findAll({ location: "india" })).items,
      ).toHaveLength(1);
    });

    it("filters by category membership (multi-tag)", async () => {
      await Listing.insertMany([
        {
          title: "Goa villa",
          price: 100,
          categories: ["Villas", "Beachfront"],
        },
        { title: "City loft", price: 200, categories: ["Top Cities"] },
        { title: "Untagged", price: 300 },
      ]);
      const villas = await listingService.findAll({ category: "Villas" });
      expect(villas.items).toHaveLength(1);
      expect(villas.items[0].title).toBe("Goa villa");
      // A listing surfaces under every tag it carries.
      expect(
        (await listingService.findAll({ category: "Beachfront" })).items,
      ).toHaveLength(1);
    });

    it("combines location and category filters (AND)", async () => {
      await Listing.insertMany([
        { title: "A", price: 100, location: "Goa", categories: ["Villas"] },
        { title: "B", price: 200, location: "Goa", categories: ["Top Cities"] },
        { title: "C", price: 300, location: "Mumbai", categories: ["Villas"] },
      ]);
      const result = await listingService.findAll({
        location: "goa",
        category: "Villas",
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("A");
    });

    it("neutralizes a Mongo operator smuggled into category (NoSQL injection)", async () => {
      await Listing.insertMany([
        { title: "Tagged", price: 100, categories: ["Villas"] },
        { title: "Untagged", price: 200 },
      ]);
      // ?category[$ne]= arrives as an object; coercion must stop it matching all.
      const result = await listingService.findAll({
        category: { $ne: null },
      });
      expect(result.items).toEqual([]);
    });

    it("paginates with limit + page and reports totals", async () => {
      const docs = Array.from({ length: 15 }, (_, i) => ({
        title: `L${i}`,
        price: 100,
      }));
      await Listing.insertMany(docs);

      const first = await listingService.findAll({}, { page: 1, limit: 12 });
      expect(first.items).toHaveLength(12);
      expect(first.total).toBe(15);
      expect(first.page).toBe(1);
      expect(first.pageSize).toBe(12);
      expect(first.totalPages).toBe(2);

      const second = await listingService.findAll({}, { page: 2, limit: 12 });
      expect(second.items).toHaveLength(3);
      expect(second.page).toBe(2);
    });

    it("clamps a bad page/limit to safe defaults", async () => {
      await Listing.insertMany([{ title: "A", price: 1 }]);
      // Garbage and operator-objects fall back to page 1 / default size.
      const result = await listingService.findAll(
        {},
        { page: { $ne: null }, limit: "abc" },
      );
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(12);
      expect(result.items).toHaveLength(1);
    });
  });

  describe("findById", () => {
    it("returns the listing when found", async () => {
      const created = await Listing.create({ title: "X", price: 10 });
      const result = await listingService.findById(created.id);
      expect(result.title).toBe("X");
    });

    it("throws ApiError(404) when not found", async () => {
      const fakeId = "000000000000000000000000";
      await expect(listingService.findById(fakeId)).rejects.toBeInstanceOf(
        ApiError,
      );
      await expect(listingService.findById(fakeId)).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe("findByOwner", () => {
    it("returns only the given owner's listings, newest first", async () => {
      const owner = new mongoose.Types.ObjectId();
      const other = new mongoose.Types.ObjectId();
      const first = await Listing.create({ title: "First", price: 10, owner });
      const second = await Listing.create({
        title: "Second",
        price: 20,
        owner,
      });
      await Listing.create({ title: "Theirs", price: 30, owner: other });

      const result = await listingService.findByOwner(owner);
      expect(result).toHaveLength(2);
      // Newest first: `second` was created after `first`.
      expect(result.map((l) => l.title)).toEqual(["Second", "First"]);
      expect(String(result[0]._id)).toBe(String(second._id));
      expect(String(result[1]._id)).toBe(String(first._id));
    });

    it("returns an empty array when the owner has no listings", async () => {
      const owner = new mongoose.Types.ObjectId();
      expect(await listingService.findByOwner(owner)).toEqual([]);
    });
  });

  describe("findByImagePublicId", () => {
    const PUBLIC_ID = "nextbnb/listings/abc123";
    const IMAGE_URL = `https://res.cloudinary.com/demo/image/upload/v1/${PUBLIC_ID}.jpg`;

    it("returns the caller's listing that uses the image", async () => {
      const owner = new mongoose.Types.ObjectId();
      await Listing.create({
        title: "Mine",
        price: 10,
        image: IMAGE_URL,
        owner,
      });
      const found = await listingService.findByImagePublicId(PUBLIC_ID, owner);
      expect(found).not.toBeNull();
      expect(found.title).toBe("Mine");
    });

    it("returns null when another user owns the listing", async () => {
      const owner = new mongoose.Types.ObjectId();
      const other = new mongoose.Types.ObjectId();
      await Listing.create({
        title: "Theirs",
        price: 10,
        image: IMAGE_URL,
        owner,
      });
      expect(
        await listingService.findByImagePublicId(PUBLIC_ID, other),
      ).toBeNull();
    });

    it("does not match a shorter publicId against a longer image id", async () => {
      const owner = new mongoose.Types.ObjectId();
      await Listing.create({
        title: "Mine",
        price: 10,
        image: IMAGE_URL,
        owner,
      });
      // "nextbnb/listings/abc" must not authorize deleting ".../abc123.jpg".
      expect(
        await listingService.findByImagePublicId("nextbnb/listings/abc", owner),
      ).toBeNull();
    });
  });

  describe("create", () => {
    it("saves a listing and returns it", async () => {
      const result = await listingService.create({ title: "New", price: 50 });
      expect(result.id).toBeTruthy();
      expect(result.title).toBe("New");
    });

    it("coerces empty image to the default URL", async () => {
      const result = await listingService.create({
        title: "No image",
        price: 50,
        image: "",
      });
      expect(result.image).toBe(Listing.DEFAULT_IMAGE);
    });
  });

  describe("update", () => {
    it("updates the listing and returns the new doc", async () => {
      const created = await Listing.create({ title: "Old", price: 10 });
      const updated = await listingService.update(created.id, {
        title: "New",
        price: 20,
      });
      expect(updated.title).toBe("New");
      expect(updated.price).toBe(20);
    });

    it("throws ApiError(404) when not found", async () => {
      const fakeId = "000000000000000000000000";
      await expect(
        listingService.update(fakeId, { title: "x" }),
      ).rejects.toMatchObject({
        status: 404,
      });
    });

    it("coerces empty image to the default URL", async () => {
      const created = await Listing.create({
        title: "Has image",
        price: 10,
        image: "http://x/y.jpg",
      });
      const updated = await listingService.update(created.id, { image: "" });
      expect(updated.image).toBe(Listing.DEFAULT_IMAGE);
    });
  });

  describe("remove", () => {
    it("deletes the listing", async () => {
      const created = await Listing.create({ title: "Doomed", price: 1 });
      await listingService.remove(created.id);
      const remaining = await Listing.find({});
      expect(remaining).toHaveLength(0);
    });

    it("throws ApiError(404) when not found", async () => {
      await expect(
        listingService.remove("000000000000000000000000"),
      ).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe("ownership", () => {
    const ownerId = new mongoose.Types.ObjectId();
    const otherId = new mongoose.Types.ObjectId();

    it("create persists the owner", async () => {
      const result = await listingService.create({
        title: "Owned",
        price: 50,
        owner: ownerId,
      });
      expect(String(result.owner)).toBe(String(ownerId));
    });

    it("update succeeds for the owner", async () => {
      const created = await Listing.create({
        title: "Old",
        price: 10,
        owner: ownerId,
      });
      const updated = await listingService.update(
        created.id,
        { title: "New" },
        ownerId,
      );
      expect(updated.title).toBe("New");
    });

    it("update throws ApiError(403) for a non-owner", async () => {
      const created = await Listing.create({
        title: "Old",
        price: 10,
        owner: ownerId,
      });
      await expect(
        listingService.update(created.id, { title: "Hacked" }, otherId),
      ).rejects.toMatchObject({ status: 403 });
    });

    it("update cannot reassign the owner", async () => {
      const created = await Listing.create({
        title: "Old",
        price: 10,
        owner: ownerId,
      });
      const updated = await listingService.update(
        created.id,
        { owner: otherId, title: "Renamed" },
        ownerId,
      );
      expect(String(updated.owner)).toBe(String(ownerId));
    });

    it("remove throws ApiError(403) for a non-owner", async () => {
      const created = await Listing.create({
        title: "Old",
        price: 10,
        owner: ownerId,
      });
      await expect(
        listingService.remove(created.id, otherId),
      ).rejects.toMatchObject({ status: 403 });
    });

    it("ownerless listings stay editable (seed data)", async () => {
      const created = await Listing.create({ title: "Seed", price: 10 });
      const updated = await listingService.update(
        created.id,
        { title: "Edited" },
        ownerId,
      );
      expect(updated.title).toBe("Edited");
    });
  });
});
