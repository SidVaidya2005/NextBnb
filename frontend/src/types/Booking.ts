import type { Listing } from "./Listing";

export type BookingStatus = "pending" | "confirmed" | "cancelled";

export interface BookingGuests {
  adults: number;
  children: number;
  infants: number;
  pets: number;
}

export interface Booking {
  _id: string;
  user: string;
  listing: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  guests: BookingGuests;
  status: BookingStatus;
}

// The list endpoint populates the listing; trip cards render off it.
export interface PopulatedBooking extends Omit<Booking, "listing"> {
  listing: Listing;
}

export interface CreateBookingInput {
  listingId: string;
  checkIn: string;
  checkOut: string;
  guests: BookingGuests;
}
