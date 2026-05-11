import type { IBookingRequest, IStoredBooking } from '../types/api';

const STORAGE_KEY = 'lezerv_bookings';

export const bookingStorage = {
  saveBooking: (booking: IBookingRequest): IStoredBooking => {
    const bookings = bookingStorage.getAllBookings();
    
    const newBooking: IStoredBooking = {
      ...booking,
      id: Math.random().toString(36).substring(2, 9),
      status: 'pending',
      createdAt: new Date().toISOString(),
      orderNumber: `LZ-${Math.floor(100000 + Math.random() * 900000)}`
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify([newBooking, ...bookings]));
    return newBooking;
  },

  getAllBookings: (): IStoredBooking[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      // Seed initial data for demo purposes
      const seedData: IStoredBooking[] = [
        {
          id: 'seed-1',
          serviceName: 'Professional Cleaning — Premium Service',
          details: 'Initial deep cleaning for move-in.',
          date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
          time: 'morning',
          location: { city: 'Lagos', estate: 'VGC', address: 'Plot 12, Road 4' },
          customer: { name: 'Paul Peters', phone: '08012345678', email: 'paul@example.com' },
          status: 'completed',
          createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
          orderNumber: 'LZ-849201'
        },
        {
          id: 'seed-2',
          serviceName: 'Power & Water Utilities — Generator Servicing',
          details: 'Mikano 20KVA routine check.',
          date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          time: 'afternoon',
          location: { city: 'Abuja', estate: 'Gwarinpa', address: 'House 5, 2nd Avenue' },
          customer: { name: 'Paul Peters', phone: '08012345678', email: 'paul@example.com' },
          status: 'confirmed',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          orderNumber: 'LZ-392810'
        }
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seedData));
      return seedData;
    }
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse bookings from localStorage', e);
      return [];
    }
  },

  getBookingById: (id: string): IStoredBooking | undefined => {
    const bookings = bookingStorage.getAllBookings();
    return bookings.find(b => b.id === id);
  }
};
