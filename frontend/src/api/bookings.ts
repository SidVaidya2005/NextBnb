import { apiClient } from './client';
import type { Booking } from '../types/Booking';

// TODO: wire to real endpoints once the booking feature is implemented.

export async function listMyBookings(): Promise<Booking[]> {
  const { data } = await apiClient.get<Booking[]>('/api/bookings');
  return data;
}

export async function createBooking(_payload: Partial<Booking>): Promise<Booking> {
  const { data } = await apiClient.post<Booking>('/api/bookings', _payload);
  return data;
}

export async function cancelBooking(id: string): Promise<void> {
  await apiClient.delete(`/api/bookings/${id}`);
}
