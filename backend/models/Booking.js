const mongoose = require('mongoose');

// TODO: define booking schema — user, listing, checkIn, checkOut, totalPrice, status
const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
    checkIn: Date,
    checkOut: Date,
    totalPrice: Number,
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Booking', bookingSchema);
