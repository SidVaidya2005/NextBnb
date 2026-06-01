export interface User {
  _id: string;
  provider: "google";
  providerId: string;
  email?: string;
  name?: string;
  avatar?: string;
}
