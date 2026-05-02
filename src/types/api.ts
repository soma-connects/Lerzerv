/**
 * API Type Definitions for Lezerv
 */

export interface IApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface IContactSubmission {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export interface IBookingRequest {
  serviceName: string;
  details: string;
  date: string;
  time: string;
  location: {
    city: string;
    estate?: string;
    address: string;
  };
  customer: {
    name: string;
    phone: string;
    email: string;
  };
}

export interface IServiceCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  basePrice: number;
}