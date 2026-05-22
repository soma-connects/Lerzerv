import { z } from 'zod';
import { supabase } from '../lib/supabase';
import type { IApiResponse } from '../types/api';

export const ContactSubmissionSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional().nullable(),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters')
});

export type TContactSubmission = z.infer<typeof ContactSubmissionSchema>;

/**
 * Service for handling contact form inquiries via Supabase.
 */
export const contactService = {
  /**
   * Submit a contact inquiry.
   */
  submitInquiry: async (submission: TContactSubmission): Promise<IApiResponse<any>> => {
    try {
      // Validate schema at the boundary
      const validated = ContactSubmissionSchema.parse(submission);

      const { data, error } = await supabase
        .from('contact_inquiries')
        .insert([{
          name: validated.name,
          email: validated.email,
          phone: validated.phone || null,
          subject: validated.subject,
          message: validated.message
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error('Failed to submit contact inquiry to Supabase:', err);
      return { 
        success: false, 
        error: { 
          code: err instanceof z.ZodError ? 'VALIDATION_ERROR' : 'DATABASE_ERROR', 
          message: err.message || 'Failed to submit message to database.' 
        } 
      };
    }
  }
};

