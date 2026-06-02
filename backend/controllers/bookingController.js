const asyncHandler = require("../utils/asyncHandler");
const bookingService = require("../services/bookingService");

const index = asyncHandler(async (req, res) => {
  const bookings = await bookingService.findAllForUser(req.user.sub);
  res.json(bookings);
});

const show = asyncHandler(async (req, res) => {
  const booking = await bookingService.findById(req.params.id, req.user.sub);
  res.json(booking);
});

const create = asyncHandler(async (req, res) => {
  const booking = await bookingService.create(req.user.sub, req.body);
  res.status(201).json(booking);
});

const update = asyncHandler(async (req, res) => {
  const booking = await bookingService.update(
    req.params.id,
    req.user.sub,
    req.body,
  );
  res.json(booking);
});

const remove = asyncHandler(async (req, res) => {
  const booking = await bookingService.remove(req.params.id, req.user.sub);
  res.json(booking);
});

module.exports = { index, show, create, update, remove };
