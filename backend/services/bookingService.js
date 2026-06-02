const Booking = require("../models/Booking");
const Listing = require("../models/Listing");
const ApiError = require("../utils/ApiError");

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Only the user who made a booking may view or change it.
function assertOwner(booking, userId) {
  if (String(booking.user) !== String(userId)) {
    throw new ApiError(403, "You can only modify your own bookings");
  }
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

async function findAllForUser(userId) {
  return Booking.find({ user: userId })
    .populate("listing")
    .sort({ createdAt: -1 });
}

async function findById(id, userId) {
  const booking = await Booking.findById(id).populate("listing");
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }
  assertOwner(booking, userId);
  return booking;
}

async function create(userId, { listingId, checkIn, checkOut, guests }) {
  const listing = await Listing.findById(listingId);
  if (!listing) {
    throw new ApiError(404, "Listing not found");
  }

  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ApiError(400, "Invalid check-in or check-out date");
  }
  if (start >= end) {
    throw new ApiError(400, "Check-out must be after check-in");
  }
  if (start < startOfToday()) {
    throw new ApiError(400, "Check-in cannot be in the past");
  }

  // Reject any overlap with a live (non-cancelled) booking on this listing.
  // Two ranges overlap when each starts before the other ends.
  const conflict = await Booking.findOne({
    listing: listingId,
    status: { $ne: "cancelled" },
    checkIn: { $lt: end },
    checkOut: { $gt: start },
  });
  if (conflict) {
    throw new ApiError(409, "Those dates are not available");
  }

  const nights = Math.round((end - start) / MS_PER_DAY);
  const booking = new Booking({
    user: userId,
    listing: listingId,
    checkIn: start,
    checkOut: end,
    totalPrice: nights * listing.price,
    guests,
    status: "pending",
  });
  await booking.save();
  return booking;
}

async function update(id, userId, { status }) {
  const booking = await Booking.findById(id);
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }
  assertOwner(booking, userId);
  if (status !== undefined) {
    if (!Booking.schema.path("status").enumValues.includes(status)) {
      throw new ApiError(400, "Invalid booking status");
    }
    booking.status = status;
  }
  await booking.save();
  return booking;
}

async function remove(id, userId) {
  const booking = await Booking.findById(id);
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }
  assertOwner(booking, userId);
  booking.status = "cancelled";
  await booking.save();
  return booking;
}

module.exports = { findAllForUser, findById, create, update, remove };
