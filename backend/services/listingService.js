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
  return Listing.find(query);
}

async function findById(id) {
  const listing = await Listing.findById(id);
  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }
  return listing;
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

module.exports = { findAll, findById, create, update, remove };
