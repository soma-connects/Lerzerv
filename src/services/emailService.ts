import type { IBookingRequest } from '../types/api';
import { supabase } from '../lib/supabase';

/**
 * Service to handle sending emails to Lezerv Gmail and Customers.
 * Uses a Supabase Edge Function to securely call the Resend API on the server side.
 */

export const emailService = {
  /**
   * Securely sends an email via the Supabase Edge Function which uses Resend.
   */
  sendEmailViaResend: async (to: string | string[], subject: string, html: string, from?: string): Promise<boolean> => {
    try {
      console.log(`[Email Service] Attempting to send email via Resend Edge Function to: ${Array.isArray(to) ? to.join(', ') : to}`);
      
      const { data, error } = await supabase.functions.invoke('resend-email', {
        body: {
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
          from: from || 'Lezerv <onboarding@resend.dev>'
        }
      });

      if (error) {
        console.error('[Email Service] Edge Function returned error:', error);
        return false;
      }

      console.log('[Email Service] Email sent successfully via Resend:', data);
      return true;
    } catch (err) {
      console.error('[Email Service] Failed to send email via Resend Edge Function:', err);
      return false;
    }
  },

  /**
   * Sends a booking confirmation email to Lezerv and the customer.
   */
  sendBookingEmail: async (booking: IBookingRequest): Promise<boolean> => {
    // For local development/testing, we log it
    console.log('[Email Service] Preparing to send booking email to Lezervlimited@gmail.com and pauljizy@gmail.com', booking);

    const subject = `New Booking Confirmation - ${booking.serviceName}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #4f46e5; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px; margin-top: 0;">Lezerv Booking Confirmed</h2>
        <p>Hello <strong>${booking.customer.name}</strong>,</p>
        <p>Thank you for choosing Lezerv. Your booking for <strong>${booking.serviceName}</strong> has been successfully placed!</p>
        
        <h3 style="color: #1f2937; margin-top: 20px; border-bottom: 1px solid #f3f4f6; padding-bottom: 5px;">Booking Details</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
          <tr>
            <td style="padding: 8px 0; color: #4b5563; font-weight: bold; width: 120px;">Service:</td>
            <td style="padding: 8px 0; color: #111827;">${booking.serviceName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #4b5563; font-weight: bold;">Date & Time:</td>
            <td style="padding: 8px 0; color: #111827;">${booking.date} at ${booking.time}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #4b5563; font-weight: bold;">Details:</td>
            <td style="padding: 8px 0; color: #111827;">${booking.details || 'None'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #4b5563; font-weight: bold;">Location:</td>
            <td style="padding: 8px 0; color: #111827;">${booking.location.address}${booking.location.estate ? `, ${booking.location.estate}` : ''}, ${booking.location.city}</td>
          </tr>
        </table>
        
        <h3 style="color: #1f2937; margin-top: 20px; border-bottom: 1px solid #f3f4f6; padding-bottom: 5px;">Customer Contact</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
          <tr>
            <td style="padding: 8px 0; color: #4b5563; font-weight: bold; width: 120px;">Phone:</td>
            <td style="padding: 8px 0; color: #111827;">${booking.customer.phone}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #4b5563; font-weight: bold;">Email:</td>
            <td style="padding: 8px 0; color: #111827;">${booking.customer.email}</td>
          </tr>
        </table>

        <div style="margin-top: 30px; padding: 15px; background-color: #f9fafb; border-radius: 6px; font-size: 0.9rem; color: #6b7280; text-align: center;">
          Need to make changes? Contact us at <a href="mailto:support@lezserv.com" style="color: #4f46e5; text-decoration: none;">support@lezserv.com</a>.
        </div>
      </div>
    `;

    // Try sending to customer
    const customerSent = await emailService.sendEmailViaResend(
      booking.customer.email, 
      subject, 
      html
    );

    // Send warning/copy to internal admins
    await emailService.sendEmailViaResend(
      ['Lezervlimited@gmail.com', 'pauljizy@gmail.com'],
      `[New Booking Alert] ${booking.serviceName} - ${booking.customer.name}`,
      html
    );

    return customerSent;
  },

  /**
   * Sends a welcome email containing their referral code.
   */
  sendAmbassadorWelcomeEmail: async (name: string, email: string, referralCode: string): Promise<boolean> => {
    console.log('[Email Service] Preparing to send welcome email to ambassador:', email, { name, referralCode });
    
    const subject = `Welcome to the Lezerv Ambassador Program!`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #4f46e5; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px; margin-top: 0;">Welcome, ${name}!</h2>
        <p>Thank you for joining the Lezerv Ambassador Program. We are thrilled to have you partner with us to bring premium home services to Nigeria!</p>
        
        <div style="margin: 25px 0; padding: 20px; background: linear-gradient(135deg, #4f46e5, #4338ca); border-radius: 8px; color: white; text-align: center;">
          <p style="margin: 0 0 10px 0; font-size: 1.1rem; opacity: 0.9;">Your Unique Referral Code</p>
          <h2 style="margin: 0; font-size: 2.5rem; letter-spacing: 2px; font-weight: bold;">${referralCode}</h2>
        </div>

        <p>Share your referral code with friends, family, and your network. When they book a service using your code:</p>
        <ul style="color: #4b5563; line-height: 1.6;">
          <li>They get a discount on their first booking.</li>
          <li>You earn points which translate to cash payouts and rewards!</li>
        </ul>

        <div style="margin-top: 30px; padding: 15px; background-color: #f9fafb; border-radius: 6px; font-size: 0.9rem; color: #6b7280; text-align: center;">
          Access your ambassador dashboard to track your earnings, referrals, and performance.
        </div>
      </div>
    `;

    return await emailService.sendEmailViaResend(email, subject, html);
  },

  /**
   * Sends a notification to Lezerv admin that a customer has claimed to make a payment.
   */
  sendPaymentNotificationEmail: async (orderNumber: string, customerName: string, amount: string): Promise<boolean> => {
    console.log('[Email Service] Admin Notification: Customer marked payment as complete.', {
      to: ['Lezervlimited@gmail.com', 'pauljizy@gmail.com'],
      orderNumber,
      customerName,
      amount
    });

    const subject = `[PAYMENT SUBMITTED] Order #${orderNumber} - ${customerName}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #10b981; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px; margin-top: 0;">Payment Submitted</h2>
        <p>A customer has marked their booking payment as completed via bank transfer.</p>
        
        <h3 style="color: #1f2937; margin-top: 20px;">Payment Details</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
          <tr>
            <td style="padding: 8px 0; color: #4b5563; font-weight: bold; width: 150px;">Order Number:</td>
            <td style="padding: 8px 0; color: #111827; font-weight: bold;">#${orderNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #4b5563; font-weight: bold;">Customer Name:</td>
            <td style="padding: 8px 0; color: #111827;">${customerName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #4b5563; font-weight: bold;">Claimed Amount:</td>
            <td style="padding: 8px 0; color: #10b981; font-weight: bold;">${amount}</td>
          </tr>
        </table>
        
        <div style="margin-top: 30px; padding: 15px; background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; font-size: 0.9rem; color: #b45309;">
          <strong>Next Step:</strong> Please verify your bank account for this payment. Once verified, go to the Admin Dashboard and approve this order.
        </div>
      </div>
    `;

    return await emailService.sendEmailViaResend(
      ['Lezervlimited@gmail.com', 'pauljizy@gmail.com'],
      subject,
      html
    );
  }
};
