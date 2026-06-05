const Listing = require("../models/Listing");
const ApiError = require("../utils/ApiError");

// Owner-only guard. Listings created before ownership existed (e.g. seed data)
// have no `owner` and stay read-only demo data rather than being editable by all.
function assertOwner(listing, userId) {
  if (listing.owner && String(listing.owner) !== String(userId)) {
    throw new ApiError(403, "You can only modify your own listings");
  }
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findAll(filter = {}) {
  const query = {};
  if (filter.location) {
    const rx = new RegExp(escapeRegExp(String(filter.location)), "i");
    query.$or = [{ location: rx }, { title: rx }, { country: rx }];
  }
  // Array equality matches any listing whose `categories` contains the value.
  // Coerce to a string so a crafted query (?category[$ne]=) can't smuggle a
  // Mongo operator object into the filter (NoSQL injection).
  if (filter.category) {
    query.categories = String(filter.category);
  }
  return Listing.find(query);
}

async function findById(id) {
  const listing = await Listing.findById(id);
  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }
  return listing;
}

// The caller's own listings, newest first. ObjectIds embed a creation
// timestamp, so sorting by _id descending gives newest-first without a
// `timestamps` field on the schema.
async function findByOwner(userId) {
  return Listing.find({ owner: userId }).sort({ _id: -1 });
}

// Authorization helper for image deletes: finds the caller's listing that uses
// the given Cloudinary image. The stored value is the secure_url ending in
// ".../<publicId>.<ext>", so the regex is anchored to that suffix — a shorter
// publicId must not substring-match a longer image id and authorize deleting it.
async function findByImagePublicId(publicId, userId) {
  const rx = new RegExp(`/${escapeRegExp(publicId)}\\.[^/]+$`);
  return Listing.findOne({ owner: userId, image: rx });
}

async function create(data) {
  const listing = new Listing(data);
  await listing.save();
  return listing;
}

async function update(id, data, userId) {
  const listing = await Listing.findById(id);
  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }
  assertOwner(listing, userId);
  // Re-pin owner last so a write body can't reassign the listing to someone else.
  Object.assign(listing, data, { owner: listing.owner });
  await listing.save();
  return listing;
}

async function remove(id, userId) {
  const listing = await Listing.findById(id);
  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }
  assertOwner(listing, userId);
  await listing.deleteOne();
  return listing;
}

module.exports = {
  findAll,
  findById,
  findByOwner,
  findByImagePublicId,
  create,
  update,
  remove,
};
