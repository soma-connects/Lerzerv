import { z } from 'zod';
import { supabase } from '../lib/supabase';
import type { IApiResponse } from '../types/api';

export const JobSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2, 'Job title must be at least 2 characters'),
  department: z.string().min(2, 'Department/Category must be at least 2 characters'),
  location: z.string().min(2, 'Location description is required'),
  type: z.string().min(2, 'Job type or tag is required'),
  role_type: z.enum(['artisan', 'corporate'])
});

export type TJob = z.infer<typeof JobSchema> & { id: string };
export type TNewJob = z.infer<typeof JobSchema>;

export const defaultJobs: TNewJob[] = [
  {
    title: 'Operations Manager',
    department: 'Logistics',
    location: 'Lagos, Nigeria',
    type: 'Full-time',
    role_type: 'corporate'
  },
  {
    title: 'Frontend Engineer (React)',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    role_type: 'corporate'
  },
  {
    title: 'Growth Specialist',
    department: 'Marketing',
    location: 'Abuja, Nigeria',
    type: 'Full-time',
    role_type: 'corporate'
  },
  {
    title: 'Customer Success Lead',
    department: 'Operations',
    location: 'Lagos, Nigeria',
    type: 'Full-time',
    role_type: 'corporate'
  },
  {
    title: 'Certified Electrician',
    department: 'Electrical Services',
    location: 'Lagos (Lekki, Ikeja, Yaba)',
    type: 'Apply for this role',
    role_type: 'artisan'
  },
  {
    title: 'Master Plumber',
    department: 'Plumbing Services',
    location: 'Lagos (Gbagada, Surulere, Victoria Island)',
    type: 'Apply for this role',
    role_type: 'artisan'
  },
  {
    title: 'Generator Technician',
    department: 'Power Generator Maintenance',
    location: 'Lagos (Ikorodu, Maryland, Festac)',
    type: 'Apply for this role',
    role_type: 'artisan'
  },
  {
    title: 'AC & Cooling Expert',
    department: 'HVAC Maintenance',
    location: 'Lagos (Island & Mainland)',
    type: 'Apply for this role',
    role_type: 'artisan'
  },
  {
    title: 'Carpenter & Woodwork',
    department: 'Woodwork & Furniture',
    location: 'Lagos (Ikoyi, Ajah, Yaba)',
    type: 'Apply for this role',
    role_type: 'artisan'
  }
];

export const jobService = {
  /**
   * Fetch all open job positions from Supabase.
   */
  fetchJobs: async (): Promise<IApiResponse<TJob[]>> => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: (data || []) as TJob[] };
    } catch (err: any) {
      console.error('Failed to fetch job positions:', err);
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: err.message || 'Failed to fetch jobs.' }
      };
    }
  },

  /**
   * Add a new job position.
   */
  addJob: async (job: TNewJob): Promise<IApiResponse<TJob>> => {
    try {
      const validated = JobSchema.parse(job);
      const { data, error } = await supabase
        .from('jobs')
        .insert([validated])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: data as TJob };
    } catch (err: any) {
      console.error('Failed to add job position:', err);
      return {
        success: false,
        error: {
          code: err instanceof z.ZodError ? 'VALIDATION_ERROR' : 'DATABASE_ERROR',
          message: err.message || 'Failed to add job position.'
        }
      };
    }
  },

  /**
   * Delete a job position.
   */
  deleteJob: async (id: string): Promise<IApiResponse<any>> => {
    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Failed to delete job position:', err);
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: err.message || 'Failed to delete job position.' }
      };
    }
  },

  /**
   * Seed the default jobs into the database.
   */
  seedDefaultJobs: async (): Promise<IApiResponse<any>> => {
    try {
      const { error } = await supabase
        .from('jobs')
        .insert(defaultJobs);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Failed to seed default jobs:', err);
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: err.message || 'Failed to seed default jobs.' }
      };
    }
  }
};
