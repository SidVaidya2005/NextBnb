import { apiClient } from "./client";

export interface UploadResult {
  url: string;
  publicId: string;
}

// Posts a single image as multipart/form-data. The browser sets the multipart
// boundary itself, so we deliberately don't set Content-Type. The field name
// must be `image` to match the backend's multer config.
export async function uploadImage(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("image", file);
  const { data } = await apiClient.post<UploadResult>("/api/uploads", form);
  return data;
}
