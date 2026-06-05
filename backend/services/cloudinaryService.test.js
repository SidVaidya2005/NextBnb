// Cloudinary is a third-party network service with no in-memory equivalent, so
// its SDK methods are spied on. The service requires the same cloudinary
// singleton, so spying on `cloudinary.uploader.*` intercepts its calls too.
// Config is toggled by mutating the shared env object (vitest isolates modules
// per file, so this can't leak to other suites).
const { v2: cloudinary } = require("cloudinary");
const env = require("../config/env");
const {
  uploadImage,
  deleteImage,
  isConfigured,
} = require("./cloudinaryService");

const CREDS = {
  CLOUDINARY_CLOUD_NAME: "test-cloud",
  CLOUDINARY_API_KEY: "test-key",
  CLOUDINARY_API_SECRET: "test-secret",
};

describe("cloudinaryService", () => {
  beforeEach(() => {
    // Start every test unconfigured regardless of the dev's local .env.
    env.CLOUDINARY_CLOUD_NAME = "";
    env.CLOUDINARY_API_KEY = "";
    env.CLOUDINARY_API_SECRET = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("when configured", () => {
    beforeEach(() => {
      Object.assign(env, CREDS);
    });

    it("isConfigured() is true", () => {
      expect(isConfigured()).toBe(true);
    });

    it("uploadImage streams the buffer and returns url + publicId", async () => {
      vi.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(
        (_opts, cb) => ({
          end: () =>
            cb(null, {
              secure_url: "https://res.cloudinary.com/demo/a.jpg",
              public_id: "nextbnb/listings/a",
            }),
        }),
      );

      await expect(
        uploadImage({ buffer: Buffer.from("img") }),
      ).resolves.toEqual({
        url: "https://res.cloudinary.com/demo/a.jpg",
        publicId: "nextbnb/listings/a",
      });
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: "nextbnb/listings",
          resource_type: "image",
        }),
        expect.any(Function),
      );
    });

    it("uploadImage rejects with 502 on a Cloudinary error", async () => {
      vi.spyOn(cloudinary.uploader, "upload_stream").mockImplementation(
        (_opts, cb) => ({ end: () => cb(new Error("boom")) }),
      );
      await expect(
        uploadImage({ buffer: Buffer.from("x") }),
      ).rejects.toMatchObject({ status: 502 });
    });

    it("uploadImage rejects with 400 when no file buffer is present", async () => {
      await expect(uploadImage(undefined)).rejects.toMatchObject({
        status: 400,
      });
    });

    it("deleteImage resolves when Cloudinary reports ok", async () => {
      vi.spyOn(cloudinary.uploader, "destroy").mockResolvedValue({
        result: "ok",
      });
      await expect(deleteImage("nextbnb/listings/a")).resolves.toMatchObject({
        deleted: true,
      });
    });

    it("deleteImage treats 'not found' as already deleted", async () => {
      vi.spyOn(cloudinary.uploader, "destroy").mockResolvedValue({
        result: "not found",
      });
      await expect(deleteImage("gone")).resolves.toMatchObject({
        deleted: true,
      });
    });

    it("deleteImage rejects with 502 on any other result", async () => {
      vi.spyOn(cloudinary.uploader, "destroy").mockResolvedValue({
        result: "error",
      });
      await expect(deleteImage("x")).rejects.toMatchObject({ status: 502 });
    });
  });

  describe("when not configured", () => {
    it("isConfigured() is false", () => {
      expect(isConfigured()).toBe(false);
    });

    it("uploadImage and deleteImage reject with 501", async () => {
      await expect(
        uploadImage({ buffer: Buffer.from("x") }),
      ).rejects.toMatchObject({ status: 501 });
      await expect(deleteImage("x")).rejects.toMatchObject({ status: 501 });
    });
  });
});
