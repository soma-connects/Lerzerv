import { z } from 'zod';
import { supabase } from '../lib/supabase';
import type { IApiResponse } from '../types/api';

// ─── Schemas ───────────────────────────────────────────

export const AmbassadorApplicationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('A valid email is required'),
  phone: z.string().min(8, 'A valid phone number is required'),
  reason: z.string().min(10, 'Please tell us why you want to be an ambassador (at least 10 characters)')
});

export type TAmbassadorApplication = z.infer<typeof AmbassadorApplicationSchema>;

export type TAmbassador = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  reason: string;
  referral_code: string;
  total_points: number;
  total_referrals: number;
  status: 'pending' | 'approved' | 'suspended' | 'rejected';
  created_at: string;
};

export type TReferral = {
  id: string;
  ambassador_id: string;
  referral_code: string;
  referred_email: string | null;
  referred_user_id: string | null;
  referred_booking_id: string | null;
  status: 'clicked' | 'signed_up' | 'booked' | 'completed' | 'expired';
  points_awarded: number;
  discount_applied: boolean;
  created_at: string;
};

// ─── Constants ─────────────────────────────────────────

const REFERRAL_STORAGE_KEY = 'lezerv_ref_code';
const POINTS_PER_REFERRAL = 100;

// ─── Helper: Generate unique referral code ─────────────

function generateReferralCode(name: string): string {
  const cleanName = name.replace(/\s+/g, '').toUpperCase().slice(0, 6);
  const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `LZ-REF-${cleanName}${randomSuffix}`;
}

// ─── Service ───────────────────────────────────────────

