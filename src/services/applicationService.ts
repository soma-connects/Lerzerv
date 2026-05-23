import { z } from 'zod';
import { supabase } from '../lib/supabase';
import type { IApiResponse } from '../types/api';

export const JobApplicationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 characters'),
  role_title: z.string().min(1, 'Role title is required'),
  role_type: z.enum(['artisan', 'corporate']),
  experience: z.string().min(1, 'Experience information is required'),
  message: z.string().optional(),
  cv_url: z.string().url('Please enter a valid CV or Portfolio URL (e.g. Google Drive, Dropbox, or resume link)').optional().or(z.literal('')).nullable()
});

export type TJobApplication = z.infer<typeof JobApplicationSchema>;

export const applicationService = {
  /**
   * Submit a job application to Supabase.
   */
  submitApplication: async (application: TJobApplication): Promise<IApiResponse<any>> => {
    try {
      // Validate schema at the boundary
      const validated = JobApplicationSchema.parse(application);

      const { data, error } = await supabase
        .from('job_applications')
        .insert([{
          name: validated.name,
          email: validated.email,
          phone: validated.phone,
          role_title: validated.role_title,
          role_type: validated.role_type,
          experience: validated.experience,
          message: validated.message || null,
          cv_url: validated.cv_url
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error('Failed to submit job application to Supabase:', err);
      return {
        success: false,
        error: {
          code: err instanceof z.ZodError ? 'VALIDATION_ERROR' : 'DATABASE_ERROR',
          message: err.message || 'Failed to submit application to database.'
        }
      };
    }
  },

  /**
   * Fetch all job applications.
   */
  getApplications: async (): Promise<IApiResponse<any[]>> => {
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (err: any) {
      console.error('Failed to fetch job applications from Supabase:', err);
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: err.message || 'Failed to fetch job applications from database.'
        }
      };
    }
  },

  /**
   * Realtime subscription for career applications.
   */
  subscribeToNewApplications: (onNewApplication: (app: any) => void) => {
    const channel = supabase
      .channel('realtime_job_applications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_applications' },
        (payload) => {
          onNewApplication(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
