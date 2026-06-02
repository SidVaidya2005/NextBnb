const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Listing = require("../models/Listing");
const bookingService = require("./bookingService");

const DAY = 1000 * 60 * 60 * 24;

function daysFromNow(n) {
  return new Date(Date.now() + n * DAY);
}

async function makeListing(price = 100) {
  return Listing.create({ title: "Stay", price });
}

describe("bookingService", () => {
  const userId = new mongoose.Types.ObjectId();
  const otherId = new mongoose.Types.ObjectId();

  it("findAll returns user bookings", async () => {
    const listing = await makeListing();
    await bookingService.create(userId, {
      listingId: listing.id,
      checkIn: daysFromNow(1),
      checkOut: daysFromNow(3),
    });
    await bookingService.create(otherId, {
      listingId: listing.id,
      checkIn: daysFromNow(10),
      checkOut: daysFromNow(12),
    });

    const mine = await bookingService.findAllForUser(userId);
    expect(mine).toHaveLength(1);
    expect(String(mine[0].user)).toBe(String(userId));
    // listing is populated
    expect(mine[0].listing.title).toBe("Stay");
  });

  it("create computes totalPrice from nights * listing price", async () => {
    const listing = await makeListing(200);
    const booking = await bookingService.create(userId, {
      listingId: listing.id,
      checkIn: daysFromNow(1),
      checkOut: daysFromNow(4),
    });
    expect(booking.totalPrice).toBe(600);
    expect(booking.status).toBe("pending");
  });

  it("create persists the guest breakdown", async () => {
    const listing = await makeListing();
    const booking = await bookingService.create(userId, {
      listingId: listing.id,
      checkIn: daysFromNow(1),
      checkOut: daysFromNow(3),
      guests: { adults: 2, children: 1, infants: 1, pets: 1 },
    });
    expect(booking.guests.toObject()).toEqual({
      adults: 2,
      children: 1,
      infants: 1,
      pets: 1,
    });
  });

  it("create defaults guests to a single adult when omitted", async () => {
    const listing = await makeListing();
    const booking = await bookingService.create(userId, {
      listingId: listing.id,
      checkIn: daysFromNow(1),
      checkOut: daysFromNow(3),
    });
    expect(booking.guests.adults).toBe(1);
    expect(booking.guests.children).toBe(0);
  });

  it("create rejects overlapping reservations", async () => {
    const listing = await makeListing();
    await bookingService.create(userId, {
      listingId: listing.id,
      checkIn: daysFromNow(1),
      checkOut: daysFromNow(5),
    });
    await expect(
      bookingService.create(otherId, {
        listingId: listing.id,
        checkIn: daysFromNow(4),
        checkOut: daysFromNow(7),
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("create allows a booking after a cancelled one frees the dates", async () => {
    const listing = await makeListing();
    const first = await bookingService.create(userId, {
      listingId: listing.id,
      checkIn: daysFromNow(1),
      checkOut: daysFromNow(5),
    });
    await bookingService.remove(first.id, userId);
    const second = await bookingService.create(otherId, {
      listingId: listing.id,
      checkIn: daysFromNow(1),
      checkOut: daysFromNow(5),
    });
    expect(second.id).toBeTruthy();
  });

  it("create rejects past check-in dates", async () => {
    const listing = await makeListing();
    await expect(
      bookingService.create(userId, {
        listingId: listing.id,
        checkIn: daysFromNow(-2),
        checkOut: daysFromNow(2),
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("create rejects check-out on or before check-in", async () => {
    const listing = await makeListing();
    await expect(
      bookingService.create(userId, {
        listingId: listing.id,
        checkIn: daysFromNow(3),
        checkOut: daysFromNow(3),
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("update transitions status correctly", async () => {
    const listing = await makeListing();
    const booking = await bookingService.create(userId, {
      listingId: listing.id,
      checkIn: daysFromNow(1),
      checkOut: daysFromNow(3),
    });
    const updated = await bookingService.update(booking.id, userId, {
      status: "confirmed",
    });
    expect(updated.status).toBe("confirmed");
  });

  it("update rejects an unknown status", async () => {
    const listing = await makeListing();
    const booking = await bookingService.create(userId, {
      listingId: listing.id,
      checkIn: daysFromNow(1),
      checkOut: daysFromNow(3),
    });
    await expect(
      bookingService.update(booking.id, userId, { status: "bogus" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("update throws ApiError(403) for a non-owner", async () => {
    const listing = await makeListing();
    const booking = await bookingService.create(userId, {
      listingId: listing.id,
      checkIn: daysFromNow(1),
      checkOut: daysFromNow(3),
    });
    await expect(
      bookingService.update(booking.id, otherId, { status: "confirmed" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("remove cancels a pending booking", async () => {
    const listing = await makeListing();
    const booking = await bookingService.create(userId, {
      listingId: listing.id,
      checkIn: daysFromNow(1),
      checkOut: daysFromNow(3),
    });
    const cancelled = await bookingService.remove(booking.id, userId);
    expect(cancelled.status).toBe("cancelled");
    // still persisted, not deleted
    const stored = await Booking.findById(booking.id);
    expect(stored.status).toBe("cancelled");
  });
});
