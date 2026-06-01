export interface Listing {
  _id: string;
  title: string;
  description?: string;
  image: string;
  price: number;
  location?: string;
  country?: string;
  rating?: number;
  reviewCount?: number;
  isGuestFavorite?: boolean;
  dates?: string;
}

export type NewListing = Omit<
  Listing,
  "_id" | "rating" | "reviewCount" | "isGuestFavorite" | "dates"
>;
