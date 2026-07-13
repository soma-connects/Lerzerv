// Marketplace domain types (Phase 1)

export type ArtisanStatus = 'pending' | 'approved' | 'suspended' | 'rejected';

export type RequestStatus =
  | 'requested'
  | 'accepted'
  | 'declined'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface IServiceCategory {
  slug: string;
  name: string;
  icon?: string;
}

/** A row from search_artisans() — public, safe to render in lists. */
export interface IArtisanSearchResult {
  id: string;
  display_name: string;
  bio: string | null;
  city: string;
  avatar_url: string | null;
  years_experience: number;
  is_verified: boolean;
  avg_rating: number;
  total_reviews: number;
  completed_jobs: number;
  distance_km: number;
  categories: string[];
}

export interface IArtisanReview {
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer: string;
}

/** The full public profile from get_artisan_public(). */
export interface IArtisanProfile {
  id: string;
  display_name: string;
  bio: string | null;
  city: string;
  avatar_url: string | null;
  years_experience: number;
  is_verified: boolean;
  avg_rating: number;
  total_reviews: number;
  completed_jobs: number;
  categories: { slug: string; name: string }[];
  reviews: IArtisanReview[];
}

export interface IServiceArea {
  slug: string;
  name: string;
}

export interface IArtisanOnboarding {
  displayName: string;
  city: string;
  bio?: string;
  avatarUrl?: string;
  yearsExperience?: number;
  phone?: string;
  nin?: string;
  address?: string;
  categorySlugs: string[];
  areaSlugs: string[];
}

export interface IServiceRequest {
  id: string;
  client_id: string | null;
  artisan_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  address_text: string | null;
  status: RequestStatus;
  quote_amount: number | null;
  scheduled_for: string | null;
  created_at: string;
}
