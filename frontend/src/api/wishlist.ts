import { apiClient } from './client';
import type { Listing } from '../types/Listing';

// TODO: wire to real endpoints once the wishlist feature is implemented.

export async function getWishlist(): Promise<Listing[]> {
  const { data } = await apiClient.get<Listing[]>('/api/wishlist');
  return data;
}

export async function addToWishlist(listingId: string): Promise<void> {
  await apiClient.post(`/api/wishlist/${listingId}`);
}

export async function removeFromWishlist(listingId: string): Promise<void> {
  await apiClient.delete(`/api/wishlist/${listingId}`);
}
