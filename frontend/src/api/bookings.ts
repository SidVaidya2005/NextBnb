import { apiClient } from "./client";
import type {
  Booking,
  CreateBookingInput,
  PopulatedBooking,
} from "../types/Booking";

export async function listMyBookings(): Promise<PopulatedBooking[]> {
  const { data } = await apiClient.get<PopulatedBooking[]>("/api/bookings");
  return data;
}

export async function createBooking(
  payload: CreateBookingInput,
): Promise<Booking> {
  const { data } = await apiClient.post<Booking>("/api/bookings", payload);
  return data;
}

export async function cancelBooking(id: string): Promise<Booking> {
  const { data } = await apiClient.delete<Booking>(`/api/bookings/${id}`);
  return data;
}
