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
