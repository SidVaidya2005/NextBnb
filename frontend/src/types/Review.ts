export interface ReviewAuthor {
  _id: string;
  name?: string;
  avatar?: string;
}

export interface Review {
  _id: string;
  author: ReviewAuthor;
  listing: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface CreateReviewInput {
  listing: string;
  rating: number;
  comment?: string;
}
