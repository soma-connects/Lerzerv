import { apiClient } from './apiClient';
import type { IContactSubmission, IApiResponse } from '../types/api';

/**
 * Service for handling contact form inquiries.
 */
export const contactService = {
  /**
   * Submit a contact inquiry.
   */
  submitInquiry: async (submission: IContactSubmission): Promise<IApiResponse<any>> => {
    return apiClient<IApiResponse<any>>('/contact', {
      method: 'POST',
      body: JSON.stringify(submission),
    });
  }
};
