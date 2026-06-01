import { apiClient } from "./client";
import type { Listing, NewListing } from "../types/Listing";

export async function listListings(): Promise<Listing[]> {
  const { data } = await apiClient.get<Listing[]>("/api/listings");
  return data;
}

export async function getListing(id: string): Promise<Listing> {
  const { data } = await apiClient.get<Listing>(`/api/listings/${id}`);
  return data;
}

export async function createListing(payload: NewListing): Promise<Listing> {
  const { data } = await apiClient.post<Listing>("/api/listings", payload);
  return data;
}

export async function updateListing(
  id: string,
  payload: Partial<NewListing>,
): Promise<Listing> {
  const { data } = await apiClient.put<Listing>(`/api/listings/${id}`, payload);
  return data;
}

export async function deleteListing(id: string): Promise<void> {
  await apiClient.delete(`/api/listings/${id}`);
}
