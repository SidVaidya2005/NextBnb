import { apiClient } from "./client";
import type { User } from "../types/User";

export async function fetchMe(): Promise<User> {
  const { data } = await apiClient.get<User>("/auth/me");
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export function googleLoginUrl(): string {
  return `${import.meta.env.VITE_API_BASE_URL}/auth/google`;
}
