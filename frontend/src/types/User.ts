export interface User {
  _id: string;
  provider: 'google' | 'github';
  providerId: string;
  email?: string;
  name?: string;
  avatar?: string;
}
