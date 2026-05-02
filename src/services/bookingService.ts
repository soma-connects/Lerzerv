import { apiClient } from './apiClient';
import type { IBookingRequest, IApiResponse } from '../types/api';

/**
 * Service for handling home service bookings.
 */
export const bookingService = {
  /**
   * Submit a new booking request.
   */
  submitBooking: async (request: IBookingRequest): Promise<IApiResponse<any>> => {
    return apiClient<IApiResponse<any>>('/bookings', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Fetch booking status by ID.
   */
  getBookingStatus: async (id: string): Promise<IApiResponse<any>> => {
    return apiClient<IApiResponse<any>>(`/bookings/${id}`, {
      method: 'GET',
    });
  }
};
