import { z } from 'zod';
import { supabase } from '../lib/supabase';
import type { IApiResponse } from '../types/api';

export const JobSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2, 'Job title must be at least 2 characters'),
  department: z.string().min(2, 'Department/Category must be at least 2 characters'),
  location: z.string().min(2, 'Location description is required'),
  type: z.string().min(2, 'Job type or tag is required'),
  role_type: z.enum(['artisan', 'corporate']),
  description: z.string().optional().nullable(),
  responsibilities: z.string().optional().nullable(),
  requirements: z.string().optional().nullable(),
  benefits: z.string().optional().nullable()
});

export type TJob = z.infer<typeof JobSchema> & { id: string };
export type TNewJob = z.infer<typeof JobSchema>;

export const defaultJobs: TNewJob[] = [
  {
    title: 'Customer Acquisition Representative',
    department: 'Sales & Marketing',
    location: 'Remote / Flexible',
    type: 'Commission-Based',
    role_type: 'corporate',
    description: 'Lezerv is a registered company in Nigeria that connects customers with trusted home service providers for services such as cleaning, repairs, maintenance, laundry, cooking, and other household needs. Our mission is to make accessing reliable home services simple, convenient, and efficient. We are seeking energetic and self-driven Customer Acquisition Representatives to help Lezerv grow its customer base. Your primary responsibility will be generating paying customers through online and offline channels. This role is ideal for individuals with strong communication skills who want flexible work and unlimited earning potential.',
    responsibilities: 'Identify and acquire new customers for Lezerv services.\nPromote Lezerv through social media platforms, WhatsApp, referrals, communities, and direct outreach.\nFollow up with potential customers and guide them through the booking process.\nBuild relationships and maintain customer engagement.\nTrack leads and report successful conversions.',
    requirements: 'Good communication and interpersonal skills.\nActive use of WhatsApp and social media platforms.\nAbility to work independently and achieve targets.\nPrevious sales or marketing experience is an advantage but not required.',
    benefits: 'Earn 15% commission on every successful completed booking from customers you bring.\nAdditional performance incentives may be provided for reaching customer acquisition targets.\nExample: Customer booking value: ₦20,000 -> Your commission (15%): ₦3,000.\nFlexible working schedule.\nUnlimited earning opportunity.\nOpportunity to grow with Lezerv as the company expands.'
  },
  {
    title: 'Operations Manager',
    department: 'Logistics',
    location: 'Lagos, Nigeria',
    type: 'Full-Time',
    role_type: 'corporate',
    description: 'We are looking for an experienced Operations Manager to oversee our daily home services logistics, service provider onboarding, quality control processes, and customer satisfaction metrics. You will ensure seamless service delivery and direct field operations across Nigeria.',
    responsibilities: 'Manage day-to-day operations and service delivery logistics.\nOnboard, verify, and monitor home service providers and artisans.\nImplement quality control standards and handle escalations.\nOptimize field resource allocation and dispatch schedules.\nTrack key operational performance indicators.',
    requirements: '3+ years experience in operations, logistics, or project management.\nExcellent organizational and team management skills.\nDeep familiarity with the home service industry in Nigeria.\nStrong analytical mindset and problem-solving skills.',
    benefits: 'Competitive monthly base salary.\nComprehensive health insurance plan.\nPaid time off and performance-related bonuses.\nProfessional growth and executive leadership opportunities.'
  },
  {
    title: 'Frontend Engineer (React)',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-Time',
    role_type: 'corporate',
    description: 'Join our dynamic product team and build the next-generation web platforms for Lezerv. You will build highly responsive, state-of-the-art interactive frontends utilizing React, TypeScript, and modern styling libraries.',
    responsibilities: 'Develop high-quality, responsive user interfaces and modular components.\nCollaborate with product designers and backend engineers to integrate APIs.\nOptimize application performance, loading speeds, and accessibility.\nWrite strict, clean, and maintainable TypeScript code.',
    requirements: '3+ years of professional experience building frontend applications in React.\nExpertise in CSS, TailwindCSS, Framer Motion, and TypeScript strict mode.\nFamiliarity with state management libraries and REST/GraphQL APIs.\nPortfolio showcasing premium UI designs and micro-animations.',
    benefits: 'Competitive remote remuneration package.\nAnnual learning and device upgrades budgets.\nFlexible working hours and remote setups.\nWork with an exceptionally talented international tech team.'
  },
  {
    title: 'Certified Electrician',
    department: 'Electrical Services',
    location: 'Lagos (Lekki, Ikeja, Yaba)',
    type: 'Apply for this role',
    role_type: 'artisan',
    description: 'We are expanding our verified artisan network in Lagos! Join Lezerv as an Electrical Services Partner and receive direct consumer jobs with guaranteed weekly payouts. We are reaching out to local skilled electricians to connect them with high-value contracts.',
    responsibilities: 'Perform house conduit and surface wiring installations.\nTroubleshoot electrical faults, breaker issues, and short circuits.\nInstall and service distribution boards, lighting, and power outlets.\nEnsure rigorous safety standards on all residential and commercial jobs.',
    requirements: 'Solid hands-on experience in residential and commercial electrical work.\nTechnical degree, vocational certificate, or proven local apprenticeship.\nOwnership of basic professional testing and installation tools.\nReliable smartphone with WhatsApp access.',
    benefits: 'Constant stream of verified, high-paying bookings in your area.\nGuaranteed weekly direct payouts to your bank account.\nFree tool insurance and safety certifications.\nNo registration fees or commission cuts for verified basic tiers.'
  },
  {
    title: 'Master Plumber',
    department: 'Plumbing Services',
    location: 'Lagos (Gbagada, Surulere, Victoria Island)',
    type: 'Apply for this role',
    role_type: 'artisan',
    description: 'Become a verified Plumbing Services Partner on the Lezerv platform. Build a steady customer base in Lagos and gain access to continuous high-demand bookings, from pipe fixing to complex pump installations.',
    responsibilities: 'Install, maintain, and repair residential plumbing systems and fixtures.\nDetect leaks, unclog drains, and fix broken pipes or fittings.\nInstall and service overhead tanks, water pumps, and boreholes.\nProvide accurate estimates on pipe lengths and plumbing materials.',
    requirements: 'Proven experience as a master plumber in Nigeria.\nStrong practical knowledge of piping materials, water flow dynamics, and pump rigs.\nExcellent communication skills with customers.\nReliable smartphone for receiving jobs via WhatsApp.',
    benefits: 'Direct job assignments near your location.\nTransparent pricing and secure weekly bank transfers.\nGrowth support, tools subsidies, and partner benefits.\nFlexible scheduling: choose when you are available to work.'
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
