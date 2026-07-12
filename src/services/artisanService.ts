import { supabase } from '../lib/supabase';
import type { IApiResponse } from '../types/api';
import type {
  IArtisanSearchResult,
  IArtisanProfile,
  IArtisanOnboarding,
  IServiceRequest,
  IServiceCategory,
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

  /** Create or update the current user's artisan profile. */
  saveProfile: async (o: IArtisanOnboarding): Promise<IApiResponse<{ id: string; status: string }>> => {
    try {
      const { data, error } = await supabase.rpc('upsert_artisan_profile', {
        p_display_name: o.displayName,
        p_city: o.city,
        p_bio: o.bio ?? null,
        p_avatar_url: o.avatarUrl ?? null,
        p_years_experience: o.yearsExperience ?? 0,
        p_lat: o.lat ?? null,
        p_lng: o.lng ?? null,
        p_service_radius_km: o.serviceRadiusKm ?? 15,
        p_phone: o.phone ?? null,
        p_nin: o.nin ?? null,
        p_address: o.address ?? null,
        p_category_slugs: o.categorySlugs,
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

    const [{ data: cats }, { data: priv }] = await Promise.all([
      supabase
        .from('artisan_categories')
        .select('service_categories(slug)')
        .eq('artisan_id', data.id),
      supabase
        .from('artisan_private')
        .select('phone, nin, address')
        .eq('artisan_id', data.id)
        .maybeSingle(),
    ]);

    const categorySlugs = (cats || [])
      .map((c: any) => c.service_categories?.slug)
      .filter(Boolean);

    return { ...data, categorySlugs, ...(priv || {}) };
  },

  /** Toggle "ready for work" (server enforces approved status). */
  setAvailability: async (available: boolean): Promise<void> => {
    await supabase.rpc('set_artisan_availability', { p_available: available });
  },

  /** Geo-search for available artisans near a point. */
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

  // ── Admin ────────────────────────────────────────────────────────

  /** All artisans with their private KYC data (admin — RLS enforces access). */
  adminFetchArtisans: async (): Promise<any[]> => {
    const { data, error } = await supabase
      .from('artisans')
      .select('*, artisan_private(phone, nin, nin_verified, address), artisan_categories(service_categories(name))')
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
