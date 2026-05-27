const Listing = require('../models/Listing');
const listingService = require('./listingService');
const ApiError = require('../utils/ApiError');

describe('listingService', () => {
  describe('findAll', () => {
    it('returns an empty array when no listings exist', async () => {
      const result = await listingService.findAll();
      expect(result).toEqual([]);
    });

    it('returns all listings when some exist', async () => {
      await Listing.insertMany([
        { title: 'A', price: 100 },
        { title: 'B', price: 200 },
      ]);
      const result = await listingService.findAll();
      expect(result).toHaveLength(2);
    });
  });

  describe('findById', () => {
    it('returns the listing when found', async () => {
      const created = await Listing.create({ title: 'X', price: 10 });
      const result = await listingService.findById(created.id);
      expect(result.title).toBe('X');
    });

    it('throws ApiError(404) when not found', async () => {
      const fakeId = '000000000000000000000000';
      await expect(listingService.findById(fakeId)).rejects.toBeInstanceOf(ApiError);
      await expect(listingService.findById(fakeId)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('create', () => {
    it('saves a listing and returns it', async () => {
      const result = await listingService.create({ title: 'New', price: 50 });
      expect(result.id).toBeTruthy();
      expect(result.title).toBe('New');
    });

    it('coerces empty image to the default URL', async () => {
      const result = await listingService.create({ title: 'No image', price: 50, image: '' });
      expect(result.image).toBe(Listing.DEFAULT_IMAGE);
    });
  });

  describe('update', () => {
    it('updates the listing and returns the new doc', async () => {
      const created = await Listing.create({ title: 'Old', price: 10 });
      const updated = await listingService.update(created.id, { title: 'New', price: 20 });
      expect(updated.title).toBe('New');
      expect(updated.price).toBe(20);
    });

    it('throws ApiError(404) when not found', async () => {
      const fakeId = '000000000000000000000000';
      await expect(listingService.update(fakeId, { title: 'x' })).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('remove', () => {
    it('deletes the listing', async () => {
      const created = await Listing.create({ title: 'Doomed', price: 1 });
      await listingService.remove(created.id);
      const remaining = await Listing.find({});
      expect(remaining).toHaveLength(0);
    });

    it('throws ApiError(404) when not found', async () => {
      await expect(listingService.remove('000000000000000000000000')).rejects.toMatchObject({
        status: 404,
      });
    });
  });
});