export const ambassadorService = {

  // ──────────────────────────────────────────────────────
  // Application & Profile
  // ──────────────────────────────────────────────────────

  /**
   * Submit an application to become an ambassador.
   * Creates a record with status='pending' — admin must approve.
   */
  applyToProgram: async (application: TAmbassadorApplication): Promise<IApiResponse<TAmbassador>> => {
    try {
      const validated = AmbassadorApplicationSchema.parse(application);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: { code: 'AUTH_REQUIRED', message: 'You must be logged in to apply.' } };
      }

      // Check for existing application
      const { data: existing } = await supabase
        .from('ambassadors')
        .select('id, status')
        .eq('user_id', user.id)
        .single();

      if (existing) {
        return {
          success: false,
          error: {
            code: 'ALREADY_EXISTS',
            message: existing.status === 'pending'
              ? 'You already have a pending application.'
              : existing.status === 'approved'
                ? 'You are already an ambassador!'
                : 'You already have an application on file. Please contact support.'
          }
        };
      }

      const referralCode = generateReferralCode(validated.name);

      const { data, error } = await supabase
        .from('ambassadors')
        .insert([{
          user_id: user.id,
          name: validated.name,
          email: validated.email,
          phone: validated.phone,
          reason: validated.reason,
          referral_code: referralCode,
          total_points: 0,
          total_referrals: 0,
          status: 'pending'
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: data as TAmbassador };
    } catch (err: any) {
      console.error('Ambassador application failed:', err);
      return {
        success: false,
        error: {
          code: err instanceof z.ZodError ? 'VALIDATION_ERROR' : 'DATABASE_ERROR',
          message: err.message || 'Failed to submit application.'
        }
      };
    }
  },

  /**
   * Fetch the current user's ambassador profile (if any).
   */
  getMyAmbassadorProfile: async (): Promise<TAmbassador | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('ambassadors')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error || !data) return null;
      return data as TAmbassador;
    } catch {
      return null;
    }
  },

  // ──────────────────────────────────────────────────────
  // Referral Tracking
  // ──────────────────────────────────────────────────────

  /**
   * Capture a ?ref= query parameter from the URL and store in localStorage.
   * Called once on app load from App.tsx.
   */
  captureReferralCode: (): void => {
    try {
      const params = new URLSearchParams(window.location.search);
      const refCode = params.get('ref');
      if (refCode && refCode.trim()) {
        localStorage.setItem(REFERRAL_STORAGE_KEY, refCode.trim().toUpperCase());
      }
    } catch (e) {
      console.warn('Failed to capture referral code:', e);
    }
  },

  /**
   * Get the stored referral code from localStorage (if any).
   */
  getReferralCode: (): string | null => {
    try {
      return localStorage.getItem(REFERRAL_STORAGE_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Remove the stored referral code from localStorage (after it has been used).
   */
  consumeReferralCode: (): void => {
    try {
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
    } catch {
      // silent
    }
  },

  /**
   * Record a referral click event (visitor arrived via referral link).
   */
  trackReferralClick: async (code: string): Promise<void> => {
    try {
      // Verify ambassador exists and is active
      const { data: ambassador } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('referral_code', code.toUpperCase())
        .eq('status', 'approved')
        .single();

      if (!ambassador) return;

      await supabase.from('referrals').insert([{
        ambassador_id: ambassador.id,
        referral_code: code.toUpperCase(),
        status: 'clicked',
        points_awarded: 0,
        discount_applied: false
      }]);
    } catch (err) {
      console.warn('Referral click tracking failed:', err);
    }
  },

  /**
   * Attach a referral to a user signup. Updates the latest 'clicked' referral
   * for this code to 'signed_up'.
   */
  attachReferralToSignup: async (userId: string, email: string, code: string): Promise<void> => {
    try {
      const { data: ambassador } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('referral_code', code.toUpperCase())
        .eq('status', 'approved')
        .single();

      if (!ambassador) return;

      // Try to find an existing 'clicked' referral to upgrade
      const { data: existingReferral } = await supabase
        .from('referrals')
        .select('id')
        .eq('ambassador_id', ambassador.id)
        .eq('referral_code', code.toUpperCase())
        .eq('status', 'clicked')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingReferral) {
        await supabase
          .from('referrals')
          .update({
            referred_user_id: userId,
            referred_email: email,
            status: 'signed_up'
          })
          .eq('id', existingReferral.id);
      } else {
        // No click was recorded (e.g. user had code in localStorage from before)
        await supabase.from('referrals').insert([{
          ambassador_id: ambassador.id,
          referral_code: code.toUpperCase(),
          referred_user_id: userId,
          referred_email: email,
          status: 'signed_up',
          points_awarded: 0,
          discount_applied: false
        }]);
      }
    } catch (err) {
      console.warn('Referral signup attribution failed:', err);
    }
  },

  /**
   * Attach a referral to a booking. Updates or creates a referral record
   * with status='booked'.
   */
  attachReferralToBooking: async (bookingId: string, code: string): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: ambassador } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('referral_code', code.toUpperCase())
        .eq('status', 'approved')
        .single();

      if (!ambassador) return;

      // Prevent self-referral
      const { data: selfCheck } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('user_id', user?.id ?? '')
        .eq('id', ambassador.id)
        .single();

      if (selfCheck) {
        console.warn('Self-referral attempt blocked.');
        return;
      }

      // Try to upgrade an existing signed_up referral for this user
      const { data: existingReferral } = await supabase
        .from('referrals')
        .select('id')
        .eq('ambassador_id', ambassador.id)
        .eq('referred_user_id', user?.id ?? '')
        .in('status', ['clicked', 'signed_up'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingReferral) {
        await supabase
          .from('referrals')
          .update({
            referred_booking_id: bookingId,
            status: 'booked',
            discount_applied: true
          })
          .eq('id', existingReferral.id);
      } else {
        await supabase.from('referrals').insert([{
          ambassador_id: ambassador.id,
          referral_code: code.toUpperCase(),
          referred_user_id: user?.id ?? null,
          referred_booking_id: bookingId,
          status: 'booked',
          points_awarded: 0,
          discount_applied: true
        }]);
      }

      // Consume the referral code after successful booking attribution
      ambassadorService.consumeReferralCode();
    } catch (err) {
      console.warn('Referral booking attribution failed:', err);
    }
  },

  /**
   * Award points to the ambassador when a booking is completed.
   * Called from the admin flow when a booking status changes to 'completed'.
   */
  completeReferral: async (bookingId: string): Promise<void> => {
    try {
      // Find a referral linked to this booking
      const { data: referral } = await supabase
        .from('referrals')
        .select('id, ambassador_id, status')
        .eq('referred_booking_id', bookingId)
        .eq('status', 'booked')
        .single();

      if (!referral) return; // No referral attached or already completed

      // Update referral status and award points
      await supabase
        .from('referrals')
        .update({
          status: 'completed',
          points_awarded: POINTS_PER_REFERRAL
        })
        .eq('id', referral.id);

      // Increment ambassador's total points and referral count
      const { data: ambassador } = await supabase
        .from('ambassadors')
        .select('total_points, total_referrals')
        .eq('id', referral.ambassador_id)
        .single();

      if (ambassador) {
        await supabase
          .from('ambassadors')
          .update({
            total_points: (ambassador.total_points || 0) + POINTS_PER_REFERRAL,
            total_referrals: (ambassador.total_referrals || 0) + 1
          })
          .eq('id', referral.ambassador_id);
      }
    } catch (err) {
      console.warn('Referral completion failed:', err);
    }
  },

  // ──────────────────────────────────────────────────────
  // Ambassador Dashboard Data
  // ──────────────────────────────────────────────────────

  /**
   * Fetch all referrals for the current ambassador.
   */
  getMyReferrals: async (): Promise<TReferral[]> => {
    try {
      const profile = await ambassadorService.getMyAmbassadorProfile();
      if (!profile) return [];

      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('ambassador_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as TReferral[];
    } catch {
      return [];
    }
  },

  // ──────────────────────────────────────────────────────
  // Admin Functions
  // ──────────────────────────────────────────────────────

  /**
   * Fetch all ambassador applications/records (admin only).
   */
  fetchAllAmbassadors: async (): Promise<IApiResponse<TAmbassador[]>> => {
    try {
      const { data, error } = await supabase
        .from('ambassadors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: (data || []) as TAmbassador[] };
    } catch (err: any) {
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: err.message || 'Failed to fetch ambassadors.' }
      };
    }
  },

  /**
   * Update an ambassador's status (approve, reject, suspend).
   */
  updateAmbassadorStatus: async (
    id: string,
    status: 'approved' | 'rejected' | 'suspended'
  ): Promise<IApiResponse<any>> => {
    try {
      const { data, error } = await supabase
        .from('ambassadors')
        .update({ status })
        .eq('id', id)
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: err.message || 'Failed to update ambassador status.' }
      };
    }
  },

  /**
   * Manually adjust an ambassador's points (admin only).
   */
  adjustPoints: async (id: string, points: number): Promise<IApiResponse<any>> => {
    try {
      const { data: ambassador } = await supabase
        .from('ambassadors')
        .select('total_points')
        .eq('id', id)
        .single();

      if (!ambassador) throw new Error('Ambassador not found.');

      const newTotal = Math.max(0, (ambassador.total_points || 0) + points);

      const { error } = await supabase
        .from('ambassadors')
        .update({ total_points: newTotal })
        .eq('id', id);

      if (error) throw error;
      return { success: true, data: { total_points: newTotal } };
    } catch (err: any) {
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: err.message || 'Failed to adjust points.' }
      };
    }
  }
};
