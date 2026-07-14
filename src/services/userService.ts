import { z } from 'zod';
import { supabase } from '../lib/supabase';
import type { IApiResponse } from '../types/api';

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  full_name: z.string().nullable().optional(),
  role: z.enum(['user', 'admin']),
  created_at: z.string().optional()
});

export type TUserProfile = z.infer<typeof UserProfileSchema>;

export const userService = {
  /**
   * Update the current user's own display name (profiles + auth metadata).
   */
  updateMyProfile: async (fullName: string): Promise<IApiResponse<null>> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in.');
      const { error: pErr } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id);
      if (pErr) throw pErr;
      const { error: aErr } = await supabase.auth.updateUser({ data: { full_name: fullName } });
      if (aErr) throw aErr;
      return { success: true, data: null };
    } catch (err: any) {
      return { success: false, error: { code: 'PROFILE_ERROR', message: err.message || 'Failed to update profile.' } };
    }
  },

  /**
   * Send a password-reset link to the current user's email.
   */
  sendPasswordReset: async (email: string): Promise<IApiResponse<null>> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      return { success: true, data: null };
    } catch (err: any) {
      return { success: false, error: { code: 'AUTH_ERROR', message: err.message || 'Failed to send reset link.' } };
    }
  },

  /**
   * Fetch all registered users from the public profiles table.
   */
  fetchUsers: async (): Promise<IApiResponse<TUserProfile[]>> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: (data || []) as TUserProfile[] };
    } catch (err: any) {
      console.error('Failed to fetch user profiles:', err);
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: err.message || 'Failed to fetch users.' }
      };
    }
  },

  /**
   * Update the role of a user (e.g. promoting to admin or demoting).
   */
  updateUserRole: async (id: string, role: 'user' | 'admin'): Promise<IApiResponse<any>> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', id)
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error('Failed to update user role:', err);
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: err.message || 'Failed to update user role.' }
      };
    }
  },

  /**
   * Delete a user's profile from the dashboard database.
   */
  deleteUser: async (id: string): Promise<IApiResponse<any>> => {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Failed to delete user profile:', err);
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: err.message || 'Failed to delete user profile.' }
      };
    }
  }
};
