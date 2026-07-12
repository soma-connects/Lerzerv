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

const REFERRAL_STORAGE_KEY = 'lezerv_ref_code';
// Points per referral now lives server-side in the complete_referral() RPC

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
   * Creates a record with status='approved' instantly.
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
            message: 'You are already an ambassador!'
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
          status: 'approved'
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
      // Secure RPC: validates the code server-side (RLS blocks direct writes)
      await supabase.rpc('track_referral_click', { p_code: code });
    } catch (err) {
      console.warn('Referral click tracking failed:', err);
    }
  },

  /**
   * Attach a referral to a user signup. Updates the latest 'clicked' referral
   * for this code to 'signed_up'.
   */
  attachReferralToSignup: async (_userId: string, email: string, code: string): Promise<void> => {
    try {
      // Secure RPC: attributes to the *signed-in* user server-side,
      // with self-referral guard (RLS blocks direct writes)
      await supabase.rpc('attach_referral_to_signup', { p_code: code, p_email: email });
    } catch (err) {
      console.warn('Referral signup attribution failed:', err);
    }
  },

  /**
   * Attach a referral to a booking. Updates or creates a referral record
   * with status='booked'.
   */
  attachReferralToBooking: async (bookingId: string, code: string, referredEmail?: string): Promise<void> => {
    try {
      // Secure RPC: validates code, booking, and self-referral server-side
      // (RLS blocks direct writes to referrals)
      await supabase.rpc('attach_referral_to_booking', {
        p_booking_id: bookingId,
        p_code: code,
        p_email: referredEmail ?? null
      });

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
      // Secure RPC: admin-only server-side; awards points atomically
      await supabase.rpc('complete_referral', { p_booking_id: bookingId });
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
  },

  /**
   * Fetch the leaderboard data (top active ambassadors by points).
   */
  getLeaderboard: async (limitCount = 10): Promise<any[]> => {
    try {
      // Secure RPC: returns only name/points/referrals of approved,
      // non-admin ambassadors (RLS blocks direct reads of the table)
      const { data, error } = await supabase
        .rpc('get_leaderboard', { p_limit: limitCount });

      if (error) throw error;

      // Mock participants to keep the leaderboard populated and engaging
      const mockParticipants = [
        { name: 'Chidi O.', total_points: 150, total_referrals: 30 },
        { name: 'Fatima A.', total_points: 95, total_referrals: 19 },
        { name: 'Tunde B.', total_points: 60, total_referrals: 12 },
        { name: 'Olumide S.', total_points: 45, total_referrals: 9 },
        { name: 'Amara K.', total_points: 15, total_referrals: 3 }
      ];

      const realData: { name: string; total_points: number; total_referrals: number }[] = data || [];
      const realNames = new Set(realData.map(r => r.name.toLowerCase()));
      
      // Filter out mock participants if their name overlaps with real users
      const filteredMocks = mockParticipants.filter(m => !realNames.has(m.name.toLowerCase()));
      
      const combined = [...realData, ...filteredMocks]
        .sort((a, b) => (b.total_points || 0) - (a.total_points || 0))
        .slice(0, limitCount);

      return combined;
    } catch (err) {
      console.warn('Failed to fetch leaderboard:', err);
      return [];
    }
  }
};
