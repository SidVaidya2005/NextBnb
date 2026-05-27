export interface Booking {
  _id: string;
  user: string;
  listing: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'cancelled';
}
