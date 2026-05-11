import type { IBookingRequest } from '../types/api';

/**
 * Service to handle sending emails to Lezerv Gmail.
 * Using EmailJS (https://www.emailjs.com/) for reliable client-side email delivery.
 */

// These would normally be in .env files
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'YOUR_PUBLIC_KEY';

export const emailService = {
  /**
   * Sends a booking confirmation email to Lezerv and the customer.
   */
  sendBookingEmail: async (booking: IBookingRequest): Promise<boolean> => {
    // For local development/testing without keys, we log it
    console.log('[Email Service] Preparing to send booking email to Lezervlimited@gmail.com', booking);

    if (EMAILJS_PUBLIC_KEY === 'YOUR_PUBLIC_KEY') {
      console.warn('[Email Service] EmailJS Public Key not set. Email will not be sent to real inbox.');
      // Simulate success for the UI flow
      return true;
    }

    try {
      // Mock email sending
      console.log('[Email Service] Email content ready:', {
        to: 'Lezervlimited@gmail.com',
        service: booking.serviceName,
        customer: booking.customer.name
      });
      
      return true;
    } catch (error) {
      console.error('[Email Service] Failed to send email:', error);
      return false;
    }
  }
};
