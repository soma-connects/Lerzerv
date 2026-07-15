import { supabase } from '../lib/supabase';
import type { IApiResponse } from '../types/api';
import type {
  IArtisanSearchResult,
  IArtisanProfile,
  IArtisanOnboarding,
  IServiceRequest,
  IServiceCategory,
  IServiceArea,
} from '../types/marketplace';

/**
 * Marketplace service. Every mutation goes through a SECURITY DEFINER RPC —
 * the client never writes marketplace rows directly (RLS blocks it), and
 * sensitive data (phone/NIN/bank) never comes back to the browser.
 */
export const artisanService = {
  /** Public list of service categories for filters/onboarding. */
  fetchCategories: async (): Promise<IServiceCategory[]> => {
    const { data, error } = await supabase
      .from('service_categories')
      .select('slug, name, icon')
      .eq('is_active', true)
      .order('sort_order');
    if (error) return [];
    return (data || []) as IServiceCategory[];
  },

  /** Public list of Lagos service areas. */
  fetchAreas: async (): Promise<IServiceArea[]> => {
    const { data, error } = await supabase
      .from('service_areas')
      .select('slug, name')
      .eq('is_active', true)
      .order('sort_order');
    if (error) return [];
    return (data || []) as IServiceArea[];
  },

  /** Create or update the current user's artisan profile. */
  saveProfile: async (o: IArtisanOnboarding): Promise<IApiResponse<{ id: string; status: string }>> => {
    try {
      const { data, error } = await supabase.rpc('upsert_artisan_profile', {
        p_display_name: o.displayName,
        p_city: o.city,
        p_bio: o.bio ?? null,
        p_avatar_url: o.avatarUrl ?? null,
        p_years_experience: o.yearsExperience ?? 0,
        p_phone: o.phone ?? null,
        p_nin: o.nin ?? null,
        p_address: o.address ?? null,
        p_category_slugs: o.categorySlugs,
        p_area_slugs: o.areaSlugs,
        p_id_type: o.idType ?? null,
        p_id_number: o.idNumber ?? null,
        p_id_doc_path: o.idDocPath ?? null,
        p_bill_doc_path: o.billDocPath ?? null,
        p_passport_path: o.passportPath ?? null,
      }).single();
      if (error) throw error;
      return { success: true, data: data as any };
    } catch (err: any) {
      return { success: false, error: { code: 'PROFILE_ERROR', message: err.message } };
    }
  },

  /** The current user's own artisan profile (any status) + categories + private fields. */
  getMyProfile: async (): Promise<
    | (Record<string, any> & { categorySlugs: string[]; phone?: string; nin?: string; address?: string })
    | null
  > => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('artisans')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error || !data) return null;

    const [{ data: cats }, { data: areas }, { data: priv }] = await Promise.all([
      supabase
        .from('artisan_categories')
        .select('service_categories(slug)')
        .eq('artisan_id', data.id),
      supabase
        .from('artisan_areas')
        .select('service_areas(slug)')
        .eq('artisan_id', data.id),
      supabase
        .from('artisan_private')
        .select('phone, nin, address, id_type, id_number, id_doc_path, bill_doc_path, passport_path')
        .eq('artisan_id', data.id)
        .maybeSingle(),
    ]);

    const categorySlugs = (cats || [])
      .map((c: any) => c.service_categories?.slug)
      .filter(Boolean);
    const areaSlugs = (areas || [])
      .map((a: any) => a.service_areas?.slug)
      .filter(Boolean);

    return { ...data, categorySlugs, areaSlugs, ...(priv || {}) };
  },

  /** Upload a KYC document to the private 'kyc' bucket; returns its storage path. */
  uploadKyc: async (kind: 'id' | 'bill' | 'passport', file: File): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const path = `${user.id}/${kind}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('kyc').upload(path, file, { upsert: true });
    if (error) { console.warn('kyc upload failed:', error); return null; }
    return path;
  },

  /** Admin/owner: get a temporary signed URL to view a KYC document. */
  kycSignedUrl: async (path: string): Promise<string | null> => {
    if (!path) return null;
    const { data, error } = await supabase.storage.from('kyc').createSignedUrl(path, 3600);
    if (error) { console.warn('signed url failed:', error); return null; }
    return data?.signedUrl ?? null;
  },

  /** Toggle "ready for work" (server enforces approved status). */
  setAvailability: async (available: boolean): Promise<void> => {
    await supabase.rpc('set_artisan_availability', { p_available: available });
  },

  /** Area-based directory of approved artisans (dispatch model). */
  browse: async (areaSlug?: string, categorySlug?: string): Promise<any[]> => {
    const { data, error } = await supabase.rpc('browse_artisans', {
      p_area_slug: areaSlug || null,
      p_category_slug: categorySlug || null,
    });
    if (error) { console.warn('browse failed:', error); return []; }
    return data || [];
  },

  /** Geo-search for available artisans near a point. (legacy) */
  search: async (
    lat: number,
    lng: number,
    radiusKm = 15,
    categorySlug?: string
  ): Promise<IArtisanSearchResult[]> => {
    const { data, error } = await supabase.rpc('search_artisans', {
      p_lat: lat,
      p_lng: lng,
      p_radius_km: radiusKm,
      p_category_slug: categorySlug ?? null,
    });
    if (error) {
      console.warn('Artisan search failed:', error);
      return [];
    }
    return (data || []) as IArtisanSearchResult[];
  },

  /** Full public profile (with categories + recent reviews). */
  getPublicProfile: async (artisanId: string): Promise<IArtisanProfile | null> => {
    const { data, error } = await supabase.rpc('get_artisan_public', { p_artisan_id: artisanId });
    if (error || !data) return null;
    return data as IArtisanProfile;
  },

  /** Client creates a request to a specific artisan. */
  createRequest: async (params: {
    artisanId: string;
    title: string;
    categorySlug?: string;
    description?: string;
    addressText?: string;
    lat?: number;
    lng?: number;
    scheduledFor?: string;
    clientContact?: { name?: string; phone?: string };
  }): Promise<IApiResponse<IServiceRequest>> => {
    try {
      const { data, error } = await supabase.rpc('create_service_request', {
        p_artisan_id: params.artisanId,
        p_title: params.title,
        p_category_slug: params.categorySlug ?? null,
        p_description: params.description ?? null,
        p_address_text: params.addressText ?? null,
        p_lat: params.lat ?? null,
        p_lng: params.lng ?? null,
        p_scheduled_for: params.scheduledFor ?? null,
        p_client_contact: params.clientContact ?? null,
      }).single();
      if (error) throw error;
      return { success: true, data: data as any };
    } catch (err: any) {
      return { success: false, error: { code: 'REQUEST_ERROR', message: err.message } };
    }
  },

  /** Artisan accepts/declines a request (optionally with a quote). */
  respondToRequest: async (requestId: string, accept: boolean, quote?: number): Promise<void> => {
    await supabase.rpc('respond_service_request', {
      p_request_id: requestId,
      p_accept: accept,
      p_quote: quote ?? null,
    });
  },

  /** Advance a request: in_progress / completed (artisan) or cancelled (either). */
  updateRequestStatus: async (
    requestId: string,
    status: 'in_progress' | 'completed' | 'cancelled',
    reason?: string
  ): Promise<void> => {
    await supabase.rpc('update_request_status', {
      p_request_id: requestId,
      p_status: status,
      p_reason: reason ?? null,
    });
  },

  /** Client reviews a completed job. */
  submitReview: async (requestId: string, rating: number, comment?: string): Promise<IApiResponse<null>> => {
    try {
      const { error } = await supabase.rpc('submit_review', {
        p_request_id: requestId,
        p_rating: rating,
        p_comment: comment ?? null,
      });
      if (error) throw error;
      return { success: true, data: null };
    } catch (err: any) {
      return { success: false, error: { code: 'REVIEW_ERROR', message: err.message } };
    }
  },

  // ── Dispatch: jobs ───────────────────────────────────────────────

  /** Client posts a job to the dispatch pool. */
  createJob: async (p: {
    title: string; categorySlug: string; areaSlug: string;
    description?: string; addressText?: string; scheduledFor?: string;
    budgetNote?: string; clientContact?: { name?: string; phone?: string };
  }): Promise<IApiResponse<any>> => {
    try {
      const { data, error } = await supabase.rpc('create_service_job', {
        p_title: p.title,
        p_category_slug: p.categorySlug,
        p_area_slug: p.areaSlug,
        p_description: p.description ?? null,
        p_address_text: p.addressText ?? null,
        p_scheduled_for: p.scheduledFor ?? null,
        p_budget_note: p.budgetNote ?? null,
        p_client_contact: p.clientContact ?? null,
      }).single();
      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: { code: 'JOB_ERROR', message: err.message } };
    }
  },

  /** Artisan job board: open jobs matching my areas + services. */
  getOpenJobs: async (): Promise<any[]> => {
    const { data, error } = await supabase.rpc('get_open_jobs_for_artisan');
    if (error) { console.warn('getOpenJobs failed:', error); return []; }
    return data || [];
  },

  /** Artisan expresses interest in a job. */
  expressInterest: async (jobId: string, note?: string): Promise<IApiResponse<null>> => {
    const { error } = await supabase.rpc('express_interest', { p_job_id: jobId, p_note: note ?? null });
    if (error) return { success: false, error: { code: 'INTEREST_ERROR', message: error.message } };
    return { success: true, data: null };
  },

  /**
   * The current user's dispatch jobs (posted as client, or assigned as artisan),
   * enriched with category, area, counterpart, and conversation.
   */
  getDispatchJobs: async (): Promise<{ jobs: any[]; myUserId: string | null }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { jobs: [], myUserId: null };

    const { data, error } = await supabase
      .from('service_jobs')
      .select('*, service_categories(name), service_areas(name), artisans(display_name, user_id), conversations(id)')
      .order('created_at', { ascending: false });
    if (error) { console.warn('getDispatchJobs failed:', error); return { jobs: [], myUserId: user.id }; }

    const jobs = (data || []).map((j: any) => ({
      ...j,
      category_name: j.service_categories?.name || null,
      area_name: j.service_areas?.name || null,
      artisan_name: j.artisans?.display_name || null,
      conversation_id: j.conversations?.[0]?.id || null,
      iAmClient: j.client_id === user.id,
      iAmAssigned: j.artisans?.user_id === user.id,
    }));
    return { jobs, myUserId: user.id };
  },

  /** Advance a dispatch job: in_progress / completed (artisan) or cancelled (client). */
  updateJobStatus: async (jobId: string, status: 'in_progress' | 'completed' | 'cancelled', reason?: string): Promise<void> => {
    await supabase.rpc('update_service_job_status', { p_job_id: jobId, p_status: status, p_reason: reason ?? null });
  },

  /** Client reviews a completed dispatch job. */
  submitJobReview: async (jobId: string, rating: number, comment?: string): Promise<IApiResponse<null>> => {
    const { error } = await supabase.rpc('submit_job_review', { p_job_id: jobId, p_rating: rating, p_comment: comment ?? null });
    if (error) return { success: false, error: { code: 'REVIEW_ERROR', message: error.message } };
    return { success: true, data: null };
  },

  // ── Admin ────────────────────────────────────────────────────────

  /** All dispatch jobs for the admin queue. */
  adminFetchJobs: async (): Promise<any[]> => {
    const { data, error } = await supabase
      .from('service_jobs')
      .select('*, service_categories(name), service_areas(name), artisans(display_name)')
      .order('created_at', { ascending: false });
    if (error) { console.warn('adminFetchJobs failed:', error); return []; }
    return (data || []).map((j: any) => ({
      ...j,
      category_name: j.service_categories?.name || null,
      area_name: j.service_areas?.name || null,
      assigned_name: j.artisans?.display_name || null,
    }));
  },

  /** Applicants (interested artisans) for a job (admin). */
  adminGetApplicants: async (jobId: string): Promise<any[]> => {
    const { data, error } = await supabase.rpc('admin_get_job_applicants', { p_job_id: jobId });
    if (error) { console.warn('adminGetApplicants failed:', error); return []; }
    return data || [];
  },

  /** Assign a job to an artisan (admin) — opens the chat. */
  adminAssignJob: async (jobId: string, artisanId: string): Promise<IApiResponse<null>> => {
    const { error } = await supabase.rpc('admin_assign_job', { p_job_id: jobId, p_artisan_id: artisanId });
    if (error) return { success: false, error: { code: 'ASSIGN_ERROR', message: error.message } };
    return { success: true, data: null };
  },

  // ── Admin (artisans) ─────────────────────────────────────────────

  /** All artisans with their private KYC data (admin — RLS enforces access). */
  adminFetchArtisans: async (): Promise<any[]> => {
    const { data, error } = await supabase
      .from('artisans')
      .select('*, artisan_private(phone, nin, nin_verified, address, id_type, id_number, id_doc_path, bill_doc_path, passport_path), artisan_categories(service_categories(name))')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('adminFetchArtisans failed:', error);
      return [];
    }
    return data || [];
  },

  /** Approve / reject / suspend / re-pend an artisan (admin). */
  adminSetStatus: async (
    artisanId: string,
    status: 'pending' | 'approved' | 'suspended' | 'rejected'
  ): Promise<IApiResponse<null>> => {
    const { error } = await supabase.rpc('admin_set_artisan_status', {
      p_artisan_id: artisanId,
      p_status: status,
    });
    if (error) return { success: false, error: { code: 'ADMIN_ERROR', message: error.message } };
    return { success: true, data: null };
  },

  /** Toggle the verified/KYC badge (admin). */
  adminSetVerified: async (artisanId: string, verified: boolean): Promise<IApiResponse<null>> => {
    const { error } = await supabase.rpc('admin_set_artisan_verified', {
      p_artisan_id: artisanId,
      p_verified: verified,
    });
    if (error) return { success: false, error: { code: 'ADMIN_ERROR', message: error.message } };
    return { success: true, data: null };
  },

  /** Requests visible to the current user (own as client, or assigned as artisan). */
  myRequests: async (): Promise<IServiceRequest[]> => {
    const { data, error } = await supabase
      .from('service_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data || []) as IServiceRequest[];
  },

  /**
   * The current user's jobs, enriched for the dashboard: artisan name,
   * category, linked conversation, and whether the caller is the artisan.
   */
  getMyJobs: async (): Promise<{ jobs: any[]; myUserId: string | null }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { jobs: [], myUserId: null };

    const { data, error } = await supabase
      .from('service_requests')
      .select('*, artisans(display_name, user_id), service_categories(name), conversations(id)')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('getMyJobs failed:', error);
      return { jobs: [], myUserId: user.id };
    }

    const jobs = (data || []).map((r: any) => ({
      ...r,
      artisan_name: r.artisans?.display_name || 'Artisan',
      category_name: r.service_categories?.name || null,
      conversation_id: r.conversations?.[0]?.id || null,
      iAmArtisan: r.artisans?.user_id === user.id,
    }));
    return { jobs, myUserId: user.id };
  },
};
