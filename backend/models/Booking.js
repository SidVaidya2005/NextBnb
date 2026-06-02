const mongoose = require("mongoose");

// TODO: define booking schema — user, listing, checkIn, checkOut, totalPrice, status
const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing" },
    checkIn: Date,
    checkOut: Date,
    totalPrice: Number,
    guests: {
      adults: { type: Number, default: 1 },
      children: { type: Number, default: 0 },
      infants: { type: Number, default: 0 },
      pets: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Booking", bookingSchema);
