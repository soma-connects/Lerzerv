import type { IBookingRequest, IApiResponse, IStoredBooking } from '../types/api';
import { bookingStorage } from './bookingStorage';
import { emailService } from './emailService';
import { supabase } from '../lib/supabase';
import { ambassadorService } from './ambassadorService';

/**
 * Service for handling home service bookings.
 */
export const bookingService = {
  /**
   * Submit a new booking request.
   */
  submitBooking: async (request: IBookingRequest): Promise<IApiResponse<IStoredBooking>> => {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    try {
      // Create a unique order number
      const orderNo = `LZ-${Math.floor(100000 + Math.random() * 900000)}`;

      // Save to Supabase (Works for both Guests and Users)
      const { data, error } = await supabase
        .from('bookings')
        .insert([{
          service_name: request.serviceName,
          details: request.details,
          date: request.date,
          time: request.time,
          location: request.location,
          customer: request.customer,
          user_id: userId,
          status: 'pending',
          order_number: orderNo,
          payment_status: 'unpaid'
        }])
        .select()
        .single();
      
      if (error) throw error;

      // Save to local recent orders for "Quick Track" memory
      const recent = JSON.parse(localStorage.getItem('lezerv_recent_orders') || '[]');
      if (!recent.includes(data.order_number)) {
        recent.unshift(data.order_number);
        localStorage.setItem('lezerv_recent_orders', JSON.stringify(recent.slice(0, 5)));
      }

      // Send Email Notification
      try {
        await emailService.sendBookingEmail(request);
      } catch (e) {
        console.error('Email notification failed:', e);
      }

      // Attribute referral if a code was stored from a ?ref= link
      try {
        const refCode = ambassadorService.getReferralCode();
        if (refCode && data?.id) {
          await ambassadorService.attachReferralToBooking(data.id, refCode);
        }
      } catch (refErr) {
        console.warn('Referral attribution on booking failed:', refErr);
      }

      return { success: true, data: data as any };
    } catch (err: any) {
      console.error('Final booking failure:', err);
      return { success: false, error: { code: 'SUBMIT_ERROR', message: err.message || 'Failed to submit booking.' } };
    }
  },

  /**
   * Sync guest bookings from localStorage to Supabase.
   */
  syncGuestBookings: async (): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Sync full objects from old system (if any)
    const guestBookings = bookingStorage.getAllBookings();
    if (guestBookings.length > 0) {
      const cloudBookings = guestBookings.map(b => ({
        service_name: (b as any).serviceName || (b as any).service_name,
        details: b.details,
        date: b.date,
        time: b.time,
        location: b.location,
        customer: b.customer,
        user_id: user.id,
        status: b.status,
        order_number: (b as any).orderNumber || (b as any).order_number,
        payment_status: (b as any).payment_status || 'unpaid'
      }));

      const { error } = await supabase.from('bookings').insert(cloudBookings);
      if (!error) localStorage.removeItem('lezerv_bookings');
    }

    // 2. Sync order numbers from new system
    const recentNumbers = JSON.parse(localStorage.getItem('lezerv_recent_orders') || '[]');
    if (recentNumbers.length > 0) {
      await supabase
        .from('bookings')
        .update({ user_id: user.id })
        .in('order_number', recentNumbers)
        .is('user_id', null);
    }
  },

  /**
   * Fetch all bookings for the current user.
   */
  getMyBookings: async (): Promise<IStoredBooking[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (!error && data) return data as any;
    }

    return [];
  },

  /**
   * Fetch booking status by Order Number.
   */
  getBookingByOrder: async (orderNo: string): Promise<IApiResponse<IStoredBooking>> => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('order_number', orderNo.toUpperCase())
        .single();
      
      if (error || !data) throw new Error('Order not found');
      
      return { success: true, data: data as any };
    } catch (err: any) {
      return { success: false, error: { code: 'NOT_FOUND', message: err.message } };
    }
  }
};
