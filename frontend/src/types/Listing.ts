export interface Listing {
  _id: string;
  title: string;
  description?: string;
  image: string;
  price: number;
  location?: string;
  country?: string;
  owner?: string;
  rating?: number;
  reviewCount?: number;
  isGuestFavorite?: boolean;
}

export type NewListing = Omit<
  Listing,
  "_id" | "owner" | "rating" | "reviewCount" | "isGuestFavorite"
>;
