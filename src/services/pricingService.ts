import { z } from 'zod';
import { supabase } from '../lib/supabase';
import type { IApiResponse } from '../types/api';

export const ServiceSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2, 'Service title must be at least 2 characters'),
  category: z.string().min(2, 'Category must be at least 2 characters'),
  price: z.string().min(1, 'Price description is required'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  features: z.array(z.string()).default([]),
  recommended: z.boolean().default(false)
});

export const PaymentSettingsSchema = z.object({
  bank_name: z.string().min(1, 'Bank name is required'),
  account_number: z.string().regex(/^\d+$/, 'Account number must contain only numbers').min(5, 'Account number is too short'),
  account_name: z.string().min(2, 'Account name must be at least 2 characters'),
  instructions: z.string().min(5, 'Instructions must be at least 5 characters')
});

export type TService = z.infer<typeof ServiceSchema> & { id: string };
export type TNewService = z.infer<typeof ServiceSchema>;
export type TPaymentSettings = z.infer<typeof PaymentSettingsSchema>;

export const defaultServices: TNewService[] = [
  {
    title: 'Standard Home Clean',
    category: 'Professional Cleaning',
    price: '₦5,000 - ₦10,000',
    description: 'Perfect for regular upkeep of your flat or duplex.',
    features: ['Detailed Floor Mopping', 'Kitchen & Bathroom Sanitization', 'Dusting of All Surfaces', 'Trash Disposal', 'Window Internal Wiping'],
    recommended: false
  },
  {
    title: 'Premium Service',
    category: 'Professional Cleaning',
    price: '₦10,000 - ₦20,000',
    description: 'Comprehensive deep cleaning for new or renovated properties.',
    features: ['Paint & Cement Stain Removal', 'Deep Floor Scrubbing', 'Full Kitchen Degreasing', 'Window & Frame Detailing', 'Sanitization of All Fixtures', 'De-webbing & Wall Cleaning'],
    recommended: true
  },
  {
    title: 'Generator Servicing',
    category: 'Power & Water Utilities',
    price: '₦10,000',
    description: 'Routine maintenance for your Mikano, Perkins, or small portable sets.',
    features: ['Oil & Filter Change', 'Plug Replacement', 'Control Panel Inspection', 'Battery Health Check', 'Performance Tuning'],
    recommended: false
  },
  {
    title: 'Borehole & Plumbing',
    category: 'Power & Water Utilities',
    price: '₦25,000',
    description: 'Pump repairs, tank cleaning, and full plumbing diagnostics.',
    features: ['Submersible Pump Repair', 'Overhead Tank Cleaning', 'Pipe Leak Detection', 'Pressure Pump Calibration', 'Water Treatment Check'],
    recommended: false
  },
  {
    title: 'Technical Repairs',
    category: 'Expert Artisans',
    price: '₦12,000',
    description: 'AC servicing, electrical faults, and carpentry fixes.',
    features: ['AC Gas Refilling & Cleaning', 'Electrical Fault Tracing', 'Inverter & Solar Check-up', 'Furniture & Cabinet Repair', 'Door Lock Installations'],
    recommended: false
  },
  {
    title: 'Full Estate Maintenance',
    category: 'Expert Artisans',
    price: 'Negotiable',
    description: 'End-to-end maintenance for property owners and estate managers.',
    features: ['Interlocking Tile Repair', 'Fumigation & Pest Control', 'Compound Cleaning', 'Gate Automation Support', '24/7 Priority Response'],
    recommended: false
  }
];

export const pricingService = {
  /**
   * Fetch all services from Supabase database.
   */
  fetchServices: async (): Promise<IApiResponse<TService[]>> => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('category');

      if (error) throw error;
      return { success: true, data: (data || []) as TService[] };
    } catch (err: any) {
      console.error('Failed to fetch services:', err);
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: err.message || 'Failed to fetch services.' }
      };
    }
  },

  /**
   * Update the price of a specific service.
   */
  updateServicePrice: async (id: string, price: string): Promise<IApiResponse<any>> => {
    try {
      const priceTrimmed = price.trim();
      if (!priceTrimmed) throw new Error('Price cannot be empty.');

      const { data, error } = await supabase
        .from('services')
        .update({ price: priceTrimmed })
        .eq('id', id)
        .select();

      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error('Failed to update service price:', err);
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: err.message || 'Failed to update service price.' }
      };
    }
  },

  /**
   * Add a new service into the database.
   */
  addService: async (service: TNewService): Promise<IApiResponse<TService>> => {
    try {
      const validated = ServiceSchema.parse(service);
      const { data, error } = await supabase
        .from('services')
        .insert([validated])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: data as TService };
    } catch (err: any) {
      console.error('Failed to add service:', err);
      return {
        success: false,
        error: {
          code: err instanceof z.ZodError ? 'VALIDATION_ERROR' : 'DATABASE_ERROR',
          message: err.message || 'Failed to add service.'
        }
      };
    }
  },

  /**
   * Delete a service from the database.
   */
  deleteService: async (id: string): Promise<IApiResponse<any>> => {
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Failed to delete service:', err);
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: err.message || 'Failed to delete service.' }
      };
    }
  },

  /**
   * Seed the default services into the database.
   */
  seedDefaultServices: async (): Promise<IApiResponse<any>> => {
    try {
      const { error } = await supabase
        .from('services')
        .insert(defaultServices);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Failed to seed default services:', err);
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: err.message || 'Failed to seed services.' }
      };
    }
  },

  /**
   * Fetch payment settings.
   */
  fetchPaymentSettings: async (): Promise<IApiResponse<TPaymentSettings>> => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'payment_details')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      const value = data ? data.value : { bank_name: '', account_number: '', account_name: '', instructions: '' };
      return { success: true, data: value as TPaymentSettings };
    } catch (err: any) {
      console.error('Failed to fetch payment settings:', err);
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: err.message || 'Failed to fetch payment settings.' }
      };
    }
  },

  /**
   * Save/Upsert payment settings.
   */
  savePaymentSettings: async (settings: TPaymentSettings): Promise<IApiResponse<any>> => {
    try {
      const validated = PaymentSettingsSchema.parse(settings);
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'payment_details', value: validated });

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('Failed to save payment settings:', err);
      return {
        success: false,
        error: {
          code: err instanceof z.ZodError ? 'VALIDATION_ERROR' : 'DATABASE_ERROR',
          message: err.message || 'Failed to save payment details.'
        }
      };
    }
  }
};
