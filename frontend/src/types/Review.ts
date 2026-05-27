export interface Review {
  _id: string;
  author: string;
  listing: string;
  rating: number;
  comment?: string;
  createdAt: string;
}
