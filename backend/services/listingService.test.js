const mongoose = require("mongoose");
const Listing = require("../models/Listing");
const listingService = require("./listingService");
const ApiError = require("../utils/ApiError");

describe("listingService", () => {
  describe("findAll", () => {
    it("returns an empty array when no listings exist", async () => {
      const result = await listingService.findAll();
      expect(result).toEqual([]);
    });

    it("returns all listings when some exist", async () => {
      await Listing.insertMany([
        { title: "A", price: 100 },
        { title: "B", price: 200 },
      ]);
      const result = await listingService.findAll();
      expect(result).toHaveLength(2);
    });

    it("filters by location (case-insensitive substring)", async () => {
      await Listing.insertMany([
        { title: "Beach hut", price: 100, location: "Goa", country: "India" },
        { title: "City flat", price: 200, location: "Mumbai" },
      ]);
      const result = await listingService.findAll({ location: "goa" });
      expect(result).toHaveLength(1);
      expect(result[0].location).toBe("Goa");
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
      expect(await listingService.findAll({ location: "villa" })).toHaveLength(
        1,
      );
      expect(await listingService.findAll({ location: "india" })).toHaveLength(
        1,
      );
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
      expect(villas).toHaveLength(1);
      expect(villas[0].title).toBe("Goa villa");
      // A listing surfaces under every tag it carries.
      expect(
        await listingService.findAll({ category: "Beachfront" }),
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
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("A");
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
