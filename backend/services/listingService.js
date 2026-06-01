const Listing = require("../models/Listing");
const ApiError = require("../utils/ApiError");

async function findAll() {
  return Listing.find({});
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

async function update(id, data) {
  const listing = await Listing.findById(id);
  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }
  Object.assign(listing, data);
  await listing.save();
  return listing;
}

async function remove(id) {
  const listing = await Listing.findByIdAndDelete(id);
  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }
  return listing;
}

module.exports = { findAll, findById, create, update, remove };
