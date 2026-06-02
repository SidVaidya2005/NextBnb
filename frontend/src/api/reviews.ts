import { apiClient } from "./client";
import type { Review, CreateReviewInput } from "../types/Review";

export async function listReviewsForListing(
  listingId: string,
): Promise<Review[]> {
  const { data } = await apiClient.get<Review[]>("/api/reviews", {
    params: { listingId },
  });
  return data;
}

export async function createReview(
  payload: CreateReviewInput,
): Promise<Review> {
  const { data } = await apiClient.post<Review>("/api/reviews", payload);
  return data;
}

export async function deleteReview(id: string): Promise<void> {
  await apiClient.delete(`/api/reviews/${id}`);
}
